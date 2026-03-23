"use client";

import { useState, useEffect, useRef } from "react";
import { checkAnswer } from "@/lib/utils";
import Image from "next/image";
import type { Dictionary } from "@/i18n/en";
import { useCompletedChallenges } from "@/hooks/useCompletedChallenges";

export interface QuizQuestion {
  id: number;
  questionText: string;
  answer: string;
  imagePath: string | null;
  didYouKnow: string | null;
  difficulty: "easy" | "intermediate" | "difficult";
}

interface Props {
  questions: QuizQuestion[];
  dict: Dictionary;
  challengeId: string;
  startingLives?: number;
}

type Phase = "playing" | "done";
type QuestionStatus = "unanswered" | "correct" | "wrong";
type FeedbackState = "idle" | "correct" | "incorrect";

const POINTS_CORRECT = 10;

const difficultyStyles = {
  easy:         "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  difficult:    "bg-red-100 text-red-700",
};

// ── Lives display ─────────────────────────────────────────────────────────────
function Lives({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`text-sm sm:text-base transition-all duration-300 ${
            i < current ? "text-red-500" : "text-slate-200"
          }`}
          style={i >= current ? { filter: "grayscale(1)" } : undefined}
        >
          ♥
        </span>
      ))}
    </div>
  );
}

