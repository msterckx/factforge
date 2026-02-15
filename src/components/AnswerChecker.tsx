"use client";

import { useState, useEffect, useRef } from "react";
import { checkAnswer } from "@/lib/utils";
import Image from "next/image";

interface Question {
  id: number;
  questionText: string;
  answer: string;
  imagePath: string | null;
  didYouKnow: string | null;
  difficulty: "easy" | "intermediate" | "difficult";
}

const difficultyStyles = {
  easy: "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  difficult: "bg-red-100 text-red-700",
};

interface AnswerCheckerProps {
  questions: Question[];
  categoryName: string;
}

type FeedbackState = "idle" | "correct" | "incorrect" | "revealed";

export default function AnswerChecker({ questions, categoryName }: AnswerCheckerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const question = questions[currentIndex];
  const total = questions.length;

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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-slate-500">
          Question {currentIndex + 1} of {total}
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
          placeholder="Type your answer..."
          disabled={feedback === "correct" || feedback === "revealed"}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>

      {/* Feedback */}
      {feedback === "correct" && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 font-medium">Correct!</p>
        </div>
      )}
      {feedback === "incorrect" && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">Incorrect. Try again or show the answer.</p>
        </div>
      )}
      {feedback === "revealed" && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800">
            The answer is: <span className="font-bold">{question.answer}</span>
          </p>
        </div>
      )}

      {/* Did You Know */}
      {(feedback === "correct" || feedback === "revealed") && question.didYouKnow && (
        <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="text-sm font-semibold text-indigo-700 mb-1">Did you know?</p>
          <p className="text-sm text-indigo-600">{question.didYouKnow}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mb-8">
        {feedback !== "correct" && feedback !== "revealed" && (
          <>
            <button
              onClick={handleCheck}
              disabled={!userAnswer.trim()}
              className="px-6 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Check Answer
            </button>
            <button
              onClick={handleShow}
              className="px-6 py-2.5 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
            >
              Show Answer
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-4 border-t border-slate-200">
        <button
          onClick={() => setCurrentIndex((i) => i - 1)}
          disabled={currentIndex === 0}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => setCurrentIndex((i) => i + 1)}
          disabled={currentIndex === total - 1}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
