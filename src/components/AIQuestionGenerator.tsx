"use client";

import { useState, useTransition } from "react";
import { createQuestionFromAI } from "@/actions/questions";

interface Category {
  id: number;
  name: string;
}

interface Subcategory {
  id: number;
  name: string;
}

interface GeneratedQuestion {
  questionText: string;
  answer: string;
  difficulty: "easy" | "intermediate" | "difficult";
  didYouKnow: string;
  subcategory?: string;
  suggestedSubcategoryId?: number | null;
}

const difficultyBadge = {
  easy: "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  difficult: "bg-red-100 text-red-700",
};

export default function AIQuestionGenerator({
  categories,
}: {
  categories: Category[];
}) {
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [questionSubcategoryIds, setQuestionSubcategoryIds] = useState<(number | null)[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleGenerate() {
    if (!categoryId) return;
    setError("");
    setMessage("");
    setQuestions([]);
    setSubcategories([]);
    setQuestionSubcategoryIds([]);
    setSelected(new Set());
    setLoading(true);

    try {
      const res = await fetch("/api/admin/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, count }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to generate questions");
        return;
      }

      setQuestions(data.questions);
      setSubcategories(data.subcategories || []);
      setQuestionSubcategoryIds(
        data.questions.map((q: GeneratedQuestion) => q.suggestedSubcategoryId ?? null)
      );
      // Select all by default
      setSelected(new Set(data.questions.map((_: GeneratedQuestion, i: number) => i)));
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === questions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(questions.map((_, i) => i)));
    }
  }

  function updateSubcategoryForQuestion(index: number, subcategoryId: number | null) {
    setQuestionSubcategoryIds((prev) => {
      const next = [...prev];
      next[index] = subcategoryId;
      return next;
    });
  }

  async function handleSave() {
    if (!categoryId || selected.size === 0) return;
    setError("");
    setMessage("");

    startTransition(async () => {
      let saved = 0;
      for (const index of selected) {
        const q = questions[index];
        const result = await createQuestionFromAI({
          questionText: q.questionText,
          answer: q.answer,
          categoryId: categoryId as number,
          subcategoryId: questionSubcategoryIds[index] || null,
          difficulty: q.difficulty,
          didYouKnow: q.didYouKnow,
        });
        if (result.success) saved++;
      }

      setMessage(`Saved ${saved} question${saved !== 1 ? "s" : ""} successfully.`);
      setQuestions([]);
      setSubcategories([]);
      setQuestionSubcategoryIds([]);
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">Select a category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Number of questions
            </label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={!categoryId || loading}
            className="px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </span>
            ) : (
              "Generate Questions"
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {/* Success */}
      {message && (
        <div className="p-3 rounded-lg text-sm bg-green-50 border border-green-200 text-green-700">
          {message}
        </div>
      )}

      {/* Results */}
      {questions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-800">
                Generated Questions ({questions.length})
              </h2>
              <button
                onClick={toggleAll}
                className="text-sm text-amber-600 hover:text-amber-700"
              >
                {selected.size === questions.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={selected.size === 0 || isPending}
              className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending
                ? "Saving..."
                : `Save Selected (${selected.size})`}
            </button>
          </div>

          {questions.map((q, i) => (
            <div
              key={i}
              onClick={() => toggleSelect(i)}
              className={`bg-white rounded-xl shadow-sm border-2 p-5 cursor-pointer transition-colors ${
                selected.has(i)
                  ? "border-amber-400 bg-amber-50/30"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(i); }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${difficultyBadge[q.difficulty]}`}>
                      {q.difficulty}
                    </span>
                    {subcategories.length > 0 && (
                      <select
                        value={questionSubcategoryIds[i] ?? ""}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateSubcategoryForQuestion(i, e.target.value ? Number(e.target.value) : null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs px-2 py-0.5 border border-slate-200 rounded-full bg-slate-50 text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      >
                        <option value="">No subcategory</option>
                        {subcategories.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="text-slate-800 font-medium">{q.questionText}</p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Answer:</span> {q.answer}
                  </p>
                  {q.didYouKnow && (
                    <p className="text-sm text-slate-500 italic">
                      <span className="font-medium not-italic text-slate-600">Did you know?</span>{" "}
                      {q.didYouKnow}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
