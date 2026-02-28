import { db } from "@/db";
import { questions, questionTranslations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { translateQuestion } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { questionId, language = "nl" } = await request.json();

  if (!questionId) {
    return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  }

  const question = db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      answer: questions.answer,
      didYouKnow: questions.didYouKnow,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .get();

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  try {
    const translated = await translateQuestion(
      { questionText: question.questionText, answer: question.answer, didYouKnow: question.didYouKnow },
      language
    );

    db.insert(questionTranslations)
      .values({
        questionId: question.id,
        language,
        questionText: translated.questionText,
        answer: translated.answer,
        didYouKnow: translated.didYouKnow,
        isAutoTranslated: true,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [questionTranslations.questionId, questionTranslations.language],
        set: {
          questionText: translated.questionText,
          answer: translated.answer,
          didYouKnow: translated.didYouKnow,
          isAutoTranslated: true,
          updatedAt: new Date().toISOString(),
        },
      })
      .run();

    return NextResponse.json({ success: true, translated });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
