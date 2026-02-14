"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQuestion, updateQuestion } from "@/actions/questions";
import ImageUpload from "@/components/ImageUpload";

interface Category {
  id: number;
  name: string;
}

interface QuestionData {
  id: number;
  questionText: string;
  answer: string;
  categoryId: number;
  imagePath: string | null;
}

interface QuestionFormProps {
  categories: Category[];
  question?: QuestionData;
}

export default function QuestionForm({ categories, question }: QuestionFormProps) {
  const isEdit = !!question;
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEdit
        ? await updateQuestion(question!.id, formData)
        : await createQuestion(formData);

      if (result.error) {
        setError(result.error);
      } else {
        router.push("/admin/questions");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="categoryId" className="block text-sm font-medium text-slate-700 mb-1">
          Category
        </label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={question?.categoryId || ""}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="" disabled>Select a category...</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="questionText" className="block text-sm font-medium text-slate-700 mb-1">
          Question
        </label>
        <textarea
          id="questionText"
          name="questionText"
          defaultValue={question?.questionText || ""}
          required
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-vertical"
          placeholder="Enter your question..."
        />
      </div>

      <div className="mb-4">
        <label htmlFor="answer" className="block text-sm font-medium text-slate-700 mb-1">
          Answer
        </label>
        <input
          id="answer"
          type="text"
          name="answer"
          defaultValue={question?.answer || ""}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="Enter the correct answer..."
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Image (optional)
        </label>
        <ImageUpload currentImage={question?.imagePath} />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving..." : isEdit ? "Update Question" : "Create Question"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
