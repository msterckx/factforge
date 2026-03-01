export const dynamic = "force-dynamic";

import { db } from "@/db";
import { categories, questions, subcategories, questionTranslations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import AnswerChecker from "@/components/AnswerChecker";
import { isValidLang, getDictionary, type Lang } from "@/i18n";

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) notFound();
  const dict = await getDictionary(lang as Lang);

  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .get();

  if (!category) notFound();

  let categoryQuestions;

  if (lang === "en") {
    categoryQuestions = await db
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
  } else {
    const rows = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        answer: questions.answer,
        imagePath: questions.imagePath,
        didYouKnow: questions.didYouKnow,
        difficulty: questions.difficulty,
        subcategoryId: questions.subcategoryId,
        translatedText: questionTranslations.questionText,
        translatedAnswer: questionTranslations.answer,
        translatedDidYouKnow: questionTranslations.didYouKnow,
      })
      .from(questions)
      .leftJoin(
        questionTranslations,
        and(
          eq(questionTranslations.questionId, questions.id),
          eq(questionTranslations.language, lang)
        )
      )
      .where(eq(questions.categoryId, category.id))
      .orderBy(questions.id);

    categoryQuestions = rows.map((row) => ({
      id: row.id,
      questionText: row.translatedText ?? row.questionText,
      answer: row.translatedAnswer ?? row.answer,
      didYouKnow: row.translatedDidYouKnow ?? row.didYouKnow,
      imagePath: row.imagePath,
      difficulty: row.difficulty,
      subcategoryId: row.subcategoryId,
    }));
  }

  const categorySubcategories = await db
    .select({ id: subcategories.id, name: subcategories.name })
    .from(subcategories)
    .where(eq(subcategories.categoryId, category.id))
    .orderBy(subcategories.name);

  return (
    <div>
      <Link
        href={`/${lang}`}
        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        &larr; {dict.category.backToCategories}
      </Link>

      <h1 className="text-3xl font-bold mb-8">{category.name}</h1>

      {categoryQuestions.length === 0 ? (
        <p className="text-slate-400 text-center py-12">{dict.category.noQuestions}</p>
      ) : (
        <AnswerChecker
          questions={categoryQuestions}
          categoryName={category.name}
          subcategories={categorySubcategories}
          dict={dict}
        />
      )}
    </div>
  );
}
