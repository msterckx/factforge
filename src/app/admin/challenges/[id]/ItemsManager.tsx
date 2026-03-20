"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ChallengeItem } from "@/data/challengeGame";

interface Props {
  gameId: number;
  gameType: string;
  initialItems: ChallengeItem[];
}

function ItemRow({ gameId, item, gameType, onDeleted }: { gameId: number; item: ChallengeItem; gameType: string; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vals, setVals] = useState({ ...item });

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/challenges/${gameId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vals),
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
          {gameType === "chronology" && field("Dates / Reign", "dates", "e.g. 27 BC–14 AD")}
          {(gameType === "chronology" || gameType === "matching") && field(gameType === "matching" ? "Clue EN" : "Milestone EN", "milestoneEn", gameType === "matching" ? "Clue text (English)" : "Central milestone (English)", true)}
          {(gameType === "chronology" || gameType === "matching") && field(gameType === "matching" ? "Clue NL" : "Milestone NL", "milestoneNl", gameType === "matching" ? "Clue text (Dutch)" : "Central milestone (Dutch)", true)}
          {gameType === "puzzle" && field("Hint", "hint", "e.g. Athletics · Jamaica")}
          {gameType === "puzzle" && field("Achievement", "achievement", "e.g. 9 gold medals", true)}
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
  const [vals, setVals] = useState({ position: 1, name: "", imageUrl: "", descriptionEn: "", descriptionNl: "", dates: "", milestoneEn: "", milestoneNl: "", hint: "", achievement: "" });

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/challenges/${gameId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vals),
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
          {gameType === "chronology" && field("Dates / Reign", "dates", "e.g. 27 BC–14 AD")}
          {(gameType === "chronology" || gameType === "matching") && field(gameType === "matching" ? "Clue EN" : "Milestone EN", "milestoneEn", gameType === "matching" ? "Clue text (English)" : "Central milestone (English)", true)}
          {(gameType === "chronology" || gameType === "matching") && field(gameType === "matching" ? "Clue NL" : "Milestone NL", "milestoneNl", gameType === "matching" ? "Clue text (Dutch)" : "Central milestone (Dutch)", true)}
          {gameType === "puzzle" && field("Hint", "hint", "e.g. Athletics · Jamaica")}
          {gameType === "puzzle" && field("Achievement", "achievement", "e.g. 9 gold medals", true)}
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

  // Keep items in sync when the server re-renders after router.refresh()
  useEffect(() => { setItems(initialItems); }, [initialItems]);

  function refresh() { router.refresh(); }

  function handleExport() {
    const data = items.map(({ position, name, imageUrl, descriptionEn, descriptionNl, dates, milestoneEn, milestoneNl, hint, achievement }) => ({
      position, name, imageUrl, descriptionEn, descriptionNl, dates, milestoneEn, milestoneNl, hint, achievement,
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

      // Fetch current items fresh from DB so we delete the actual live records,
      // not whatever is cached in local state from a previous import.
      const currentRes = await fetch(`/api/admin/challenges/${gameId}/items`);
      if (!currentRes.ok) throw new Error("Failed to fetch current items");
      const currentItems: ChallengeItem[] = await currentRes.json();

      // Delete all current items
      await Promise.all(
        currentItems.map((item) =>
          fetch(`/api/admin/challenges/${gameId}/items/${item.id}`, { method: "DELETE" })
        )
      );

      // Create new items sequentially to preserve order
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
