"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface Category { id: number; name: string; }
interface SubcategoryItem { id: number; name: string; categoryId: number; }

interface Props {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  currentPage: number;
  totalPages: number;
  canEdit: boolean;
  categories: Category[];
  subcategoriesData: SubcategoryItem[];
  filterCategory: number | null;
  filterSubcategory: number | null;
}

// Columns that are never editable even in edit mode
const READONLY_COLS: Record<string, string[]> = {
  questions:             ["id", "created_at", "updated_at"],
  question_translations: ["id", "question_id", "language", "created_at", "updated_at"],
};

const DIFFICULTY_OPTIONS = ["easy", "intermediate", "difficult"];

export default function DatabaseTableClient({
  tableName,
  columns,
  rows: initialRows,
  totalRows,
  currentPage,
  totalPages,
  canEdit,
  categories,
  subcategoriesData,
  filterCategory,
  filterSubcategory,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const [rows,       setRows]       = useState(initialRows);
  const [editingId,  setEditingId]  = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);

  const readonlyCols = READONLY_COLS[tableName] ?? columns;

  // ── Filter navigation ───────────────────────────────────────────────────
  function buildHref(opts: { category?: number | null; subcategory?: number | null; page?: number }) {
    const p = new URLSearchParams({ table: tableName, page: String(opts.page ?? 1) });
    const cat = opts.category !== undefined ? opts.category : filterCategory;
    const sub = opts.subcategory !== undefined ? opts.subcategory : filterSubcategory;
    if (cat) p.set("category", String(cat));
    if (sub) p.set("subcategory", String(sub));
    return `${pathname}?${p}`;
  }

  function navigate(opts: { category?: number | null; subcategory?: number | null; page?: number }) {
    router.push(buildHref(opts));
  }

  // ── Edit helpers ────────────────────────────────────────────────────────
  function startEdit(row: Record<string, unknown>) {
    const vals: Record<string, string> = {};
    for (const col of columns) {
      const v = row[col];
      vals[col] = v === null || v === undefined ? "" : String(v);
    }
    setEditingId(row.id as number);
    setEditValues(vals);
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({});
    setSaveError(null);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    setSaveError(null);
    try {
      const editable = columns.filter((c) => !readonlyCols.includes(c));
      const body: Record<string, unknown> = {};
      for (const col of editable) {
        const raw = editValues[col];
        body[col] = raw === "" ? null : raw;
      }
      // Coerce numeric FK fields
      if (tableName === "questions") {
        if (body.category_id    !== null) body.category_id    = Number(body.category_id);
        if (body.subcategory_id !== null) body.subcategory_id = Number(body.subcategory_id);
      }
      if (tableName === "question_translations" && "is_auto_translated" in body && body.is_auto_translated !== null) {
        body.is_auto_translated = Number(body.is_auto_translated);
      }

      const res = await fetch(`/api/admin/database/${tableName}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Update failed");
      }
      // Optimistically update the row in local state
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, ...Object.fromEntries(Object.entries(editValues).map(([k, v]) => [k, v === "" ? null : v])) }
            : r
        )
      );
      setEditingId(null);
      setEditValues({});
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ── Cell renderer ───────────────────────────────────────────────────────
  function renderCell(col: string, val: unknown, row: Record<string, unknown>) {
    const rowId = row.id as number;
    const isEditing = editingId === rowId;

    if (isEditing && !readonlyCols.includes(col)) {
      const currentVal = editValues[col] ?? "";

      if (col === "category_id" && tableName === "questions") {
        return (
          <select
            value={currentVal}
            onChange={(e) => setEditValues((p) => ({ ...p, category_id: e.target.value, subcategory_id: "" }))}
            className="text-xs border border-amber-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 min-w-[110px]"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        );
      }

      if (col === "subcategory_id" && tableName === "questions") {
        const activeCatId = Number(editValues.category_id);
        const subs = subcategoriesData.filter((s) => s.categoryId === activeCatId);
        return (
          <select
            value={currentVal}
            onChange={(e) => setEditValues((p) => ({ ...p, [col]: e.target.value }))}
            className="text-xs border border-amber-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 min-w-[110px]"
          >
            <option value="">— none —</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        );
      }

      if (col === "difficulty") {
        return (
          <select
            value={currentVal}
            onChange={(e) => setEditValues((p) => ({ ...p, [col]: e.target.value }))}
            className="text-xs border border-amber-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        );
      }

      if (col === "is_auto_translated") {
        return (
          <select
            value={currentVal}
            onChange={(e) => setEditValues((p) => ({ ...p, [col]: e.target.value }))}
            className="text-xs border border-amber-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="1">1 (auto)</option>
            <option value="0">0 (manual)</option>
          </select>
        );
      }

      // Default: text input (long text gets a wider input)
      const isLongText = ["question_text", "answer", "did_you_know"].includes(col);
      return (
        <input
          type="text"
          value={currentVal}
          onChange={(e) => setEditValues((p) => ({ ...p, [col]: e.target.value }))}
          className={`text-xs border border-amber-300 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 w-full ${isLongText ? "min-w-[220px]" : "min-w-[100px]"}`}
        />
      );
    }

    // Read-only display
    const display = val === null || val === undefined ? null : String(val);
    if (display === null) return <span className="text-slate-300 italic text-xs">null</span>;
    return <span className="block truncate max-w-xs" title={display}>{display}</span>;
  }

  return (
    <>
      {/* ── Filter bar (questions / question_translations only) ────────── */}
      {canEdit && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select
            value={filterCategory ?? ""}
            onChange={(e) => navigate({ category: e.target.value ? Number(e.target.value) : null, subcategory: null })}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {filterCategory && (
            <select
              value={filterSubcategory ?? ""}
              onChange={(e) => navigate({ subcategory: e.target.value ? Number(e.target.value) : null })}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            >
              <option value="">All Subcategories</option>
              {subcategoriesData
                .filter((s) => s.categoryId === filterCategory)
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
          )}

          {(filterCategory || filterSubcategory) && (
            <button
              onClick={() => navigate({ category: null, subcategory: null })}
              className="text-sm text-slate-500 hover:text-slate-800 underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Meta bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 text-sm text-slate-500">
        <span>
          <span className="font-medium text-slate-700">{totalRows.toLocaleString()}</span> rows
          {totalPages > 1 && (
            <> &mdash; page <span className="font-medium text-slate-700">{currentPage}</span> of {totalPages}</>
          )}
        </span>
        <span>{columns.length} columns</span>
      </div>

      {/* ── Save error ────────────────────────────────────────────────── */}
      {saveError && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {saveError}
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
              {canEdit && (
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap w-28" />
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (canEdit ? 1 : 0)} className="px-4 py-10 text-center text-slate-400">
                  No rows
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const rowId  = row.id as number;
                const isEdit = editingId === rowId;
                return (
                  <tr
                    key={rowId ?? i}
                    className={`border-b border-slate-100 last:border-0 ${
                      isEdit ? "bg-amber-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    }`}
                  >
                    {columns.map((col) => (
                      <td key={col} className="px-4 py-2 text-slate-700 whitespace-nowrap max-w-xs align-top">
                        {renderCell(col, row[col], row)}
                      </td>
                    ))}
                    {canEdit && (
                      <td className="px-4 py-2 text-right align-top">
                        {isEdit ? (
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => saveEdit(rowId)}
                              disabled={saving}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded disabled:opacity-50 transition-colors"
                            >
                              {saving ? "…" : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded disabled:opacity-50 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(row)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded transition-colors"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <a
            href={buildHref({ page: currentPage - 1 })}
            className={`px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 transition-colors ${
              currentPage === 1
                ? "opacity-40 pointer-events-none bg-white text-slate-400"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Previous
          </a>
          <span className="text-sm text-slate-500">{currentPage} / {totalPages}</span>
          <a
            href={buildHref({ page: currentPage + 1 })}
            className={`px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 transition-colors ${
              currentPage === totalPages
                ? "opacity-40 pointer-events-none bg-white text-slate-400"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Next
          </a>
        </div>
      )}
    </>
  );
}
