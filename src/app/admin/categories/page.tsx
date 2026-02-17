"use client";

import { useEffect, useState, useTransition } from "react";
import { createCategory, updateCategory, deleteCategory, getCategoriesWithCounts } from "@/actions/categories";
import {
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  getSubcategoriesWithCounts,
} from "@/actions/subcategories";

interface Category {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
  questionCount: number;
}

interface Subcategory {
  id: number;
  name: string;
  slug: string;
  categoryId: number;
  questionCount: number;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Subcategory state
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [editSubName, setEditSubName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [catData, subData] = await Promise.all([
      getCategoriesWithCounts(),
      getSubcategoriesWithCounts(),
    ]);
    setCategories(catData);
    setSubcategories(subData);
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  function getSubsForCategory(categoryId: number) {
    return subcategories.filter((s) => s.categoryId === categoryId);
  }

  // Category handlers
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("name", newName);

    startTransition(async () => {
      const result = await createCategory(formData);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        showMessage("success", "Category created.");
        setNewName("");
        await loadData();
      }
    });
  }

  async function handleUpdate(id: number) {
    const formData = new FormData();
    formData.set("name", editName);

    startTransition(async () => {
      const result = await updateCategory(id, formData);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        showMessage("success", "Category updated.");
        setEditingId(null);
        await loadData();
      }
    });
  }

  async function handleDelete(id: number, name: string, questionCount: number) {
    const subCount = getSubsForCategory(id).length;
    const parts = [];
    if (questionCount > 0) parts.push(`${questionCount} question(s)`);
    if (subCount > 0) parts.push(`${subCount} subcategory(ies)`);
    const extra = parts.length > 0 ? ` and its ${parts.join(" and ")}` : "";
    const msg = `Delete "${name}"${extra}? This cannot be undone.`;

    if (!confirm(msg)) return;

    startTransition(async () => {
      await deleteCategory(id);
      showMessage("success", "Category deleted.");
      if (expandedCategory === id) setExpandedCategory(null);
      await loadData();
    });
  }

  // Subcategory handlers
  async function handleCreateSub(categoryId: number, e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("name", newSubName);
    formData.set("categoryId", String(categoryId));

    startTransition(async () => {
      const result = await createSubcategory(formData);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        showMessage("success", "Subcategory created.");
        setNewSubName("");
        await loadData();
      }
    });
  }

  async function handleUpdateSub(id: number) {
    const formData = new FormData();
    formData.set("name", editSubName);

    startTransition(async () => {
      const result = await updateSubcategory(id, formData);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        showMessage("success", "Subcategory updated.");
        setEditingSubId(null);
        await loadData();
      }
    });
  }

  async function handleDeleteSub(id: number, name: string, questionCount: number) {
    const msg = questionCount > 0
      ? `Delete subcategory "${name}"? ${questionCount} question(s) will lose their subcategory assignment.`
      : `Delete subcategory "${name}"?`;

    if (!confirm(msg)) return;

    startTransition(async () => {
      await deleteSubcategory(id);
      showMessage("success", "Subcategory deleted.");
      await loadData();
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Manage Categories</h1>

      {/* Add form */}
      <form onSubmit={handleCreate} className="flex gap-3 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name..."
          required
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          Add Category
        </button>
      </form>

      {/* Feedback */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-8"></th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Slug</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">Questions</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">Subcategories</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          {categories.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  No categories yet. Add one above.
                </td>
              </tr>
            </tbody>
          ) : (
            categories.map((cat) => {
              const subs = getSubsForCategory(cat.id);
              const isExpanded = expandedCategory === cat.id;

              return (
                <tbody key={cat.id}>
                    <tr className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                          title={isExpanded ? "Collapse" : "Expand subcategories"}
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === cat.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate(cat.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium text-slate-800">{cat.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{cat.slug}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{cat.questionCount}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{subs.length}</td>
                      <td className="px-4 py-3 text-right">
                        {editingId === cat.id ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleUpdate(cat.id)}
                              disabled={isPending}
                              className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 bg-slate-200 text-slate-600 text-xs rounded hover:bg-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => {
                                setEditingId(cat.id);
                                setEditName(cat.name);
                              }}
                              className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(cat.id, cat.name, cat.questionCount)}
                              disabled={isPending}
                              className="px-3 py-1 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Subcategories panel */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-slate-50 px-4 py-4">
                          <div className="ml-8">
                            <div className="flex items-center gap-2 mb-3">
                              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Subcategories for {cat.name}
                              </h3>
                            </div>

                            {/* Add subcategory form */}
                            <form
                              onSubmit={(e) => handleCreateSub(cat.id, e)}
                              className="flex gap-2 mb-3"
                            >
                              <input
                                type="text"
                                value={newSubName}
                                onChange={(e) => setNewSubName(e.target.value)}
                                placeholder="New subcategory name..."
                                required
                                className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                              />
                              <button
                                type="submit"
                                disabled={isPending}
                                className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                              >
                                Add
                              </button>
                            </form>

                            {/* Subcategories list */}
                            {subs.length === 0 ? (
                              <p className="text-xs text-slate-400">No subcategories yet.</p>
                            ) : (
                              <div className="space-y-1">
                                {subs.map((sub) => (
                                  <div
                                    key={sub.id}
                                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200"
                                  >
                                    <div className="flex items-center gap-3">
                                      {editingSubId === sub.id ? (
                                        <input
                                          type="text"
                                          value={editSubName}
                                          onChange={(e) => setEditSubName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") handleUpdateSub(sub.id);
                                            if (e.key === "Escape") setEditingSubId(null);
                                          }}
                                          className="px-2 py-0.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
                                          autoFocus
                                        />
                                      ) : (
                                        <>
                                          <span className="text-sm font-medium text-slate-700">{sub.name}</span>
                                          <span className="text-xs text-slate-400">{sub.slug}</span>
                                          <span className="text-xs text-slate-400">
                                            {sub.questionCount} question{sub.questionCount !== 1 ? "s" : ""}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      {editingSubId === sub.id ? (
                                        <>
                                          <button
                                            onClick={() => handleUpdateSub(sub.id)}
                                            disabled={isPending}
                                            className="px-2 py-0.5 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50"
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={() => setEditingSubId(null)}
                                            className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded hover:bg-slate-300"
                                          >
                                            Cancel
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => {
                                              setEditingSubId(sub.id);
                                              setEditSubName(sub.name);
                                            }}
                                            className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteSub(sub.id, sub.name, sub.questionCount)}
                                            disabled={isPending}
                                            className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100 disabled:opacity-50"
                                          >
                                            Delete
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                </tbody>
              );
            })
          )}
        </table>
      </div>
    </div>
  );
}
