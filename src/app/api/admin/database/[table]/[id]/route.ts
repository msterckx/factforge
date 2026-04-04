import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { questions, questionTranslations } from "@/db/schema";
import { eq } from "drizzle-orm";

// Whitelisted editable DB columns per table
const EDITABLE: Record<string, string[]> = {
  questions: [
    "question_text", "answer", "category_id", "subcategory_id",
    "difficulty", "did_you_know", "image_path",
  ],
  question_translations: [
    "question_text", "answer", "did_you_know", "is_auto_translated",
  ],
};

// Map DB snake_case column names → drizzle camelCase field names
const COL_MAP: Record<string, Record<string, string>> = {
  questions: {
    question_text:  "questionText",
    answer:         "answer",
    category_id:    "categoryId",
    subcategory_id: "subcategoryId",
    difficulty:     "difficulty",
    did_you_know:   "didYouKnow",
    image_path:     "imagePath",
  },
  question_translations: {
    question_text:      "questionText",
    answer:             "answer",
    did_you_know:       "didYouKnow",
    is_auto_translated: "isAutoTranslated",
  },
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { table, id: idParam } = await params;
  const id = Number(idParam);

  if (!EDITABLE[table]) return NextResponse.json({ error: "Table not editable" }, { status: 400 });
  if (isNaN(id))         return NextResponse.json({ error: "Invalid id" },         { status: 400 });

  const body: Record<string, unknown> = await req.json();
  const allowed  = EDITABLE[table];
  const colMap   = COL_MAP[table];
  const now      = new Date().toISOString().replace("T", " ").slice(0, 19);

  const drizzleUpdate: Record<string, unknown> = { updatedAt: now };

  for (const [col, val] of Object.entries(body)) {
    if (!allowed.includes(col)) continue;
    drizzleUpdate[colMap[col]] = val === "" ? null : val;
  }

  if (Object.keys(drizzleUpdate).length <= 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (table === "questions") {
    db.update(questions).set(drizzleUpdate).where(eq(questions.id, id)).run();
  } else if (table === "question_translations") {
    db.update(questionTranslations).set(drizzleUpdate).where(eq(questionTranslations.id, id)).run();
  }

  return NextResponse.json({ ok: true });
}
