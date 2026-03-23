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
type FeedbackState = "idle" | "correct" | "revealed";

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

  const [phase,      setPhase]    = useState<Phase>("playing");
  const [index,      setIndex]    = useState(0);
  const [userAnswer, setAnswer]   = useState("");
  const [feedback,   setFeedback] = useState<FeedbackState>("idle");
  const [statuses,   setStatuses] = useState<QuestionStatus[]>(Array(questions.length).fill("unanswered"));
  const [lives,      setLives]    = useState(maxLives);
  const [submitted,  setSubmitted] = useState(false);
  const [winAnim,    setWinAnim]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const question    = questions[index];
  const total       = questions.length;
  const maxScore    = total * POINTS_CORRECT;
  const score       = statuses.filter((s) => s === "correct").length * POINTS_CORRECT;
  const gameOver    = lives <= 0;
  const allAnswered = statuses.every((s) => s !== "unanswered");

  // Reset input/feedback when navigating to a question
  useEffect(() => {
    const s = statuses[index];
    setAnswer("");
    setFeedback(s === "correct" ? "correct" : s === "wrong" ? "revealed" : "idle");
    inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase]);

  // Win: all answered with lives remaining
  useEffect(() => {
    if (!allAnswered || gameOver || submitted) return;
    setWinAnim(true);
    const t = setTimeout(() => setPhase("done"), 2200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered, gameOver]);

  // Submit score on game over
  useEffect(() => {
    if (!gameOver || submitted) return;
    setSubmitted(true);
    fetch("/api/challenges/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, score, maxScore }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  // Submit score + mark complete when win (all answered, lives > 0)
  useEffect(() => {
    if (phase !== "done" || submitted) return;
    setSubmitted(true);
    markComplete(challengeId, score, maxScore);
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
    if (!userAnswer.trim() || feedback !== "idle" || gameOver) return;

    if (checkAnswer(userAnswer, question.answer)) {
      const next = [...statuses];
      next[index] = "correct";
      setStatuses(next);
      setFeedback("correct");
      // auto-advance to next unanswered
      const nextIdx = next.findIndex((s, i) => i !== index && s === "unanswered");
      if (nextIdx !== -1) setTimeout(() => setIndex(nextIdx), 900);
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      const next = [...statuses];
      next[index] = "wrong";
      setStatuses(next);
      setFeedback("revealed");
      // auto-advance to next unanswered (if lives remain)
      if (newLives > 0) {
        const nextIdx = next.findIndex((s, i) => i !== index && s === "unanswered");
        if (nextIdx !== -1) setTimeout(() => setIndex(nextIdx), 1800);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleCheck();
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
        @keyframes gameOverFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes gameOverBounce {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          60%  { transform: scale(1.25) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes gameOverSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-3 min-h-[28px]">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-amber-700">
            {statuses.filter((s) => s === "correct").length}/{total}
          </span>{" "}
          correct
        </p>
        {!gameOver && !winAnim && <Lives current={lives} max={maxLives} />}
        {gameOver && <p className="text-sm font-semibold text-red-600">No lives remaining</p>}
        {winAnim && <p className="text-sm font-semibold text-green-600">{d.finish} 🎉</p>}
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
                  : status === "wrong"
                    ? "bg-green-200 border-green-300 text-green-700 ring-2 ring-green-200 ring-offset-1"
                    : "bg-white border-amber-500 text-amber-700 ring-2 ring-amber-300 ring-offset-1"
                : status === "correct"
                  ? "bg-green-500 border-green-500 text-white"
                  : status === "wrong"
                    ? "bg-green-100 border-green-200 text-green-600"
                    : "bg-white border-slate-300 text-slate-400 hover:border-amber-400",
              winAnim && status !== "unanswered" ? "square-win" : "",
            ].join(" ")}
            style={winAnim && status !== "unanswered" ? { animationDelay: `${i * 60}ms` } : undefined}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question area with game-over overlay */}
      <div className="relative">
        {gameOver && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-xl overflow-hidden">
            <div
              className="absolute inset-0 bg-red-950/75"
              style={{ animation: "gameOverFade 0.35s ease-out forwards" }}
            />
            <div className="relative z-10 text-center px-4">
              <p className="text-5xl mb-3" style={{ animation: "gameOverBounce 0.5s ease-out forwards" }}>
                💔
              </p>
              <p
                className="text-white font-bold text-xl tracking-wide"
                style={{ animation: "gameOverSlideUp 0.35s ease-out 0.1s both" }}
              >
                Game Over
              </p>
              <p
                className="text-red-300 text-sm mt-1"
                style={{ animation: "gameOverSlideUp 0.35s ease-out 0.2s both" }}
              >
                No lives remaining
              </p>
              <button
                onClick={handlePlayAgain}
                className="mt-5 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
                style={{ animation: "gameOverSlideUp 0.35s ease-out 0.35s both" }}
              >
                {d.playAgain}
              </button>
            </div>
          </div>
        )}

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
          disabled={feedback !== "idle" || gameOver}
          className="w-full px-4 py-3.5 border border-slate-300 rounded-lg text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>

      {/* Feedback banners */}
      {feedback === "correct" && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 font-medium">{dict.quiz.correct}</p>
        </div>
      )}
      {feedback === "revealed" && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800">
            {dict.quiz.theAnswerIs} <span className="font-bold">{question.answer}</span>
          </p>
        </div>
      )}

      {/* Action button */}
      {feedback === "idle" && !gameOver && (
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

      </div>{/* end question area */}

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
