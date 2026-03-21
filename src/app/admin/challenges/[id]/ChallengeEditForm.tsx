"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ChallengeGame } from "@/data/challengeGame";

interface CategoryOption { id: number; name: string; subcategories: { id: number; name: string }[] }

export default function ChallengeEditForm({ game }: { game: ChallengeGame }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [gameType, setGameType] = useState(game.gameType);
  const [startingLives, setStartingLives] = useState(game.startingLives ?? 5);
  const [quizCategoryId, setQuizCategoryId] = useState<number | null>(game.quizCategoryId ?? null);
  const [quizSubcategoryId, setQuizSubcategoryId] = useState<number | null>(game.quizSubcategoryId ?? null);
  const [dbCategories, setDbCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    fetch("/api/admin/categories").then((r) => r.json()).then(setDbCategories).catch(() => {});
  }, []);

  const selectedCategory = dbCategories.find((c) => c.id === quizCategoryId);
  const availableSubcategories = selectedCategory?.subcategories ?? [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    const body = {
      slug:              fd.get("slug"),
      gameType,
      icon:              fd.get("icon"),
      category:          fd.get("category"),
      titleEn:           fd.get("titleEn"),
      titleNl:           fd.get("titleNl"),
      subtitleEn:        fd.get("subtitleEn"),
      subtitleNl:        fd.get("subtitleNl"),
      available:         fd.get("available") === "true",
      sortOrder:         Number(fd.get("sortOrder")),
      quizCategoryId:    quizCategoryId,
      quizSubcategoryId: quizSubcategoryId,
      quizQuestionLimit: fd.get("quizQuestionLimit") ? Number(fd.get("quizQuestionLimit")) : null,
      startingLives:     startingLives,
    };
    const res = await fetch(`/api/admin/challenges/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setSuccess(true);
      router.refresh();
    } else {
      const { error } = await res.json();
      setError(error ?? "Failed to save");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${game.titleEn}" and all its items? This cannot be undone.`)) return;
    await fetch(`/api/admin/challenges/${game.id}`, { method: "DELETE" });
    router.push("/admin/challenges");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
          <input name="slug" defaultValue={game.slug} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Game Type</label>
          <select name="gameType" value={gameType} onChange={(e) => setGameType(e.target.value as typeof gameType)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="chronology">Chronology</option>
            <option value="matching">Matching</option>
            <option value="puzzle">Puzzle</option>
            <option value="quiz">Quiz</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Icon <span className="text-slate-400 font-normal">(emoji or image URL)</span></label>
          <input name="icon" defaultValue={game.icon} placeholder="🎮 or https://…" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select name="category" defaultValue={game.category} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="geography">Geography</option>
            <option value="history">History</option>
            <option value="television">Television</option>
            <option value="science">Science</option>
            <option value="sports">Sports</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title (EN)</label>
          <input name="titleEn" defaultValue={game.titleEn} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title (NL)</label>
          <input name="titleNl" defaultValue={game.titleNl} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subtitle (EN)</label>
          <input name="subtitleEn" defaultValue={game.subtitleEn} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subtitle (NL)</label>
          <input name="subtitleNl" defaultValue={game.subtitleNl} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
          <input name="sortOrder" type="number" defaultValue={game.sortOrder} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        {(gameType === "chronology" || gameType === "matching") && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Starting Lives <span className="text-slate-400 font-normal">(wrong placements allowed)</span></label>
            <input
              type="number"
              min={1}
              max={20}
              value={startingLives}
              onChange={(e) => setStartingLives(Math.max(1, Number(e.target.value)))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select name="available" defaultValue={String(game.available)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="true">Live</option>
            <option value="false">Hidden</option>
          </select>
        </div>
      </div>

      {/* Quiz source config */}
      {gameType === "quiz" && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">Quiz Source</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
              <select
                value={quizCategoryId ?? ""}
                onChange={(e) => { setQuizCategoryId(e.target.value ? Number(e.target.value) : null); setQuizSubcategoryId(null); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">— select category —</option>
                {dbCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subcategory <span className="text-slate-400 font-normal">(optional)</span></label>
              <select
                value={quizSubcategoryId ?? ""}
                onChange={(e) => setQuizSubcategoryId(e.target.value ? Number(e.target.value) : null)}
                disabled={!availableSubcategories.length}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
              >
                <option value="">— all subcategories —</option>
                {availableSubcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Question limit <span className="text-slate-400 font-normal">(blank = all)</span></label>
              <input
                name="quizQuestionLimit"
                type="number"
                min={1}
                defaultValue={game.quizQuestionLimit ?? ""}
                placeholder="e.g. 10"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">Saved!</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium">
          Delete Game
        </button>
      </div>
    </form>
  );
}
