"use client";

import { useEffect, useState, useTransition } from "react";
import { createCategory, updateCategory, deleteCategory, getCategoriesWithCounts } from "@/actions/categories";

interface Category {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
  questionCount: number;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    const data = await getCategoriesWithCounts();
    setCategories(data);
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

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
        await loadCategories();
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
        await loadCategories();
      }
    });
  }

  async function handleDelete(id: number, name: string, questionCount: number) {
    const msg = questionCount > 0
      ? `Delete "${name}" and its ${questionCount} question(s)? This cannot be undone.`
      : `Delete "${name}"? This cannot be undone.`;

    if (!confirm(msg)) return;

    startTransition(async () => {
      await deleteCategory(id);
      showMessage("success", "Category deleted.");
      await loadCategories();
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
              <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Slug</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">Questions</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-400">
                  No categories yet. Add one above.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-b border-slate-100 last:border-0">
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
