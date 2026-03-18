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

type Phase = "selecting" | "playing" | "done";
type QuestionStatus = "unanswered" | "correct" | "revealed";
type FeedbackState = "idle" | "correct" | "incorrect" | "revealed";

const POINTS_CORRECT = 10;

const difficultyStyles = {
  easy:         "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  difficult:    "bg-red-100 text-red-700",
};

export default function QuizChallenge({ questions, dict, challengeId }: Props) {
  const { markComplete } = useCompletedChallenges();
  const d = dict.challenges;

  // ── Selection phase state ─────────────────────────────────────────────────
  const [phase,     setPhase]     = useState<Phase>("selecting");
  const [selected,  setSelected]  = useState<Set<number>>(() => new Set(questions.map((q) => q.id)));

  // ── Playing phase state ───────────────────────────────────────────────────
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [index,     setIndex]     = useState(0);
  const [userAnswer, setAnswer]   = useState("");
  const [feedback,  setFeedback]  = useState<FeedbackState>("idle");
  const [statuses,  setStatuses]  = useState<QuestionStatus[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const question = activeQuestions[index];
  const total    = activeQuestions.length;
  const maxScore = total * POINTS_CORRECT;
  const score    = statuses.filter((s) => s === "correct").length * POINTS_CORRECT;

  // Reset input/feedback when navigating
  useEffect(() => {
    if (phase !== "playing" || !statuses[index]) return;
    const s = statuses[index];
    setAnswer("");
    setFeedback(s === "unanswered" ? "idle" : s === "correct" ? "correct" : "revealed");
    inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase]);

  // Submit when done
  useEffect(() => {
    if (phase !== "done" || submitted) return;
    setSubmitted(true);
    if (statuses.every((s) => s !== "revealed")) markComplete(challengeId, score, maxScore);
    fetch("/api/challenges/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, score, maxScore }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, submitted]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  function toggleQuestion(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function startQuiz() {
    const active = questions.filter((q) => selected.has(q.id));
    if (active.length === 0) return;
    setActiveQuestions(active);
    setStatuses(Array(active.length).fill("unanswered"));
    setIndex(0);
    setAnswer("");
    setFeedback("idle");
    setSubmitted(false);
    setPhase("playing");
  }

  // ── Playing helpers ───────────────────────────────────────────────────────
  function navigateTo(i: number) {
    if (i >= 0 && i < total) setIndex(i);
  }

  function handleCheck() {
    if (!userAnswer.trim() || feedback === "correct" || feedback === "revealed") return;
    if (checkAnswer(userAnswer, question.answer)) {
      setStatuses((prev) => { const n = [...prev]; n[index] = "correct"; return n; });
      setFeedback("correct");
    } else {
      setFeedback("incorrect");
    }
  }

  function handleReveal() {
    if (feedback === "correct") return;
    setStatuses((prev) => { const n = [...prev]; n[index] = "revealed"; return n; });
    setFeedback("revealed");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && feedback === "idle") handleCheck();
  }

  function handlePlayAgain() {
    setPhase("selecting");
    setSelected(new Set(questions.map((q) => q.id)));
  }

  // ── Selection screen ──────────────────────────────────────────────────────
  if (phase === "selecting") {
    const allSelected = selected.size === questions.length;
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{selected.size}</span> / {questions.length} questions selected
          </p>
          <button
            onClick={() => setSelected(allSelected ? new Set() : new Set(questions.map((q) => q.id)))}
            className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden mb-6">
          {questions.map((q, i) => {
            const isSelected = selected.has(q.id);
            return (
              <label
                key={q.id}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${isSelected ? "bg-white hover:bg-slate-50" : "bg-slate-50 hover:bg-slate-100"}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleQuestion(q.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-xs font-mono text-slate-400 mr-2">#{i + 1}</span>
                  <span className={`text-sm ${isSelected ? "text-slate-800" : "text-slate-400"}`}>
                    {q.questionText}
                  </span>
                  <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${difficultyStyles[q.difficulty]}`}>
                    {dict.quiz[q.difficulty]}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        <button
          onClick={startQuiz}
          disabled={selected.size === 0}
          className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start Quiz ({selected.size})
        </button>
      </div>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (phase === "done") {
    const correctCount = statuses.filter((s) => s === "correct").length;
    const pct = Math.round((correctCount / total) * 100);
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="text-6xl mb-4">{pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "📚"}</div>
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

  // ── Quiz screen ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">

      {/* Question status squares */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {statuses.map((status, i) => (
          <button
            key={i}
            onClick={() => navigateTo(i)}
            title={`Question ${i + 1}`}
            className={[
              "w-7 h-7 rounded border-2 text-xs font-bold transition-all",
              i === index
                ? status === "correct"
                  ? "bg-green-500 border-green-600 text-white ring-2 ring-green-300 ring-offset-1"
                  : "bg-white border-amber-500 text-amber-700 ring-2 ring-amber-300 ring-offset-1"
                : status === "correct"
                  ? "bg-green-500 border-green-500 text-white"
                  : status === "revealed"
                    ? "bg-slate-200 border-slate-300 text-slate-400"
                    : "bg-white border-slate-300 text-slate-400 hover:border-amber-400",
            ].join(" ")}
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
          disabled={feedback === "correct" || feedback === "revealed"}
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
      {feedback !== "correct" && feedback !== "revealed" && (
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
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
