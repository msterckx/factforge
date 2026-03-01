export const dynamic = "force-dynamic";

import { db } from "@/db";
import { categories, questions, subcategories, questionTranslations, categoryTranslations, subcategoryTranslations } from "@/db/schema";
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

  // Translate category name
  let categoryName = category.name;
  if (lang !== "en") {
    const catTranslation = db
      .select({ name: categoryTranslations.name })
      .from(categoryTranslations)
      .where(
        and(
          eq(categoryTranslations.categoryId, category.id),
          eq(categoryTranslations.language, lang)
        )
      )
      .get();
    if (catTranslation) categoryName = catTranslation.name;
  }

  // Fetch questions with optional translation
  let categoryQuestions;

  if (lang === "en") {
    categoryQuestions = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        answer: questions.answer,
        imagePath: questions.imagePath,
        imageIsHint: questions.imageIsHint,
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
        imageIsHint: questions.imageIsHint,
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
      imageIsHint: row.imageIsHint,
      difficulty: row.difficulty,
      subcategoryId: row.subcategoryId,
    }));
  }

  // Fetch subcategories with optional translation
  const rawSubcategories = await db
    .select({ id: subcategories.id, name: subcategories.name })
    .from(subcategories)
    .where(eq(subcategories.categoryId, category.id))
    .orderBy(subcategories.name);

  let categorySubcategories = rawSubcategories;

  if (lang !== "en" && rawSubcategories.length > 0) {
    const subIds = rawSubcategories.map((s) => s.id);
    const subTranslations = db
      .select({
        subcategoryId: subcategoryTranslations.subcategoryId,
        name: subcategoryTranslations.name,
      })
      .from(subcategoryTranslations)
      .where(eq(subcategoryTranslations.language, lang))
      .all();

    const subTransMap = new Map(subTranslations.map((t) => [t.subcategoryId, t.name]));
    categorySubcategories = rawSubcategories.map((s) => ({
      id: s.id,
      name: subTransMap.get(s.id) ?? s.name,
    }));
    void subIds; // suppress unused warning
  }

  return (
    <div>
      <Link
        href={`/${lang}`}
        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        &larr; {dict.category.backToCategories}
      </Link>

      <h1 className="text-3xl font-bold mb-8">{categoryName}</h1>

      {categoryQuestions.length === 0 ? (
        <p className="text-slate-400 text-center py-12">{dict.category.noQuestions}</p>
      ) : (
        <AnswerChecker
          questions={categoryQuestions}
          categoryName={categoryName}
          subcategories={categorySubcategories}
          dict={dict}
        />
      )}
    </div>
  );
}
