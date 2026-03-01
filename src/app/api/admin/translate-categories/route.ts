import { db } from "@/db";
import { categories, subcategories, categoryTranslations, subcategoryTranslations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { translateText } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { language = "nl" } = await request.json();

  const allCategories = db.select().from(categories).all();
  const allSubcategories = db.select().from(subcategories).all();

  const translatedCatIds = new Set(
    db
      .select({ categoryId: categoryTranslations.categoryId })
      .from(categoryTranslations)
      .where(eq(categoryTranslations.language, language))
      .all()
      .map((r) => r.categoryId)
  );

  const translatedSubIds = new Set(
    db
      .select({ subcategoryId: subcategoryTranslations.subcategoryId })
      .from(subcategoryTranslations)
      .where(eq(subcategoryTranslations.language, language))
      .all()
      .map((r) => r.subcategoryId)
  );

  let translated = 0;
  let failed = 0;

  for (const cat of allCategories) {
    if (translatedCatIds.has(cat.id)) continue;
    try {
      const translatedName = await translateText(cat.name, language);
      db.insert(categoryTranslations)
        .values({ categoryId: cat.id, language, name: translatedName, isAutoTranslated: true })
        .run();
      translated++;
    } catch {
      failed++;
    }
  }

  for (const sub of allSubcategories) {
    if (translatedSubIds.has(sub.id)) continue;
    try {
      const translatedName = await translateText(sub.name, language);
      db.insert(subcategoryTranslations)
        .values({ subcategoryId: sub.id, language, name: translatedName, isAutoTranslated: true })
        .run();
      translated++;
    } catch {
      failed++;
    }
  }

  const skipped = translatedCatIds.size + translatedSubIds.size;

  return NextResponse.json({
    success: true,
    translated,
    failed,
    skipped,
    message: `Translated ${translated} item(s). ${failed > 0 ? `${failed} failed. ` : ""}${skipped} already had translations.`,
  });
}
