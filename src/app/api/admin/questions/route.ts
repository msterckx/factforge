import { db } from "@/db";
import { questions, categories, subcategories } from "@/db/schema";
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
      subcategoryId: questions.subcategoryId,
      subcategoryName: subcategories.name,
      imagePath: questions.imagePath,
      difficulty: questions.difficulty,
    })
    .from(questions)
    .leftJoin(categories, eq(questions.categoryId, categories.id))
    .leftJoin(subcategories, eq(questions.subcategoryId, subcategories.id))
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
