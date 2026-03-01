export const dynamic = "force-dynamic";

import { db } from "@/db";
import { questions, questionTranslations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import AnswerChecker from "@/components/AnswerChecker";
import { isValidLang, getDictionary, type Lang } from "@/i18n";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ lang: string }>;
}

export default async function QuickQuizPage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const dict = await getDictionary(lang as Lang);

  let allQuestions;

  if (lang === "en") {
    allQuestions = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        answer: questions.answer,
        imagePath: questions.imagePath,
        imageIsHint: questions.imageIsHint,
        didYouKnow: questions.didYouKnow,
        difficulty: questions.difficulty,
      })
      .from(questions)
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
      .orderBy(questions.id);

    allQuestions = rows.map((row) => ({
      id: row.id,
      questionText: row.translatedText ?? row.questionText,
      answer: row.translatedAnswer ?? row.answer,
      didYouKnow: row.translatedDidYouKnow ?? row.didYouKnow,
      imagePath: row.imagePath,
      imageIsHint: row.imageIsHint,
      difficulty: row.difficulty,
    }));
  }

  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{dict.quickquiz.title}</h1>
      <p className="text-slate-500 mb-8">{dict.quickquiz.subtitle}</p>

      {shuffled.length === 0 ? (
        <p className="text-slate-400 text-center py-12">{dict.quickquiz.noQuestions}</p>
      ) : (
        <AnswerChecker questions={shuffled} categoryName={dict.quickquiz.allCategories} dict={dict} />
      )}
    </div>
  );
}
