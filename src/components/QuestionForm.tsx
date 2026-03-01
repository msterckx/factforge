"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createQuestion, updateQuestion } from "@/actions/questions";
import ImageUpload from "@/components/ImageUpload";
import ImageSearch from "@/components/ImageSearch";

interface Category {
  id: number;
  name: string;
}

interface Subcategory {
  id: number;
  name: string;
  categoryId: number;
}

interface QuestionData {
  id: number;
  questionText: string;
  answer: string;
  categoryId: number;
  subcategoryId: number | null;
  imagePath: string | null;
  didYouKnow: string | null;
  difficulty: "easy" | "intermediate" | "difficult";
}

interface QuestionFormProps {
  categories: Category[];
  subcategories: Subcategory[];
  question?: QuestionData;
}

export default function QuestionForm({ categories, subcategories, question }: QuestionFormProps) {
  const isEdit = !!question;
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [searchedImagePath, setSearchedImagePath] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">(question?.categoryId || "");

  const filteredSubcategories = useMemo(
    () => subcategories.filter((s) => s.categoryId === selectedCategoryId),
    [subcategories, selectedCategoryId]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);

    // If an image was selected from search (and no file was uploaded), pass it
    if (searchedImagePath) {
      const imageFile = formData.get("image") as File | null;
      if (!imageFile || imageFile.size === 0) {
        formData.set("searchedImagePath", searchedImagePath);
      }
    }

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

  function handleImageSearchSelected(imagePath: string) {
    setSearchedImagePath(imagePath);
  }

  // Determine the current image to show in ImageUpload
  const currentImage = searchedImagePath || question?.imagePath || null;

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
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : "")}
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

      {filteredSubcategories.length > 0 && (
        <div className="mb-4">
          <label htmlFor="subcategoryId" className="block text-sm font-medium text-slate-700 mb-1">
            Subcategory <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            id="subcategoryId"
            name="subcategoryId"
            defaultValue={question?.subcategoryId || ""}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">None</option>
            {filteredSubcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="difficulty" className="block text-sm font-medium text-slate-700 mb-1">
          Difficulty
        </label>
        <select
          id="difficulty"
          name="difficulty"
          defaultValue={question?.difficulty || "easy"}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="easy">Easy</option>
          <option value="intermediate">Intermediate</option>
          <option value="difficult">Difficult</option>
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

      <div className="mb-4">
        <label htmlFor="didYouKnow" className="block text-sm font-medium text-slate-700 mb-1">
          Did You Know? (optional)
        </label>
        <textarea
          id="didYouKnow"
          name="didYouKnow"
          defaultValue={question?.didYouKnow || ""}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-vertical"
          placeholder="Fun fact shown after the user answers..."
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Upload Image
        </label>
        <ImageUpload currentImage={currentImage} />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Or Search for an Image
        </label>
        <ImageSearch onImageSelected={handleImageSearchSelected} />
        {searchedImagePath && (
          <div className="mt-2 flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
            <svg className="h-4 w-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-green-700">Image selected. You can now save the question.</span>
            <button
              type="button"
              onClick={() => setSearchedImagePath(null)}
              className="ml-auto text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {searchedImagePath && (
        <input type="hidden" name="searchedImagePath" value={searchedImagePath} />
      )}

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
