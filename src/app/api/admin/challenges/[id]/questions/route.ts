import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { challengeGames, questions, subcategories } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const game = db.select().from(challengeGames).where(eq(challengeGames.id, Number(id))).get();
  if (!game || game.gameType !== "quiz" || !game.quizCategoryId) {
    return NextResponse.json({ questions: [] });
  }

  const rows = db
    .select({
      id:           questions.id,
      questionText: questions.questionText,
      answer:       questions.answer,
      difficulty:   questions.difficulty,
      subcategoryId: questions.subcategoryId,
      subcategoryName: subcategories.name,
    })
    .from(questions)
    .leftJoin(subcategories, eq(questions.subcategoryId, subcategories.id))
    .where(
      game.quizSubcategoryId
        ? and(eq(questions.categoryId, game.quizCategoryId), eq(questions.subcategoryId, game.quizSubcategoryId))
        : eq(questions.categoryId, game.quizCategoryId)
    )
    .orderBy(questions.id)
    .all();

  return NextResponse.json({ questions: rows });
}
