import { db } from "@/db";
import { questions, questionTranslations } from "@/db/schema";
import { eq, notInArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { translateQuestion } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { language = "nl" } = await request.json();

  const alreadyTranslated = db
    .select({ questionId: questionTranslations.questionId })
    .from(questionTranslations)
    .where(eq(questionTranslations.language, language))
    .all()
    .map((r) => r.questionId);

  const toTranslate = alreadyTranslated.length > 0
    ? db
        .select({
          id: questions.id,
          questionText: questions.questionText,
          answer: questions.answer,
          didYouKnow: questions.didYouKnow,
        })
        .from(questions)
        .where(notInArray(questions.id, alreadyTranslated))
        .all()
    : db
        .select({
          id: questions.id,
          questionText: questions.questionText,
          answer: questions.answer,
          didYouKnow: questions.didYouKnow,
        })
        .from(questions)
        .all();

  let translated = 0;
  let failed = 0;

  for (const q of toTranslate) {
    try {
      const result = await translateQuestion(
        { questionText: q.questionText, answer: q.answer, didYouKnow: q.didYouKnow },
        language
      );

      db.insert(questionTranslations)
        .values({
          questionId: q.id,
          language,
          questionText: result.questionText,
          answer: result.answer,
          didYouKnow: result.didYouKnow,
          isAutoTranslated: true,
        })
        .run();

      translated++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    translated,
    failed,
    skipped: alreadyTranslated.length,
    message: `Translated ${translated} question(s). ${failed > 0 ? `${failed} failed. ` : ""}${alreadyTranslated.length} already had translations.`,
  });
}
