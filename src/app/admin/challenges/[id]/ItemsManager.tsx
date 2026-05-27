"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ChallengeItem } from "@/data/challengeGame";

interface Props {
  gameId: number;
  gameType: string;
  initialItems: ChallengeItem[];
}

interface InfographFields {
  born: string;
  died: string;
  origin: string;
  originCountryId: string;
  role: string;
  period: string;
  ghostText: string;
  caption: string;
  images: [string, string, string, string];
}

const DEFAULT_INFOGRAPH: InfographFields = {
  born: "", died: "", origin: "", originCountryId: "",
  role: "", period: "", ghostText: "", caption: "",
  images: ["", "", "", ""],
};

function parseInfograph(raw: string | null | undefined): InfographFields {
  if (!raw) return { ...DEFAULT_INFOGRAPH, images: ["", "", "", ""] };
  try {
    const p = JSON.parse(raw);
    const imgs: [string, string, string, string] = ["", "", "", ""];
    if (Array.isArray(p.images)) p.images.forEach((v: string, i: number) => { if (i < 4) imgs[i] = v ?? ""; });
    return {
      born:            p.born            ?? "",
      died:            p.died            ?? "",
      origin:          p.origin          ?? "",
      originCountryId: p.originCountryId != null ? String(p.originCountryId) : "",
      role:            p.role            ?? "",
      period:          p.period          ?? "",
      ghostText:       p.ghostText       ?? "",
      caption:         p.caption         ?? "",
      images:          imgs,
    };
  } catch { return { ...DEFAULT_INFOGRAPH, images: ["", "", "", ""] }; }
}

function serializeInfograph(ig: InfographFields): string | null {
  const hasAny = ig.born || ig.died || ig.origin || ig.originCountryId || ig.role || ig.period || ig.images.some(Boolean);
  if (!hasAny) return null;
  return JSON.stringify({
    born:            ig.born,
    died:            ig.died,
    origin:          ig.origin,
    originCountryId: ig.originCountryId ? Number(ig.originCountryId) : undefined,
    role:            ig.role,
    period:          ig.period,
    ghostText:       ig.ghostText || undefined,
    caption:         ig.caption   || undefined,
    images:          ig.images.filter(Boolean),
  });
}

