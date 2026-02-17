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
  subcategoryId: number | null;
  subcategoryName: string | null;
  imagePath: string | null;
  difficulty: "easy" | "intermediate" | "difficult";
}

const difficultyBadge = {
  easy: "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  difficult: "bg-red-100 text-red-700",
};

interface Category {
  id: number;
  name: string;
}

const PAGE_SIZE = 10;

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadData();
  }, []);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory]);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paged = filtered.slice(startIndex, startIndex + PAGE_SIZE);

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
      <div className="mb-4 flex items-center gap-4">
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
        <span className="text-sm text-slate-500">
          {filtered.length} question{filtered.length !== 1 ? "s" : ""}
        </span>
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
              <th className="text-left px-4 py-3 font-medium text-slate-600">Difficulty</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Subcategory</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">
                  No questions yet.{" "}
                  <Link href="/admin/questions/new" className="text-amber-500 hover:underline">
                    Add one
                  </Link>
                </td>
              </tr>
            ) : (
              paged.map((q) => (
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
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${difficultyBadge[q.difficulty]}`}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{q.categoryName}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{q.subcategoryName || "—"}</td>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-slate-500">
            Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              className="px-2 py-1 text-sm rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(safePage - 1)}
              disabled={safePage === 1}
              className="px-2 py-1 text-sm rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | "...")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-sm text-slate-400">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item as number)}
                    className={`px-3 py-1 text-sm rounded border ${
                      safePage === item
                        ? "bg-amber-500 text-white border-amber-500"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              onClick={() => setCurrentPage(safePage + 1)}
              disabled={safePage === totalPages}
              className="px-2 py-1 text-sm rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              className="px-2 py-1 text-sm rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
