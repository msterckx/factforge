"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { MapRegion } from "@/data/challengeGame";

interface Props {
  gameId: number;
  initialRegions: MapRegion[];
}

type EditState = {
  id: number;
  labelEn: string; labelNl: string;
  capitalEn: string; capitalNl: string;
  infoImageEn: string; infoImageNl: string;
  infoTextEn: string; infoTextNl: string;
};

type AddState = {
  regionKey: string; labelEn: string; labelNl: string;
  capitalEn: string; capitalNl: string;
  infoImageEn: string; infoImageNl: string;
  infoTextEn: string; infoTextNl: string;
};

const EMPTY_ADD: AddState = {
  regionKey: "", labelEn: "", labelNl: "", capitalEn: "", capitalNl: "",
  infoImageEn: "", infoImageNl: "", infoTextEn: "", infoTextNl: "",
};

export default function MapRegionsManager({ gameId, initialRegions }: Props) {
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);
  const [regions, setRegions]     = useState(initialRegions);
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState<string | null>(null);
  const [isError, setIsError]     = useState(false);
  const [editing, setEditing]     = useState<EditState | null>(null);
  const [adding, setAdding]       = useState(false);
  const [addForm, setAddForm]     = useState<AddState>(EMPTY_ADD);
  const [savingId, setSavingId]   = useState<number | null>(null);

  const enabledCount = regions.filter((r) => r.enabled).length;

  function flash(text: string, error = false) {
    setMsg(text); setIsError(error);
  }

  /* ── Load Africa defaults ─────────────────────────────────────────── */
  async function handleLoadDefaults() {
    if (!confirm("This will replace all existing regions with the Africa defaults. Continue?")) return;
    setLoading(true); setMsg(null);
    const res  = await fetch("/api/admin/map-regions/load-defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId }),
    });
    const data = await res.json();
    if (res.ok) {
      flash(`Loaded ${data.inserted} default regions.`);
      router.refresh();
    } else {
      flash(data.error ?? "Failed to load defaults", true);
    }
    setLoading(false);
  }

  /* ── CSV Import ───────────────────────────────────────────────────── */
  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) { flash("Select a CSV file first.", true); return; }
    setLoading(true); setMsg(null);
    const fd = new FormData();
    fd.append("gameId", String(gameId));
    fd.append("file", file);
    const res  = await fetch("/api/admin/map-regions/import", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      flash(`Imported ${data.inserted} regions.`);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } else {
      flash(data.error ?? "Import failed", true);
    }
    setLoading(false);
  }

  /* ── Bulk enable/disable ──────────────────────────────────────────── */
  async function handleBulkToggle(enabled: boolean) {
    setLoading(true); setMsg(null);
    const res = await fetch("/api/admin/map-regions/toggle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, enabled }),
    });
    if (res.ok) {
      setRegions((prev) => prev.map((r) => ({ ...r, enabled })));
      flash(enabled ? "All regions enabled." : "All regions disabled.");
    } else {
      flash("Toggle failed.", true);
    }
    setLoading(false);
  }

  /* ── Toggle single region ─────────────────────────────────────────── */
  async function handleToggleOne(id: number, enabled: boolean) {
    const res = await fetch("/api/admin/map-regions/toggle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], enabled }),
    });
    if (res.ok) {
      setRegions((prev) => prev.map((r) => r.id === id ? { ...r, enabled } : r));
    } else {
      flash("Toggle failed.", true);
    }
  }

  /* ── Delete ───────────────────────────────────────────────────────── */
  async function handleDelete(id: number) {
    if (!confirm("Delete this region?")) return;
    const res = await fetch(`/api/admin/map-regions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRegions((prev) => prev.filter((r) => r.id !== id));
      flash("Region deleted.");
    } else {
      flash("Delete failed.", true);
    }
  }

  /* ── Save edit ────────────────────────────────────────────────────── */
  async function handleSaveEdit() {
    if (!editing) return;
    setSavingId(editing.id);
    const res  = await fetch(`/api/admin/map-regions/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labelEn:     editing.labelEn,
        labelNl:     editing.labelNl,
        capitalEn:   editing.capitalEn   || null,
        capitalNl:   editing.capitalNl   || null,
        infoImageEn: editing.infoImageEn || null,
        infoImageNl: editing.infoImageNl || null,
        infoTextEn:  editing.infoTextEn  || null,
        infoTextNl:  editing.infoTextNl  || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setRegions((prev) => prev.map((r) => r.id === editing.id ? data : r));
      setEditing(null);
      flash("Region saved.");
    } else {
      flash(data.error ?? "Save failed.", true);
    }
    setSavingId(null);
  }

  /* ── Add row ──────────────────────────────────────────────────────── */
  async function handleAdd() {
    if (!addForm.regionKey || !addForm.labelEn || !addForm.labelNl) {
      flash("Region key, label EN, and label NL are required.", true); return;
    }
    setSavingId(-1);
    const res  = await fetch("/api/admin/map-regions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        regionKey:   addForm.regionKey,
        labelEn:     addForm.labelEn,
        labelNl:     addForm.labelNl,
        capitalEn:   addForm.capitalEn   || null,
        capitalNl:   addForm.capitalNl   || null,
        infoImageEn: addForm.infoImageEn || null,
        infoImageNl: addForm.infoImageNl || null,
        infoTextEn:  addForm.infoTextEn  || null,
        infoTextNl:  addForm.infoTextNl  || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setRegions((prev) => [...prev, data].sort((a, b) => a.regionKey.localeCompare(b.regionKey)));
      setAddForm(EMPTY_ADD);
      setAdding(false);
      flash("Region added.");
    } else {
      flash(data.error ?? "Add failed.", true);
    }
    setSavingId(null);
  }

  const tdCls = "px-3 py-1.5";
  const inputCls = "w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400";
  const textareaCls = "w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y min-h-[60px]";

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleLoadDefaults}
          disabled={loading}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading…" : "Load Africa defaults"}
        </button>

        <span className="text-slate-300 hidden sm:inline">|</span>

        <label className="text-xs text-slate-500 font-medium">CSV import:</label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="text-sm text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-sm file:bg-white file:text-slate-700 hover:file:bg-slate-50"
        />
        <button
          onClick={handleImport}
          disabled={loading}
          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? "Importing…" : "Import CSV"}
        </button>

        {msg && (
          <span className={`text-sm ${isError ? "text-red-600" : "text-emerald-600"}`}>{msg}</span>
        )}
      </div>

      <p className="text-xs text-slate-400">
        CSV format: <code className="bg-slate-100 px-1 rounded">region_key,label_en,label_nl,capital_en,capital_nl</code>.
        Importing replaces all existing regions.
      </p>

      {/* Enable / disable bulk controls */}
      {regions.length > 0 && (
        <div className="flex items-center gap-3 py-2 border-y border-slate-100">
          <span className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{enabledCount}</span> / {regions.length} enabled
          </span>
          <button
            onClick={() => handleBulkToggle(false)}
            disabled={loading || enabledCount === 0}
            className="px-3 py-1 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg disabled:opacity-40 transition-colors"
          >
            Disable all
          </button>
          <button
            onClick={() => handleBulkToggle(true)}
            disabled={loading || enabledCount === regions.length}
            className="px-3 py-1 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg disabled:opacity-40 transition-colors"
          >
            Enable all
          </button>
        </div>
      )}

      {/* Regions table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["On", "Key", "Label EN", "Label NL", "Capital EN", "Capital NL", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regions.map((r, i) => {
              const isEdit = editing?.id === r.id;
              const rowCls = `border-b border-slate-100 last:border-0 ${r.enabled ? (i % 2 === 0 ? "bg-white" : "bg-slate-50/50") : "bg-slate-100/70 opacity-60"}`;
              return (
                <>
                  <tr key={r.id} className={rowCls}>
                    {/* Enabled toggle */}
                    <td className={tdCls}>
                      <button
                        onClick={() => handleToggleOne(r.id, !r.enabled)}
                        title={r.enabled ? "Disable" : "Enable"}
                        className={`w-9 h-5 rounded-full transition-colors ${r.enabled ? "bg-emerald-500" : "bg-slate-300"} relative`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${r.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </td>
                    <td className={`${tdCls} font-mono text-xs text-slate-600`}>{r.regionKey}</td>
                    {isEdit ? (
                      <>
                        <td className={tdCls}><input className={inputCls} value={editing.labelEn} onChange={(e) => setEditing({ ...editing, labelEn: e.target.value })} /></td>
                        <td className={tdCls}><input className={inputCls} value={editing.labelNl} onChange={(e) => setEditing({ ...editing, labelNl: e.target.value })} /></td>
                        <td className={tdCls}><input className={inputCls} value={editing.capitalEn} onChange={(e) => setEditing({ ...editing, capitalEn: e.target.value })} /></td>
                        <td className={tdCls}><input className={inputCls} value={editing.capitalNl} onChange={(e) => setEditing({ ...editing, capitalNl: e.target.value })} /></td>
                        <td className={`${tdCls} whitespace-nowrap`}>
                          <button onClick={handleSaveEdit} disabled={savingId === r.id} className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded mr-1 disabled:opacity-50">
                            {savingId === r.id ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditing(null)} className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded">
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={`${tdCls} text-slate-700`}>{r.labelEn}</td>
                        <td className={`${tdCls} text-slate-700`}>{r.labelNl}</td>
                        <td className={`${tdCls} text-slate-500`}>{r.capitalEn ?? "—"}</td>
                        <td className={`${tdCls} text-slate-500`}>{r.capitalNl ?? "—"}</td>
                        <td className={`${tdCls} whitespace-nowrap`}>
                          <button
                            onClick={() => setEditing({ id: r.id, labelEn: r.labelEn, labelNl: r.labelNl, capitalEn: r.capitalEn ?? "", capitalNl: r.capitalNl ?? "", infoImageEn: r.infoImageEn ?? "", infoImageNl: r.infoImageNl ?? "", infoTextEn: r.infoTextEn ?? "", infoTextNl: r.infoTextNl ?? "" })}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded mr-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs rounded"
                          >
                            Del
                          </button>
                        </td>
                      </>
                    )}
                  </tr>

                  {/* Extra info row when editing */}
                  {isEdit && (
                    <tr key={`${r.id}-info`} className="bg-indigo-50/40 border-b border-slate-100">
                      <td colSpan={7} className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Extra info (shown after correct drop)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Image URL (EN)</label>
                            <input
                              className={inputCls}
                              placeholder="https://… or /images/…"
                              value={editing.infoImageEn}
                              onChange={(e) => setEditing({ ...editing, infoImageEn: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Image URL (NL)</label>
                            <input
                              className={inputCls}
                              placeholder="https://… or /images/… (leave blank to use EN)"
                              value={editing.infoImageNl}
                              onChange={(e) => setEditing({ ...editing, infoImageNl: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Info text (EN)</label>
                            <textarea
                              className={textareaCls}
                              placeholder="Interesting fact in English…"
                              value={editing.infoTextEn}
                              onChange={(e) => setEditing({ ...editing, infoTextEn: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Info text (NL)</label>
                            <textarea
                              className={textareaCls}
                              placeholder="Interessant feit in het Nederlands…"
                              value={editing.infoTextNl}
                              onChange={(e) => setEditing({ ...editing, infoTextNl: e.target.value })}
                            />
                          </div>
                        </div>
                        {/* Preview */}
                        {(editing.infoImageEn || editing.infoTextEn) && (
                          <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Preview (EN)</p>
                            {editing.infoImageEn && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={editing.infoImageEn} alt="" className="h-24 object-cover rounded mb-2" />
                            )}
                            {editing.infoTextEn && (
                              <p className="text-sm text-slate-700">{editing.infoTextEn}</p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}

            {/* Add row */}
            {adding ? (
              <>
                <tr className="bg-indigo-50/50 border-b border-slate-100">
                  <td className={tdCls} />
                  <td className={tdCls}>
                    <input className={`${inputCls} font-mono`} placeholder="e.g. NG" value={addForm.regionKey} onChange={(e) => setAddForm({ ...addForm, regionKey: e.target.value.toUpperCase() })} maxLength={6} />
                  </td>
                  <td className={tdCls}><input className={inputCls} placeholder="English name" value={addForm.labelEn} onChange={(e) => setAddForm({ ...addForm, labelEn: e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} placeholder="Dutch name" value={addForm.labelNl} onChange={(e) => setAddForm({ ...addForm, labelNl: e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} placeholder="Capital EN" value={addForm.capitalEn} onChange={(e) => setAddForm({ ...addForm, capitalEn: e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} placeholder="Capital NL" value={addForm.capitalNl} onChange={(e) => setAddForm({ ...addForm, capitalNl: e.target.value })} /></td>
                  <td className={`${tdCls} whitespace-nowrap`}>
                    <button onClick={handleAdd} disabled={savingId === -1} className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded mr-1 disabled:opacity-50">
                      {savingId === -1 ? "…" : "Add"}
                    </button>
                    <button onClick={() => { setAdding(false); setAddForm(EMPTY_ADD); }} className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded">
                      Cancel
                    </button>
                  </td>
                </tr>
                {/* Extra info for add form */}
                <tr className="bg-indigo-50/30 border-b border-slate-100">
                  <td colSpan={7} className="px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Extra info (optional — shown after correct drop)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Image URL (EN)</label>
                        <input className={inputCls} placeholder="https://…" value={addForm.infoImageEn} onChange={(e) => setAddForm({ ...addForm, infoImageEn: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Image URL (NL)</label>
                        <input className={inputCls} placeholder="https://… (leave blank to use EN)" value={addForm.infoImageNl} onChange={(e) => setAddForm({ ...addForm, infoImageNl: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Info text (EN)</label>
                        <textarea className={textareaCls} placeholder="Interesting fact…" value={addForm.infoTextEn} onChange={(e) => setAddForm({ ...addForm, infoTextEn: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Info text (NL)</label>
                        <textarea className={textareaCls} placeholder="Interessant feit…" value={addForm.infoTextNl} onChange={(e) => setAddForm({ ...addForm, infoTextNl: e.target.value })} />
                      </div>
                    </div>
                  </td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
      </div>

      {regions.length === 0 && !adding && (
        <p className="text-slate-400 text-sm italic">No regions yet. Load defaults or import a CSV.</p>
      )}

      <button
        onClick={() => { setAdding(true); setEditing(null); }}
        className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm rounded-lg transition-colors"
      >
        + Add region
      </button>
    </div>
  );
}
