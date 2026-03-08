"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChallengeGame } from "@/data/challengeGame";

export default function ChallengeEditForm({ game }: { game: ChallengeGame }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    const body = {
      slug:       fd.get("slug"),
      gameType:   fd.get("gameType"),
      icon:       fd.get("icon"),
      category:   fd.get("category"),
      titleEn:    fd.get("titleEn"),
      titleNl:    fd.get("titleNl"),
      subtitleEn: fd.get("subtitleEn"),
      subtitleNl: fd.get("subtitleNl"),
      available:  fd.get("available") === "true",
      sortOrder:  Number(fd.get("sortOrder")),
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
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
        <input name="slug" defaultValue={game.slug} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Game Type</label>
        <select name="gameType" defaultValue={game.gameType} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="chronology">Chronology</option>
          <option value="puzzle">Puzzle</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
        <input name="icon" defaultValue={game.icon} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
        <select name="category" defaultValue={game.category} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="history">History</option>
          <option value="science">Science</option>
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
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
        <select name="available" defaultValue={String(game.available)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="true">Live</option>
          <option value="false">Hidden</option>
        </select>
      </div>
      {error && <p className="col-span-2 text-red-600 text-sm">{error}</p>}
      {success && <p className="col-span-2 text-green-600 text-sm">Saved!</p>}
      <div className="col-span-2 flex gap-3">
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
