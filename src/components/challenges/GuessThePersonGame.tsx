"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { checkAnswer } from "@/lib/utils";
import type { FamousPerson } from "@/data/famousPersons";
import type { Dictionary } from "@/i18n/en";

const TOTAL_TIME = 30; // seconds per round
const MAX_BLUR = 24; // pixels — starts completely unrecognisable

interface Props {
  persons: FamousPerson[];
  dict: Dictionary["challenges"];
}

type RoundState = "playing" | "won" | "lost";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function GuessThePersonGame({ persons, dict }: Props) {
  const [deck, setDeck] = useState<FamousPerson[]>(() => shuffle(persons));
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [roundState, setRoundState] = useState<RoundState>("playing");
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [wrongShake, setWrongShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const person = deck[index];
  const blurAmount = roundState === "playing" ? (timeLeft / TOTAL_TIME) * MAX_BLUR : 0;
  const showHint = timeLeft <= TOTAL_TIME * 0.5; // hint appears when half the time is gone

  // Timer
  useEffect(() => {
    if (roundState !== "playing") return;
    if (timeLeft <= 0) {
      setRoundState("lost");
      return;
    }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [roundState, timeLeft]);

  // Focus input when round starts
  useEffect(() => {
    inputRef.current?.focus();
  }, [index]);

  const handleSubmit = useCallback(() => {
    if (!answer.trim() || roundState !== "playing") return;
    if (checkAnswer(answer, person.name)) {
      const points = Math.max(10, Math.round((timeLeft / TOTAL_TIME) * 100));
      setScore((s) => s + points);
      setRoundState("won");
    } else {
      setAnswer("");
      setWrongShake(true);
      setTimeout(() => setWrongShake(false), 500);
    }
  }, [answer, roundState, person.name, timeLeft]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
  }

  function nextPerson() {
    const nextIndex = (index + 1) % deck.length;
    // Reshuffle when we've gone through all persons
    if (nextIndex === 0) setDeck(shuffle(persons));
    setIndex(nextIndex);
    setTimeLeft(TOTAL_TIME);
    setRoundState("playing");
    setAnswer("");
    setRound((r) => r + 1);
  }

  function playAgain() {
    setDeck(shuffle(persons));
    setIndex(0);
    setTimeLeft(TOTAL_TIME);
    setRoundState("playing");
    setAnswer("");
    setScore(0);
    setRound(1);
  }

  const timerPercent = (timeLeft / TOTAL_TIME) * 100;
  const timerColor =
    timeLeft > 15 ? "bg-green-500" : timeLeft > 8 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="max-w-lg mx-auto">
      {/* Score + round bar */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <span className="font-medium text-slate-600">
          {dict.round} {round}
        </span>
        <span className="font-semibold text-amber-600">
          {dict.score}: {score}
        </span>
      </div>

      {/* Timer bar */}
      <div className="w-full bg-slate-200 rounded-full h-2 mb-6">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${timerColor}`}
          style={{ width: `${timerPercent}%` }}
        />
      </div>

      {/* Image */}
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-100 shadow-md mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={person.imageUrl}
          alt="Who is this?"
          className="w-full h-full object-cover transition-none"
          style={{
            filter: `blur(${blurAmount}px)`,
            transform: "scale(1.05)", // prevents white edges from blur
          }}
        />

        {/* Time remaining overlay */}
        {roundState === "playing" && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-sm font-bold px-3 py-1 rounded-full">
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Hint */}
      {showHint && roundState === "playing" && (
        <div className="mb-4 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
          <span className="font-semibold">{dict.hint}:</span> {person.hint}
        </div>
      )}

      {/* Won state */}
      {roundState === "won" && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-700 font-semibold text-lg">{dict.correct}</p>
          <p className="text-green-600 text-sm mt-1">
            +{Math.max(10, Math.round((timeLeft / TOTAL_TIME) * 100))} pts — {timeLeft}s {dict.timeLeft}
          </p>
        </div>
      )}

      {/* Lost state */}
      {roundState === "lost" && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 font-semibold">{dict.timeUp}</p>
          <p className="text-red-600 text-sm mt-1">
            {dict.thePersonWas} <span className="font-bold">{person.name}</span>
          </p>
        </div>
      )}

      {/* Input + submit */}
      {roundState === "playing" && (
        <div className={`flex gap-2 mb-4 ${wrongShake ? "animate-[shake_0.4s_ease]" : ""}`}>
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={dict.typeTheName}
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          <button
            onClick={handleSubmit}
            disabled={!answer.trim()}
            className="px-5 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-40"
          >
            {dict.submit}
          </button>
        </div>
      )}

      {/* Next / Play again */}
      {roundState !== "playing" && (
        <div className="flex gap-3">
          <button
            onClick={nextPerson}
            className="flex-1 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
          >
            {dict.nextPerson}
          </button>
          <button
            onClick={playAgain}
            className="px-4 py-3 border border-slate-300 text-slate-600 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            {dict.playAgain}
          </button>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
