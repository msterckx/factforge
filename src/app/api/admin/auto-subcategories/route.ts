import { db } from "@/db";
import { questions, categories, subcategories } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { classifySubcategories } from "@/lib/openai";

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all questions without a subcategory
  const unassigned = db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      answer: questions.answer,
      categoryId: questions.categoryId,
    })
    .from(questions)
    .where(isNull(questions.subcategoryId))
    .all();

  if (unassigned.length === 0) {
    return NextResponse.json({ updated: 0, message: "All questions already have subcategories." });
  }

  // Group questions by category
  const byCategory = new Map<number, typeof unassigned>();
  for (const q of unassigned) {
    const group = byCategory.get(q.categoryId) || [];
    group.push(q);
    byCategory.set(q.categoryId, group);
  }

  let totalUpdated = 0;
  let skippedNoSubs = 0;

  for (const [categoryId, categoryQuestions] of byCategory) {
    // Get category name and subcategories
    const category = db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .get();

    if (!category) continue;

    const subs = db
      .select({ id: subcategories.id, name: subcategories.name })
      .from(subcategories)
      .where(eq(subcategories.categoryId, categoryId))
      .all();

    if (subs.length === 0) {
      skippedNoSubs += categoryQuestions.length;
      continue;
    }

    const subMap = new Map(subs.map((s) => [s.name.toLowerCase(), s.id]));
    const subNames = subs.map((s) => s.name);

    // Process in batches of 20 to avoid oversized prompts
    for (let i = 0; i < categoryQuestions.length; i += 20) {
      const batch = categoryQuestions.slice(i, i + 20);

      try {
        const results = await classifySubcategories(batch, category.name, subNames);

        for (const result of results) {
          const subId = subMap.get(result.subcategory.toLowerCase());
          if (subId) {
            db.update(questions)
              .set({ subcategoryId: subId, updatedAt: new Date().toISOString() })
              .where(and(eq(questions.id, result.id), isNull(questions.subcategoryId)))
              .run();
            totalUpdated++;
          }
        }
      } catch (error) {
        console.error(`Failed to classify batch for category "${category.name}":`, error);
      }
    }
  }

  return NextResponse.json({
    updated: totalUpdated,
    skipped: skippedNoSubs,
    message: `Updated ${totalUpdated} question${totalUpdated !== 1 ? "s" : ""}.${skippedNoSubs > 0 ? ` ${skippedNoSubs} skipped (no subcategories defined for their category).` : ""}`,
  });
}
