"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { deleteQuestion } from "@/actions/questions";

interface Question {
  id: number;
  questionText: string;
  answer: string;
  categoryId: number;
  categoryName: string;
  imagePath: string | null;
}

interface Category {
  id: number;
  name: string;
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const res = await fetch("/api/admin/questions");
    const data = await res.json();
    setQuestions(data.questions);
    setCategories(data.categories);
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this question? This cannot be undone.")) return;

    startTransition(async () => {
      await deleteQuestion(id);
      showMessage("success", "Question deleted.");
      await loadData();
    });
  }

  const filtered = filterCategory
    ? questions.filter((q) => q.categoryId === filterCategory)
    : questions;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Questions</h1>
        <Link
          href="/admin/questions/new"
          className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
        >
          Add Question
        </Link>
      </div>

      {/* Category filter */}
      <div className="mb-4">
        <select
          value={filterCategory || ""}
          onChange={(e) => setFilterCategory(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-12">Img</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Question</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Answer</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400">
                  No questions yet.{" "}
                  <Link href="/admin/questions/new" className="text-amber-500 hover:underline">
                    Add one
                  </Link>
                </td>
              </tr>
            ) : (
              filtered.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    {q.imagePath ? (
                      <div className="relative w-10 h-10 rounded overflow-hidden bg-slate-100">
                        <Image
                          src={q.imagePath}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-300 text-xs">
                        --
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-800 max-w-xs truncate">
                    {q.questionText}
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate">{q.answer}</td>
                  <td className="px-4 py-3 text-slate-500">{q.categoryName}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/admin/questions/${q.id}`}
                        className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(q.id)}
                        disabled={isPending}
                        className="px-3 py-1 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
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
