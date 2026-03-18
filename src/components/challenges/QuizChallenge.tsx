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
}

type FeedbackState = "idle" | "correct" | "incorrect" | "revealed";

const POINTS_CORRECT = 10;
const PENALTY_REVEAL = 5; // deducted from a per-question base of 10

const difficultyStyles = {
  easy:         "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  difficult:    "bg-red-100 text-red-700",
};

export default function QuizChallenge({ questions, dict, challengeId }: Props) {
  const { markComplete } = useCompletedChallenges();
  const d = dict.challenges;
  const [index, setIndex]       = useState(0);
  const [userAnswer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const [score, setScore]       = useState(0);
  const [revealed, setRevealed] = useState<boolean[]>(Array(questions.length).fill(false));
  const [done, setDone]         = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const question  = questions[index];
  const total     = questions.length;
  const maxScore  = total * POINTS_CORRECT;

  useEffect(() => {
    setAnswer("");
    setFeedback("idle");
    inputRef.current?.focus();
  }, [index]);

  // Submit score when done screen is shown
  useEffect(() => {
    if (!done || submitted) return;
    setSubmitted(true);
    markComplete(challengeId, score, maxScore);
    fetch("/api/challenges/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, score, maxScore }),
    }).catch(() => {});
  }, [done, submitted, challengeId, score, maxScore, markComplete]);

  function handleCheck() {
    if (!userAnswer.trim() || feedback === "correct" || feedback === "revealed") return;
    if (checkAnswer(userAnswer, question.answer)) {
      setScore((s) => s + POINTS_CORRECT);
      setFeedback("correct");
    } else {
      setFeedback("incorrect");
    }
  }

  function handleReveal() {
    // Only deduct penalty if they hadn't already answered correctly
    if (feedback !== "correct") {
      setScore((s) => Math.max(0, s - PENALTY_REVEAL));
      setRevealed((r) => { const n = [...r]; n[index] = true; return n; });
    }
    setFeedback("revealed");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && feedback === "idle") handleCheck();
    if (e.key === "Enter" && (feedback === "correct" || feedback === "revealed")) handleNext();
  }

  function handleNext() {
    if (index < total - 1) {
      setIndex((i) => i + 1);
    } else {
      setDone(true);
    }
  }

  function handlePlayAgain() {
    setIndex(0);
    setAnswer("");
    setFeedback("idle");
    setScore(0);
    setRevealed(Array(total).fill(false));
    setDone(false);
    setSubmitted(false);
  }

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (done) {
    const pct = Math.round((score / maxScore) * 100);
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="text-6xl mb-4">{pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "📚"}</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{d.yourScore}</h2>
        <p className="text-5xl font-bold text-amber-500 mb-1">{score}</p>
        <p className="text-slate-400 text-sm mb-8">/ {maxScore}</p>
        <div className="w-full bg-slate-200 rounded-full h-3 mb-8">
          <div
            className="bg-amber-500 h-3 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-slate-500 mb-6">
          {total - revealed.filter(Boolean).length} / {total} answered correctly
        </p>
        <button
          onClick={handlePlayAgain}
          className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
        >
          {d.playAgain}
        </button>
      </div>
    );
  }

  // ── Quiz screen ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header: progress + score */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">
          {dict.quiz.questionOf.replace("{current}", String(index + 1)).replace("{total}", String(total))}
        </span>
        <span className="text-sm font-semibold text-amber-600">
          {d.yourScore}: {score}/{maxScore}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 rounded-full h-1.5 mb-8">
        <div
          className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* Difficulty + category */}
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
          disabled={feedback === "correct" || feedback === "revealed"}
          className="w-full px-4 py-3.5 border border-slate-300 rounded-lg text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>

      {/* Feedback banners */}
      {feedback === "correct" && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 font-medium">{dict.quiz.correct} <span className="text-green-500 text-sm font-normal">+{POINTS_CORRECT} pts</span></p>
        </div>
      )}
      {feedback === "incorrect" && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">{dict.quiz.incorrect}</p>
        </div>
      )}
      {feedback === "revealed" && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800">
            {dict.quiz.theAnswerIs} <span className="font-bold">{question.answer}</span>
          </p>
        </div>
      )}

      {/* Did you know */}
      {(feedback === "correct" || feedback === "revealed") && question.didYouKnow && (
        <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="text-sm font-semibold text-indigo-700 mb-1">{dict.quiz.didYouKnow}</p>
          <p className="text-sm text-indigo-600">{question.didYouKnow}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        {feedback !== "correct" && feedback !== "revealed" ? (
          <>
            <button
              onClick={handleCheck}
              disabled={!userAnswer.trim()}
              className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dict.quiz.checkAnswer}
            </button>
            <button
              onClick={handleReveal}
              className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
            >
              {dict.quiz.showAnswer}
            </button>
          </>
        ) : (
          <button
            onClick={handleNext}
            className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors"
          >
            {index < total - 1 ? dict.quiz.next : d.finish}
          </button>
        )}
      </div>
    </div>
  );
}
