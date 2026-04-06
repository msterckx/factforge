"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { MapRegion } from "@/data/challengeGame";

interface Props {
  gameId: number;
  initialRegions: MapRegion[];
}

export default function MapRegionsManager({ gameId, initialRegions }: Props) {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [regions, setRegions] = useState(initialRegions);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setMsg("Select a CSV file first."); setIsError(true); return; }

    setLoading(true);
    setMsg(null);

    const fd = new FormData();
    fd.append("gameId", String(gameId));
    fd.append("file", file);

    const res = await fetch("/api/admin/map-regions/import", { method: "POST", body: fd });
    const data = await res.json();

    if (res.ok) {
      setMsg(`Imported ${data.inserted} regions.`);
      setIsError(false);
      router.refresh();
      // Reload regions optimistically — router.refresh() will re-render server component
      if (fileRef.current) fileRef.current.value = "";
    } else {
      setMsg(data.error ?? "Import failed");
      setIsError(true);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {/* Import section */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-sm file:bg-white file:text-slate-700 hover:file:bg-slate-50"
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
        CSV format: <code className="bg-slate-100 px-1 rounded">region_key,label_en,label_nl,capital_en,capital_nl</code>
        <br />
        <code className="bg-slate-100 px-1 rounded">region_key</code> must match an <code className="bg-slate-100 px-1 rounded">id</code> attribute in the SVG file.
        Importing replaces all existing regions for this game.
      </p>

      {/* Regions table */}
      {regions.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Key", "Label EN", "Label NL", "Capital EN", "Capital NL"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regions.map((r, i) => (
                <tr key={r.id} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                  <td className="px-4 py-1.5 font-mono text-xs text-slate-600">{r.regionKey}</td>
                  <td className="px-4 py-1.5 text-slate-700">{r.labelEn}</td>
                  <td className="px-4 py-1.5 text-slate-700">{r.labelNl}</td>
                  <td className="px-4 py-1.5 text-slate-500">{r.capitalEn ?? "—"}</td>
                  <td className="px-4 py-1.5 text-slate-500">{r.capitalNl ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {regions.length === 0 && (
        <p className="text-slate-400 text-sm italic">No regions imported yet.</p>
      )}
    </div>
  );
}