export default function QuizChallenge({ questions, dict, challengeId, startingLives = 5 }: Props) {
  const maxLives = Math.max(1, startingLives);
  const { markComplete } = useCompletedChallenges();
  const d = dict.challenges;

  const [phase,      setPhase]     = useState<Phase>("playing");
  const [index,      setIndex]     = useState(0);
  const [userAnswer, setAnswer]    = useState("");
  const [feedback,   setFeedback]  = useState<FeedbackState>("idle");
  const [statuses,   setStatuses]  = useState<QuestionStatus[]>(Array(questions.length).fill("unanswered"));
  const [lives,      setLives]     = useState(maxLives);
  const [submitted,  setSubmitted] = useState(false);
  const [winAnim,    setWinAnim]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const question  = questions[index];
  const total     = questions.length;
  const maxScore  = total * POINTS_CORRECT;
  const score     = statuses.filter((s) => s === "correct").length * POINTS_CORRECT;
  const gameOver  = lives <= 0;
  const allCorrect = statuses.every((s) => s === "correct");

  // Reset input/feedback when navigating
  useEffect(() => {
    const s = statuses[index];
    setAnswer("");
    setFeedback(s === "unanswered" ? "idle" : s === "correct" ? "correct" : "idle");
    inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase]);

  // Trigger win animation then done
  useEffect(() => {
    if (!allCorrect || submitted) return;
    setWinAnim(true);
    const t = setTimeout(() => setPhase("done"), 2000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCorrect]);

  // Game over → done
  useEffect(() => {
    if (gameOver && phase === "playing") {
      const t = setTimeout(() => setPhase("done"), 1200);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  // Submit score when done
  useEffect(() => {
    if (phase !== "done" || submitted) return;
    setSubmitted(true);
    if (allCorrect) markComplete(challengeId, score, maxScore);
    fetch("/api/challenges/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, score, maxScore }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, submitted]);

  function navigateTo(i: number) {
    if (i >= 0 && i < total && !gameOver) setIndex(i);
  }

  function handleCheck() {
    if (!userAnswer.trim() || feedback === "correct" || gameOver) return;
    if (checkAnswer(userAnswer, question.answer)) {
      const next = [...statuses];
      next[index] = "correct";
      setStatuses(next);
      setFeedback("correct");
      // auto-advance to next unanswered after short delay
      const nextUnanswered = next.findIndex((s, i) => i !== index && s === "unanswered");
      if (nextUnanswered !== -1) {
        setTimeout(() => setIndex(nextUnanswered), 900);
      }
    } else {
      setFeedback("incorrect");
      const newLives = lives - 1;
      setLives(newLives);
      const next = [...statuses];
      if (next[index] === "unanswered") next[index] = "wrong";
      setStatuses(next);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && feedback === "idle") handleCheck();
  }

  function handlePlayAgain() {
    setIndex(0);
    setAnswer("");
    setFeedback("idle");
    setStatuses(Array(total).fill("unanswered"));
    setLives(maxLives);
    setSubmitted(false);
    setWinAnim(false);
    setPhase("playing");
  }

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (phase === "done") {
    const correctCount = statuses.filter((s) => s === "correct").length;
    const pct = Math.round((correctCount / total) * 100);
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="text-6xl mb-4">{pct === 100 ? "🏆" : pct >= 80 ? "⭐" : pct >= 50 ? "👍" : "📚"}</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{d.finish}</h2>
        <p className="text-slate-500 mb-6">{correctCount} / {total} answered correctly</p>
        <button
          onClick={handlePlayAgain}
          className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
        >
          {d.playAgain}
        </button>
      </div>
    );
  }

  // ── Quiz screen ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <style>{`
        @keyframes squarePop {
          0%   { transform: scale(1) rotate(0deg); }
          25%  { transform: scale(1.35) rotate(-8deg); }
          55%  { transform: scale(1.2) rotate(6deg); }
          75%  { transform: scale(1.1) rotate(-3deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .square-win { animation: squarePop 0.5s ease-in-out forwards; }
        @keyframes heartLose {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.4); }
          60%  { transform: scale(0.8); }
          100% { transform: scale(1); }
        }
        .heart-lose { animation: heartLose 0.4s ease-out forwards; }
      `}</style>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-3 min-h-[28px]">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-amber-700">
            {statuses.filter((s) => s === "correct").length}/{total}
          </span>{" "}
          correct
        </p>
        {!allCorrect && !gameOver && <Lives current={lives} max={maxLives} />}
        {gameOver && <p className="text-sm font-semibold text-red-600">No lives remaining</p>}
        {allCorrect && <p className="text-sm font-semibold text-green-600">{d.finish} 🎉</p>}
      </div>

      {/* Question status squares */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {statuses.map((status, i) => (
          <button
            key={i}
            onClick={() => navigateTo(i)}
            title={`Question ${i + 1}`}
            className={[
              "w-7 h-7 rounded border-2 text-xs font-bold transition-colors",
              i === index
                ? status === "correct"
                  ? "bg-green-500 border-green-600 text-white ring-2 ring-green-300 ring-offset-1"
                  : "bg-white border-amber-500 text-amber-700 ring-2 ring-amber-300 ring-offset-1"
                : status === "correct"
                  ? "bg-green-500 border-green-500 text-white"
                  : status === "wrong"
                    ? "bg-red-200 border-red-300 text-red-500"
                    : "bg-white border-slate-300 text-slate-400 hover:border-amber-400",
              winAnim && status === "correct" ? "square-win" : "",
            ].join(" ")}
            style={winAnim && status === "correct" ? { animationDelay: `${i * 60}ms` } : undefined}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Difficulty */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${difficultyStyles[question.difficulty]}`}>
          {dict.quiz[question.difficulty]}
        </span>
      </div>

      {/* Optional image */}
      {question.imagePath && (
        <div className="relative w-full aspect-video mb-6 rounded-lg overflow-hidden bg-slate-100">
          <Image
            src={question.imagePath}
            alt="Question image"
            fill
            className="object-contain"
            sizes="(max-width: 672px) 100vw, 672px"
          />
        </div>
      )}

      {/* Question */}
      <h2 className="text-xl font-semibold text-slate-800 mb-6">{question.questionText}</h2>

      {/* Answer input */}
      <div className="mb-4">
        <input
          ref={inputRef}
          type="text"
          value={userAnswer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={dict.quiz.typeYourAnswer}
          disabled={feedback === "correct" || gameOver}
          className="w-full px-4 py-3.5 border border-slate-300 rounded-lg text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>

      {/* Feedback banners */}
      {feedback === "correct" && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 font-medium">{dict.quiz.correct}</p>
        </div>
      )}
      {feedback === "incorrect" && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">{dict.quiz.incorrect}</p>
        </div>
      )}

      {/* Did you know */}
      {feedback === "correct" && question.didYouKnow && (
        <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="text-sm font-semibold text-indigo-700 mb-1">{dict.quiz.didYouKnow}</p>
          <p className="text-sm text-indigo-600">{question.didYouKnow}</p>
        </div>
      )}

      {/* Action button */}
      {feedback !== "correct" && !gameOver && (
        <div className="mb-8">
          <button
            onClick={handleCheck}
            disabled={!userAnswer.trim()}
            className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {dict.quiz.checkAnswer}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
        <button
          onClick={() => navigateTo(index - 1)}
          disabled={index === 0}
          className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← {dict.quiz.previous}
        </button>
        <button
          onClick={() => setPhase("done")}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-amber-700 transition-colors"
        >
          {d.finish}
        </button>
        <button
          onClick={() => navigateTo(index + 1)}
          disabled={index === total - 1}
          className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {dict.quiz.next} →
        </button>
      </div>
    </div>
  );
}
