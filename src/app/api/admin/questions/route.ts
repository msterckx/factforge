import { db } from "@/db";
import { questions, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allQuestions = db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      answer: questions.answer,
      categoryId: questions.categoryId,
      categoryName: categories.name,
      imagePath: questions.imagePath,
      difficulty: questions.difficulty,
    })
    .from(questions)
    .leftJoin(categories, eq(questions.categoryId, categories.id))
    .orderBy(questions.id)
    .all();

  const allCategories = db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(categories.name)
    .all();

  return NextResponse.json({
    questions: allQuestions,
    categories: allCategories,
  });
}