function InfographEditor({ value, onChange }: { value: InfographFields; onChange: (v: InfographFields) => void }) {
  const [open, setOpen] = useState(false);
  const set = (key: keyof InfographFields, val: string) => onChange({ ...value, [key]: val });
  const setImg = (i: number, val: string) => {
    const imgs: [string, string, string, string] = [...value.images] as [string, string, string, string];
    imgs[i] = val;
    onChange({ ...value, images: imgs });
  };

  const inp = (label: string, key: keyof Omit<InfographFields, "images">, placeholder?: string, full?: boolean) => (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-slate-500 mb-0.5">{label}</label>
      <input
        value={value[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
      />
    </div>
  );

  return (
    <div className="col-span-2 border border-indigo-200 rounded bg-indigo-50/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
      >
        <span>Infograph data</span>
        <span className="text-indigo-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          {inp("Born", "born", "1889")}
          {inp("Died", "died", "1945")}
          {inp("Origin country", "origin", "Austria")}
          {inp("Country ID (ISO 3166-1 numeric)", "originCountryId", "40")}
          {inp("Role", "role", "Dictator of Nazi Germany", true)}
          {inp("Historical Period", "period", "World War II")}
          {inp("Ghost text", "ghostText", "WWII (optional)")}
          {inp("Caption", "caption", "Adolf Hitler · 1889–1945 (optional)", true)}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Images (paths relative to infograph/person/)</label>
            <div className="grid grid-cols-2 gap-1.5">
              {value.images.map((img, i) => (
                <input
                  key={i}
                  value={img}
                  onChange={(e) => setImg(i, e.target.value)}
                  placeholder={`images/photo-${i + 1}.jpg`}
                  className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({ gameId, item, gameType, onDeleted }: { gameId: number; item: ChallengeItem; gameType: string; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vals, setVals] = useState({ ...item });
  const [igraph, setIgraph] = useState<InfographFields>(() => parseInfograph(item.infographData));

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/challenges/${gameId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...vals, infographData: gameType === "matching" ? serializeInfograph(igraph) : undefined }),
    });
    setSaving(false);
    setEditing(false);
  }

  async function del() {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await fetch(`/api/admin/challenges/${gameId}/items/${item.id}`, { method: "DELETE" });
    onDeleted();
  }

  if (!editing) {
    return (
      <tr className="hover:bg-slate-50">
        <td className="px-3 py-2 text-slate-400 font-mono text-xs w-10">{item.position}</td>
        <td className="px-3 py-2">
          <div className="font-medium text-slate-800 text-sm">{item.name}</div>
          {gameType === "chronology" && <div className="text-slate-400 text-xs">{item.dates}</div>}
          {gameType === "puzzle" && <div className="text-slate-400 text-xs">{item.hint}</div>}
          {gameType === "matching" && item.infographData && (
            <div className="text-indigo-400 text-xs">infograph ✓</div>
          )}
        </td>
        <td className="px-3 py-2 max-w-xs">
          {item.imageUrl ? (
            <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs truncate block max-w-[200px]">{item.imageUrl}</a>
          ) : <span className="text-slate-300 text-xs">—</span>}
        </td>
        <td className="px-3 py-2 text-right text-xs space-x-3">
          <button onClick={() => setEditing(true)} className="text-amber-600 hover:text-amber-700 font-medium">Edit</button>
          <button onClick={del} className="text-red-500 hover:text-red-600 font-medium">Delete</button>
        </td>
      </tr>
    );
  }

  const field = (label: string, key: keyof ChallengeItem, placeholder?: string, full?: boolean) => (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-slate-600 mb-0.5">{label}</label>
      <input
        value={(vals[key] as string) ?? ""}
        onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
    </div>
  );

  return (
    <tr className="bg-amber-50">
      <td colSpan={4} className="px-3 py-3">
        <div className="grid grid-cols-2 gap-2 mb-2">
          {field("Position", "position")}
          {field("Name", "name")}
          {field("Image URL", "imageUrl", "https://...", true)}
          {field("Description EN", "descriptionEn", "", true)}
          {field("Description NL", "descriptionNl", "", true)}
          {(gameType === "chronology" || gameType === "matching") && field("Dates / Reign", "dates", "e.g. 27 BC–14 AD")}
          {gameType === "chronology" && field("Milestone EN", "milestoneEn", "Central milestone (English)", true)}
          {gameType === "chronology" && field("Milestone NL", "milestoneNl", "Central milestone (Dutch)", true)}
          {gameType === "matching" && field("Clue EN", "clueEn", "Matching clue (English)", true)}
          {gameType === "matching" && field("Clue NL", "clueNl", "Matching clue (Dutch)", true)}
          {gameType === "connections" && field("Answer / Match (EN)", "clueEn", "e.g. Leonardo da Vinci", true)}
          {gameType === "connections" && field("Answer / Match (NL)", "clueNl", "Dutch translation of answer", true)}
          {gameType === "puzzle" && field("Hint", "hint", "e.g. Athletics · Jamaica")}
          {gameType === "puzzle" && field("Achievement", "achievement", "e.g. 9 gold medals", true)}
          {gameType === "matching" && <InfographEditor value={igraph} onChange={setIgraph} />}
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-medium disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-medium">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function NewItemRow({ gameId, gameType, onCreated }: { gameId: number; gameType: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vals, setVals] = useState({ position: 1, name: "", imageUrl: "", descriptionEn: "", descriptionNl: "", dates: "", milestoneEn: "", milestoneNl: "", clueEn: "", clueNl: "", hint: "", achievement: "" });
  const [igraph, setIgraph] = useState<InfographFields>({ ...DEFAULT_INFOGRAPH, images: ["", "", "", ""] });

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/challenges/${gameId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...vals, infographData: gameType === "matching" ? serializeInfograph(igraph) : undefined }),
    });
    setSaving(false);
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={4} className="px-3 py-2">
          <button onClick={() => setOpen(true)} className="text-sm text-amber-600 hover:text-amber-700 font-medium">+ Add Item</button>
        </td>
      </tr>
    );
  }

  const field = (label: string, key: string, placeholder?: string, full?: boolean, type = "text") => (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-slate-600 mb-0.5">{label}</label>
      <input
        type={type}
        value={(vals as Record<string, unknown>)[key] as string ?? ""}
        onChange={(e) => setVals((v) => ({ ...v, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
    </div>
  );

  return (
    <tr className="bg-green-50">
      <td colSpan={4} className="px-3 py-3">
        <div className="grid grid-cols-2 gap-2 mb-2">
          {field("Position", "position", "1", false, "number")}
          {field("Name", "name", "Person name")}
          {field("Image URL", "imageUrl", "https://...", true)}
          {field("Description EN", "descriptionEn", "", true)}
          {field("Description NL", "descriptionNl", "", true)}
          {(gameType === "chronology" || gameType === "matching") && field("Dates / Reign", "dates", "e.g. 27 BC–14 AD")}
          {gameType === "chronology" && field("Milestone EN", "milestoneEn", "Central milestone (English)", true)}
          {gameType === "chronology" && field("Milestone NL", "milestoneNl", "Central milestone (Dutch)", true)}
          {gameType === "matching" && field("Clue EN", "clueEn", "Matching clue (English)", true)}
          {gameType === "matching" && field("Clue NL", "clueNl", "Matching clue (Dutch)", true)}
          {gameType === "connections" && field("Answer / Match (EN)", "clueEn", "e.g. Leonardo da Vinci", true)}
          {gameType === "connections" && field("Answer / Match (NL)", "clueNl", "Dutch translation of answer", true)}
          {gameType === "puzzle" && field("Hint", "hint", "e.g. Athletics · Jamaica")}
          {gameType === "puzzle" && field("Achievement", "achievement", "e.g. 9 gold medals", true)}
          {gameType === "matching" && <InfographEditor value={igraph} onChange={setIgraph} />}
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium disabled:opacity-50">
            {saving ? "Adding…" : "Add Item"}
          </button>
          <button onClick={() => setOpen(false)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-medium">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function ItemsManager({ gameId, gameType, initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setItems(initialItems); }, [initialItems]);

  function refresh() { router.refresh(); }

  function handleExport() {
    const data = items.map(({ position, name, imageUrl, descriptionEn, descriptionNl, dates, milestoneEn, milestoneNl, clueEn, clueNl, hint, achievement, infographData }) => ({
      position, name, imageUrl, descriptionEn, descriptionNl, dates, milestoneEn, milestoneNl, clueEn, clueNl, hint, achievement, infographData,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `challenge-${gameId}-items.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Expected a JSON array");
      if (data.length === 0) throw new Error("Array is empty");

      const confirmed = confirm(
        `Import ${data.length} item(s)?\n\nThis will DELETE all ${items.length} existing item(s) and replace them.`
      );
      if (!confirmed) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setImporting(true);

      const currentRes = await fetch(`/api/admin/challenges/${gameId}/items`);
      if (!currentRes.ok) throw new Error("Failed to fetch current items");
      const currentItems: ChallengeItem[] = await currentRes.json();

      await Promise.all(
        currentItems.map((item) =>
          fetch(`/api/admin/challenges/${gameId}/items/${item.id}`, { method: "DELETE" })
        )
      );

      for (const item of data) {
        const res = await fetch(`/api/admin/challenges/${gameId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (!res.ok) throw new Error(`Failed to create item "${item.name}"`);
      }

      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Invalid JSON");
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleExport}
          disabled={items.length === 0}
          className="px-3 py-1.5 text-xs font-medium border border-slate-300 text-slate-600 rounded hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          ↓ Export JSON
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="px-3 py-1.5 text-xs font-medium border border-blue-300 text-blue-600 rounded hover:bg-blue-50 disabled:opacity-40 transition-colors"
        >
          {importing ? "Importing…" : "↑ Import JSON"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
        {importError && (
          <p className="text-xs text-red-500 ml-2">{importError}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-10">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Image URL</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                gameId={gameId}
                item={item}
                gameType={gameType}
                onDeleted={refresh}
              />
            ))}
            <NewItemRow gameId={gameId} gameType={gameType} onCreated={refresh} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
