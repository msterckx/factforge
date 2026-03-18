"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Question {
  id: number;
  questionText: string;
  answer: string;
  difficulty: "easy" | "intermediate" | "difficult";
  subcategoryName: string | null;
}

interface Props {
  gameId: number;
  initialSelectedIds: number[] | null; // null = all selected
}

const difficultyStyles = {
  easy:         "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  difficult:    "bg-red-100 text-red-700",
};

export default function QuizQuestionSelector({ gameId, initialSelectedIds }: Props) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected]   = useState<Set<number> | null>(null); // null = not yet loaded
  const [saving,   setSaving]     = useState(false);
  const [saved,    setSaved]      = useState(false);
  const [loading,  setLoading]    = useState(true);

  useEffect(() => {
    fetch(`/api/admin/challenges/${gameId}/questions`)
      .then((r) => r.json())
      .then(({ questions: qs }: { questions: Question[] }) => {
        setQuestions(qs);
        // If no selection was saved yet, default to all selected
        const ids = initialSelectedIds ?? qs.map((q) => q.id);
        setSelected(new Set(ids));
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  function toggle(id: number) {
    setSelected((prev) => {
      if (!prev) return prev;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSaved(false);
  }

  function toggleAll() {
    if (!selected) return;
    const allSelected = selected.size === questions.length;
    setSelected(allSelected ? new Set() : new Set(questions.map((q) => q.id)));
    setSaved(false);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaved(false);
    // If all are selected, store null (= no restriction)
    const ids = selected.size === questions.length ? null : [...selected];
    await fetch(`/api/admin/challenges/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizQuestionIds: ids === null ? null : JSON.stringify(ids) }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  if (loading) return <p className="text-sm text-slate-400">Loading questions…</p>;
  if (questions.length === 0) return (
    <p className="text-sm text-slate-400">No questions found. Set a Quiz Source category above first.</p>
  );

  const allSelected = selected?.size === questions.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{selected?.size ?? 0}</span> / {questions.length} questions included
        </p>
        <button
          onClick={toggleAll}
          className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden mb-4 max-h-96 overflow-y-auto">
        {questions.map((q, i) => {
          const isSelected = selected?.has(q.id) ?? true;
          return (
            <label
              key={q.id}
              className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-white hover:bg-slate-50" : "bg-slate-50 hover:bg-slate-100"}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(q.id)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-mono text-slate-400 mr-1">#{i + 1}</span>
                <span className={`text-sm ${isSelected ? "text-slate-800" : "text-slate-400"}`}>
                  {q.questionText}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${difficultyStyles[q.difficulty]}`}>
                    {q.difficulty}
                  </span>
                  {q.subcategoryName && (
                    <span className="text-[10px] text-slate-400">{q.subcategoryName}</span>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || selected?.size === 0}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save Selection"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
        {selected?.size === 0 && <span className="text-sm text-red-500">Select at least one question.</span>}
      </div>
    </div>
  );
}
