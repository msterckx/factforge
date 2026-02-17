export const dynamic = "force-dynamic";

import { db } from "@/db";
import { categories, questions, subcategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import AnswerChecker from "@/components/AnswerChecker";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .get();

  if (!category) {
    notFound();
  }

  const categoryQuestions = await db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      answer: questions.answer,
      imagePath: questions.imagePath,
      didYouKnow: questions.didYouKnow,
      difficulty: questions.difficulty,
      subcategoryId: questions.subcategoryId,
    })
    .from(questions)
    .where(eq(questions.categoryId, category.id))
    .orderBy(questions.id);

  const categorySubcategories = await db
    .select({
      id: subcategories.id,
      name: subcategories.name,
    })
    .from(subcategories)
    .where(eq(subcategories.categoryId, category.id))
    .orderBy(subcategories.name);

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        &larr; Back to Categories
      </Link>

      <h1 className="text-3xl font-bold mb-8">{category.name}</h1>

      {categoryQuestions.length === 0 ? (
        <p className="text-slate-400 text-center py-12">
          No questions in this category yet.
        </p>
      ) : (
        <AnswerChecker
          questions={categoryQuestions}
          categoryName={category.name}
          subcategories={categorySubcategories}
        />
      )}
    </div>
  );
}
