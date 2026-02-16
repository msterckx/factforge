import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { generateQuestions } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { categoryId, count = 5 } = await request.json();

  if (!categoryId) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }

  const category = db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .get();

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  try {
    const questions = await generateQuestions(category.name, Math.min(count, 10));
    return NextResponse.json({ questions });
  } catch (error) {
    console.error("OpenAI generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate questions. Check your OpenAI API key." },
      { status: 500 }
    );
  }
}
