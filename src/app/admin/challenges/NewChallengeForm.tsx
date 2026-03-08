"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewChallengeForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const body = {
      slug:       fd.get("slug"),
      gameType:   fd.get("gameType"),
      icon:       fd.get("icon") || "🎮",
      category:   fd.get("category"),
      titleEn:    fd.get("titleEn"),
      titleNl:    fd.get("titleNl"),
      subtitleEn: fd.get("subtitleEn") || "",
      subtitleNl: fd.get("subtitleNl") || "",
      available:  fd.get("available") === "true",
      sortOrder:  Number(fd.get("sortOrder") || 0),
    };
    const res = await fetch("/api/admin/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      router.refresh();
      (e.target as HTMLFormElement).reset();
    } else {
      const { error } = await res.json();
      setError(error ?? "Failed to create challenge");
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Slug <span className="text-red-500">*</span></label>
        <input name="slug" required placeholder="my-challenge" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Game Type <span className="text-red-500">*</span></label>
        <select name="gameType" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="chronology">Chronology</option>
          <option value="puzzle">Puzzle</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
        <input name="icon" placeholder="🎮" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
        <select name="category" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="history">History</option>
          <option value="science">Science</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Title (EN) <span className="text-red-500">*</span></label>
        <input name="titleEn" required placeholder="My Challenge" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Title (NL) <span className="text-red-500">*</span></label>
        <input name="titleNl" required placeholder="Mijn Uitdaging" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Subtitle (EN)</label>
        <input name="subtitleEn" placeholder="Short description" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Subtitle (NL)</label>
        <input name="subtitleNl" placeholder="Korte omschrijving" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
        <input name="sortOrder" type="number" defaultValue="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Available</label>
        <select name="available" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="true">Live</option>
          <option value="false">Hidden</option>
        </select>
      </div>
      {error && <p className="col-span-2 text-red-600 text-sm">{error}</p>}
      <div className="col-span-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? "Creating…" : "Create Challenge"}
        </button>
      </div>
    </form>
  );
}
