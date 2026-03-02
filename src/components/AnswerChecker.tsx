"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { checkAnswer } from "@/lib/utils";
import Image from "next/image";
import type { Dictionary } from "@/i18n/en";

interface Question {
  id: number;
  questionText: string;
  answer: string;
  imagePath: string | null;
  didYouKnow: string | null;
  difficulty: "easy" | "intermediate" | "difficult";
  subcategoryId?: number | null;
}

interface Subcategory {
  id: number;
  name: string;
}

const difficultyStyles = {
  easy: "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  difficult: "bg-red-100 text-red-700",
};

interface AnswerCheckerProps {
  questions: Question[];
  categoryName: string;
  subcategories?: Subcategory[];
  dict: Dictionary;
}

type FeedbackState = "idle" | "correct" | "incorrect" | "revealed";
type ViewMode = "quiz" | "list";

const LIST_PAGE_SIZE = 10;

export default function AnswerChecker({ questions, categoryName, subcategories = [], dict }: AnswerCheckerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("quiz");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | null>(null);
  const [listPage, setListPage] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!selectedSubcategoryId) return questions;
    return questions.filter((q) => q.subcategoryId === selectedSubcategoryId);
  }, [questions, selectedSubcategoryId]);

  const total = filtered.length;
  const question = filtered[currentIndex];

  // Reset both modes when filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setUserAnswer("");
    setFeedback("idle");
    setListPage(1);
  }, [selectedSubcategoryId]);

  useEffect(() => {
    setUserAnswer("");
    setFeedback("idle");
    inputRef.current?.focus();
  }, [currentIndex]);

  function handleCheck() {
    if (!userAnswer.trim()) return;
    if (checkAnswer(userAnswer, question.answer)) {
      setFeedback("correct");
    } else {
      setFeedback("incorrect");
    }
  }

  function handleShow() {
    setFeedback("revealed");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && feedback === "idle") {
      handleCheck();
    }
  }

  function switchMode(mode: ViewMode) {
    setViewMode(mode);
    setListPage(1);
    setCurrentIndex(0);
    setUserAnswer("");
    setFeedback("idle");
  }

  // List pagination
  const totalListPages = Math.ceil(total / LIST_PAGE_SIZE);
  const listStart = (listPage - 1) * LIST_PAGE_SIZE;
  const listItems = filtered.slice(listStart, listStart + LIST_PAGE_SIZE);

  return (
    <div className="max-w-2xl mx-auto">
      {/* View mode toggle */}
      <div className="flex items-center gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => switchMode("quiz")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            viewMode === "quiz"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {dict.quiz.quizMode}
        </button>
        <button
          onClick={() => switchMode("list")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            viewMode === "list"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {dict.quiz.listMode}
        </button>
      </div>

      {/* Subcategory filter */}
      {subcategories.length > 0 && (
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedSubcategoryId(null)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              selectedSubcategoryId === null
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
            }`}
          >
            {dict.quiz.all}
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setSelectedSubcategoryId(sub.id)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                selectedSubcategoryId === sub.id
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {total === 0 ? (
        <p className="text-slate-400 text-center py-12">
          {dict.quiz.noQuestionsInSubcategory}
        </p>
      ) : viewMode === "list" ? (
        /* ── LIST VIEW ── */
        <>
          <div className="flex flex-col gap-3 mb-6">
            {listItems.map((q, i) => (
              <div key={q.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <span className="text-sm text-slate-400 font-medium shrink-0 mt-0.5">
                    {listStart + i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${difficultyStyles[q.difficulty]}`}>
                        {q.difficulty}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium mb-3">{q.questionText}</p>
                    {q.imagePath && (
                      <div className="relative w-full aspect-video mb-3 rounded-lg overflow-hidden bg-slate-100">
                        <Image
                          src={q.imagePath}
                          alt="Question image"
                          fill
                          className="object-contain"
                          sizes="(max-width: 672px) 100vw, 672px"
                        />
                      </div>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide shrink-0">
                        {dict.quiz.answerLabel}:
                      </span>
                      <span className="text-amber-700 font-semibold">{q.answer}</span>
                    </div>
                    {q.didYouKnow && (
                      <p className="mt-2 text-xs text-slate-500 italic">{q.didYouKnow}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* List pagination */}
          {totalListPages > 1 && (
            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <button
                onClick={() => setListPage((p) => p - 1)}
                disabled={listPage === 1}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {dict.quiz.previous}
              </button>
              <span className="text-sm text-slate-500">
                {listPage} / {totalListPages}
              </span>
              <button
                onClick={() => setListPage((p) => p + 1)}
                disabled={listPage === totalListPages}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {dict.quiz.next}
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── QUIZ VIEW ── */
        <>
          {/* Progress */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-slate-500">
              {dict.quiz.questionOf
                .replace("{current}", String(currentIndex + 1))
                .replace("{total}", String(total))}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${difficultyStyles[question.difficulty]}`}>
                {question.difficulty}
              </span>
              <span className="text-sm font-medium text-slate-700">{categoryName}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-1.5 mb-8">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
            />
          </div>

          {/* Image */}
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
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={dict.quiz.typeYourAnswer}
              disabled={feedback === "correct" || feedback === "revealed"}
              className="w-full px-4 py-3.5 border border-slate-300 rounded-lg text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          {/* Feedback */}
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

          {/* Did You Know */}
          {(feedback === "correct" || feedback === "revealed") && question.didYouKnow && (
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <p className="text-sm font-semibold text-indigo-700 mb-1">{dict.quiz.didYouKnow}</p>
              <p className="text-sm text-indigo-600">{question.didYouKnow}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            {feedback !== "correct" && feedback !== "revealed" && (
              <>
                <button
                  onClick={handleCheck}
                  disabled={!userAnswer.trim()}
                  className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {dict.quiz.checkAnswer}
                </button>
                <button
                  onClick={handleShow}
                  className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
                >
                  {dict.quiz.showAnswer}
                </button>
              </>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-200">
            <button
              onClick={() => setCurrentIndex((i) => i - 1)}
              disabled={currentIndex === 0}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {dict.quiz.previous}
            </button>
            <button
              onClick={() => setCurrentIndex((i) => i + 1)}
              disabled={currentIndex === total - 1}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {dict.quiz.next}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
