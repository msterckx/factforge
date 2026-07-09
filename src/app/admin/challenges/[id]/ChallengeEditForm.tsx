"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ChallengeGame } from "@/data/challengeGame";
import {
  type InfographTemplateField,
  parseInfographTemplate,
  serializeInfographTemplate,
} from "./InfographAdminEditor";

interface CategoryOption { id: number; name: string; slug: string; subcategories: { id: number; name: string }[] }
interface MapOption { label: string; value: string }

export default function ChallengeEditForm({ game }: { game: ChallengeGame }) {
  const router = useRouter();
  const svgFileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [gameType, setGameType] = useState(game.gameType);
  const [category, setCategory] = useState(game.category);
  const [startingLives, setStartingLives] = useState(game.startingLives ?? 5);
  const [quizCategoryId, setQuizCategoryId] = useState<number | null>(game.quizCategoryId ?? null);
  const [quizSubcategoryId, setQuizSubcategoryId] = useState<number | null>(game.quizSubcategoryId ?? null);
  const [dbCategories, setDbCategories] = useState<CategoryOption[]>([]);
  const [mapOptions, setMapOptions] = useState<MapOption[]>([]);
  const [mapSvg, setMapSvg] = useState(game.mapSvg ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [titleEn, setTitleEn] = useState(game.titleEn);
  const [titleNl, setTitleNl] = useState(game.titleNl);
  const [subtitleEn, setSubtitleEn] = useState(game.subtitleEn);
  const [subtitleNl, setSubtitleNl] = useState(game.subtitleNl);
  const [translatingTitle, setTranslatingTitle] = useState(false);
  const [translatingSubtitle, setTranslatingSubtitle] = useState(false);
  const [infographTemplate, setInfographTemplate] = useState<InfographTemplateField[]>(
    () => parseInfographTemplate(game.infographFields)
  );

  useEffect(() => {
    fetch("/api/admin/categories").then((r) => r.json()).then(setDbCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (gameType === "map") {
      fetch("/api/admin/maps").then((r) => r.json()).then((d) => setMapOptions(d.maps ?? [])).catch(() => {});
    }
  }, [gameType]);

  async function handleSvgUpload() {
    const file = svgFileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/maps/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      setUploadMsg({ text: `Uploaded: ${data.filename}`, error: false });
      // Refresh map list and auto-select the new map
      const listRes = await fetch("/api/admin/maps");
      const listData = await listRes.json();
      setMapOptions(listData.maps ?? []);
      setMapSvg(data.path);
      if (svgFileRef.current) svgFileRef.current.value = "";
    } else {
      setUploadMsg({ text: data.error ?? "Upload failed", error: true });
    }
    setUploading(false);
  }

  async function translateField(text: string, setLoading: (v: boolean) => void, setNl: (v: string) => void) {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok) setNl(data.text);
    } finally {
      setLoading(false);
    }
  }

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
      category,
      titleEn,
      titleNl,
      subtitleEn,
      subtitleNl,
      available:         fd.get("available") === "true",
      sortOrder:         Number(fd.get("sortOrder")),
      quizCategoryId:    quizCategoryId,
      quizSubcategoryId: quizSubcategoryId,
      quizQuestionLimit: fd.get("quizQuestionLimit") ? Number(fd.get("quizQuestionLimit")) : null,
      startingLives:     startingLives,
      connectionsLeftLabelEn:  fd.get("connectionsLeftLabelEn")  || null,
      connectionsLeftLabelNl:  fd.get("connectionsLeftLabelNl")  || null,
      connectionsRightLabelEn: fd.get("connectionsRightLabelEn") || null,
      connectionsRightLabelNl: fd.get("connectionsRightLabelNl") || null,
      mapSvg:                  fd.get("mapSvg")       || null,
      mapLabelMode:            fd.get("mapLabelMode") || null,
      infographFields:         serializeInfographTemplate(infographTemplate),
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
            <option value="connections">Connections</option>
            <option value="map">Map</option>
            <option value="map_quiz">Map Quiz</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Icon <span className="text-slate-400 font-normal">(emoji or image URL)</span></label>
          <input name="icon" defaultValue={game.icon} placeholder="🎮 or https://…" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            {dbCategories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
            <option value="other">Other</option>
          </select>
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title (EN)</label>
            <input
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Title (NL)</label>
              <button
                type="button"
                onClick={() => translateField(titleEn, setTranslatingTitle, setTitleNl)}
                disabled={translatingTitle || !titleEn.trim()}
                className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {translatingTitle ? "Translating…" : "Auto-translate"}
              </button>
            </div>
            <input
              value={titleNl}
              onChange={(e) => setTitleNl(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Subtitle (EN) <span className="text-slate-400 font-normal">— used for SEO</span></label>
          <textarea
            value={subtitleEn}
            onChange={(e) => setSubtitleEn(e.target.value)}
            rows={4}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
          />
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Subtitle (NL)</label>
            <button
              type="button"
              onClick={() => translateField(subtitleEn, setTranslatingSubtitle, setSubtitleNl)}
              disabled={translatingSubtitle || !subtitleEn.trim()}
              className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {translatingSubtitle ? "Translating…" : "Auto-translate"}
            </button>
          </div>
          <textarea
            value={subtitleNl}
            onChange={(e) => setSubtitleNl(e.target.value)}
            rows={4}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
          />
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

      {/* Connections column labels */}
      {gameType === "connections" && (
        <div className="border border-violet-200 bg-violet-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-violet-800">Column Labels <span className="font-normal text-violet-600">(optional)</span></p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Left column (EN)</label>
              <input name="connectionsLeftLabelEn" defaultValue={game.connectionsLeftLabelEn ?? ""} placeholder="e.g. Works of Art" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Left column (NL)</label>
              <input name="connectionsLeftLabelNl" defaultValue={game.connectionsLeftLabelNl ?? ""} placeholder="e.g. Kunstwerken" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Right column (EN)</label>
              <input name="connectionsRightLabelEn" defaultValue={game.connectionsRightLabelEn ?? ""} placeholder="e.g. Artists" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Right column (NL)</label>
              <input name="connectionsRightLabelNl" defaultValue={game.connectionsRightLabelNl ?? ""} placeholder="e.g. Kunstenaars" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
        </div>
      )}

      {/* Map config */}
      {(gameType === "map" || gameType === "map_quiz") && (
        <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-emerald-800">Map Settings</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Map file <span className="text-slate-400 font-normal">(.svg or .geojson)</span></label>
              {/* Hidden input so the value is submitted with the form */}
              <input type="hidden" name="mapSvg" value={mapSvg} />
              <select
                value={mapSvg}
                onChange={(e) => setMapSvg(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {mapSvg && !mapOptions.find((o) => o.value === mapSvg) && (
                  <option value={mapSvg}>{mapSvg}</option>
                )}
                {mapOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Label mode</label>
              <select
                name="mapLabelMode"
                defaultValue={game.mapLabelMode ?? "country"}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="country">Country names</option>
                <option value="capital">Capitals</option>
                <option value="both">Both (country + capital chips)</option>
              </select>
            </div>
          </div>

          {/* Upload a new map file */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label className="text-xs text-slate-500 font-medium flex-shrink-0">Upload map file:</label>
            <input
              ref={svgFileRef}
              type="file"
              accept=".svg,image/svg+xml,.geojson,application/geo+json"
              className="text-sm text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-sm file:bg-white file:text-slate-700 hover:file:bg-slate-50"
            />
            <button
              type="button"
              onClick={handleSvgUpload}
              disabled={uploading}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            {uploadMsg && (
              <span className={`text-xs ${uploadMsg.error ? "text-red-600" : "text-emerald-700"}`}>
                {uploadMsg.text}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Infograph field template */}
      {(gameType === "matching" || gameType === "chronology" || gameType === "map" || gameType === "map_quiz") && (
        <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-indigo-800">Infograph field template</p>
            <p className="text-xs text-indigo-500 mt-0.5">
              Define the fields once here; each item only needs values. ★ marks an accent field — its value becomes the top label on the panel.
            </p>
          </div>
          <div className="space-y-1.5">
            {infographTemplate.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Field label (e.g. Born)"
                  value={f.label}
                  onChange={(e) => {
                    const t = [...infographTemplate];
                    t[i] = { ...t[i], label: e.target.value };
                    setInfographTemplate(t);
                  }}
                />
                <label className="flex items-center gap-1 text-xs text-slate-600 flex-shrink-0 cursor-pointer" title="Show progress bar">
                  <input
                    type="checkbox"
                    checked={!!f.showBar}
                    className="w-3.5 h-3.5"
                    onChange={(e) => {
                      const t = [...infographTemplate];
                      t[i] = { ...t[i], showBar: e.target.checked };
                      setInfographTemplate(t);
                    }}
                  />
                  Bar
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-600 flex-shrink-0 cursor-pointer" title="Accent — value becomes top label">
                  <input
                    type="checkbox"
                    checked={!!f.accent}
                    className="w-3.5 h-3.5"
                    onChange={(e) => {
                      const t = [...infographTemplate];
                      t[i] = { ...t[i], accent: e.target.checked };
                      setInfographTemplate(t);
                    }}
                  />
                  ★
                </label>
                <button
                  type="button"
                  onClick={() => setInfographTemplate(infographTemplate.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setInfographTemplate([...infographTemplate, { label: "" }])}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            + Add field
          </button>
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
