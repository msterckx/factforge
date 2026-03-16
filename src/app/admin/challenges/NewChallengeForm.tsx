"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { GeneratedChallengeItem } from "@/lib/openai";

type GameType = "chronology" | "puzzle" | "quiz";

interface CategoryOption { id: number; name: string; subcategories: { id: number; name: string }[] }

interface FormState {
  slug: string;
  gameType: GameType;
  icon: string;
  category: string;
  titleEn: string;
  titleNl: string;
  subtitleEn: string;
  subtitleNl: string;
  sortOrder: number;
  available: boolean;
  quizCategoryId: number | null;
  quizSubcategoryId: number | null;
  quizQuestionLimit: number | null;
}

const empty: FormState = {
  slug: "", gameType: "chronology", icon: "🎮", category: "history",
  titleEn: "", titleNl: "", subtitleEn: "", subtitleNl: "", sortOrder: 0, available: true,
  quizCategoryId: null, quizSubcategoryId: null, quizQuestionLimit: null,
};

export default function NewChallengeForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(empty);
  const [items, setItems] = useState<GeneratedChallengeItem[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dbCategories, setDbCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    fetch("/api/admin/categories").then((r) => r.json()).then(setDbCategories).catch(() => {});
  }, []);

  const selectedCategory = dbCategories.find((c) => c.id === form.quizCategoryId);
  const availableSubcategories = selectedCategory?.subcategories ?? [];

  function set(key: keyof FormState, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleGenerate() {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/challenges/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt, gameType: form.gameType }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        setError(error ?? "Generation failed");
        return;
      }
      const data = await res.json();
      setForm({
        slug:              data.slug       ?? "",
        gameType:          form.gameType,
        icon:              data.icon       ?? "🎮",
        category:          data.category   ?? "other",
        titleEn:           data.titleEn    ?? "",
        titleNl:           data.titleNl    ?? "",
        subtitleEn:        data.subtitleEn ?? "",
        subtitleNl:        data.subtitleNl ?? "",
        sortOrder:         0,
        available:         true,
        quizCategoryId:    null,
        quizSubcategoryId: null,
        quizQuestionLimit: null,
      });
      setItems((data.items ?? []).map((item: GeneratedChallengeItem, i: number) => ({ ...item, position: i + 1 })));
    } catch {
      setError("Network error during generation");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!form.slug || !form.titleEn || !form.titleNl) {
      setError("slug, Title EN and Title NL are required");
      return;
    }
    setSaving(true);
    setError("");

    // 1. Create the game
    const gameRes = await fetch("/api/admin/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quizCategoryId:    form.quizCategoryId    ?? null,
        quizSubcategoryId: form.quizSubcategoryId ?? null,
        quizQuestionLimit: form.quizQuestionLimit  ?? null,
      }),
    });
    if (!gameRes.ok) {
      const { error } = await gameRes.json();
      setError(error ?? "Failed to create game");
      setSaving(false);
      return;
    }
    const game = await gameRes.json();

    // 2. Create all items sequentially
    for (const item of items) {
      await fetch(`/api/admin/challenges/${game.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
    }

    router.push(`/admin/challenges/${game.id}`);
  }

  function updateItem(index: number, key: keyof GeneratedChallengeItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [key]: value } : item));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i + 1 })));
  }

  function addItem() {
    setItems((prev) => [...prev, {
      position: prev.length + 1,
      name: "", imageUrl: "", descriptionEn: "", descriptionNl: "",
      ...(form.gameType === "chronology" ? { dates: "", fact: "" } : { hint: "", achievement: "" }),
    }]);
  }

  const field = (label: string, value: string | number, onChange: (v: string) => void, placeholder = "", type = "text") => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── AI Assist ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
          <span>✨</span> Generate with AI
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Game Type</label>
            <select
              value={form.gameType}
              onChange={(e) => set("gameType", e.target.value as GameType)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            >
              <option value="chronology">Chronology — put people/events in order</option>
              <option value="puzzle">Puzzle — reassemble portrait images</option>
              <option value="quiz">Quiz — questions from an existing category</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Describe your challenge topic</label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={form.gameType === "chronology"
                ? "e.g. The key leaders of the French Revolution in chronological order"
                : "e.g. 6 legendary tennis champions for an image puzzle"}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !aiPrompt.trim()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Generating…
              </>
            ) : "Generate challenge"}
          </button>
        </div>
      </div>

      {/* ── Game metadata ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {field("Slug *", form.slug, (v) => set("slug", v), "e.g. french-revolution")}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="history">History</option>
            <option value="science">Science</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Icon <span className="text-slate-400 font-normal">(emoji or image URL)</span></label>
          <input
            value={form.icon}
            onChange={(e) => set("icon", e.target.value)}
            placeholder="🎮 or https://…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        {field("Sort Order", form.sortOrder, (v) => set("sortOrder", Number(v)), "0", "number")}
        {field("Title (EN) *", form.titleEn, (v) => set("titleEn", v), "The French Revolution")}
        {field("Title (NL) *", form.titleNl, (v) => set("titleNl", v), "De Franse Revolutie")}
        {field("Subtitle (EN)", form.subtitleEn, (v) => set("subtitleEn", v), "Order these leaders chronologically")}
        {field("Subtitle (NL)", form.subtitleNl, (v) => set("subtitleNl", v), "Zet deze leiders in chronologische volgorde")}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select value={String(form.available)} onChange={(e) => set("available", e.target.value === "true")}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="true">Live</option>
            <option value="false">Hidden</option>
          </select>
        </div>
      </div>

      {/* ── Quiz-specific config ───────────────────────────────────── */}
      {form.gameType === "quiz" && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">Quiz Source</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
              <select
                value={form.quizCategoryId ?? ""}
                onChange={(e) => { set("quizCategoryId", e.target.value ? Number(e.target.value) : null); set("quizSubcategoryId", null); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">— select category —</option>
                {dbCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subcategory <span className="text-slate-400 font-normal">(optional)</span></label>
              <select
                value={form.quizSubcategoryId ?? ""}
                onChange={(e) => set("quizSubcategoryId", e.target.value ? Number(e.target.value) : null)}
                disabled={!availableSubcategories.length}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
              >
                <option value="">— all subcategories —</option>
                {availableSubcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Question limit <span className="text-slate-400 font-normal">(optional, blank = all)</span></label>
              <input
                type="number"
                min={1}
                value={form.quizQuestionLimit ?? ""}
                onChange={(e) => set("quizQuestionLimit", e.target.value ? Number(e.target.value) : null)}
                placeholder="e.g. 10"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Items list ─────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">{items.length} Items</h3>
            <button onClick={addItem} className="text-xs text-amber-600 hover:text-amber-700 font-medium">+ Add item</button>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-500">#{item.position} — {item.name || "Unnamed"}</span>
                  <button onClick={() => removeItem(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ItemInput label="Name" value={item.name} onChange={(v) => updateItem(i, "name", v)} />
                  <ItemInput label="Image URL" value={item.imageUrl} onChange={(v) => updateItem(i, "imageUrl", v)} placeholder="https://..." />
                  {form.gameType === "chronology" && (
                    <>
                      <ItemInput label="Dates / Reign" value={item.dates ?? ""} onChange={(v) => updateItem(i, "dates", v)} placeholder="e.g. 1751–1793" />
                      <ItemInput label="Fact" value={item.fact ?? ""} onChange={(v) => updateItem(i, "fact", v)} placeholder="Key one-line fact" full />
                    </>
                  )}
                  {form.gameType === "puzzle" && (
                    <>
                      <ItemInput label="Hint" value={item.hint ?? ""} onChange={(v) => updateItem(i, "hint", v)} placeholder="e.g. Tennis · Switzerland" />
                      <ItemInput label="Achievement" value={item.achievement ?? ""} onChange={(v) => updateItem(i, "achievement", v)} placeholder="e.g. 20 Grand Slam titles" full />
                    </>
                  )}
                  <ItemInput label="Description (EN)" value={item.descriptionEn} onChange={(v) => updateItem(i, "descriptionEn", v)} full />
                  <ItemInput label="Description (NL)" value={item.descriptionNl} onChange={(v) => updateItem(i, "descriptionNl", v)} full />
                </div>
              </div>
            ))}
          </div>
          <button onClick={addItem} className="mt-2 text-xs text-amber-600 hover:text-amber-700 font-medium">+ Add item</button>
        </div>
      )}

      {items.length === 0 && form.titleEn && (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
          <p className="text-sm text-slate-400 mb-2">No items yet</p>
          <button onClick={addItem} className="text-sm text-amber-600 hover:text-amber-700 font-medium">+ Add item manually</button>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* ── Save ──────────────────────────────────────────────────── */}
      {(form.titleEn || items.length > 0) && (
        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? `Saving (${items.length} items)…` : `Create Challenge${items.length ? ` with ${items.length} items` : ""}`}
          </button>
          <button
            onClick={() => { setForm(empty); setItems([]); setAiPrompt(""); setError(""); }}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function ItemInput({ label, value, onChange, placeholder = "", full = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-slate-600 mb-0.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
    </div>
  );
}
