import { db } from "@/db";
import { questions, categories, subcategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

function escapeCsvField(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = db
    .select({
      id: questions.id,
      questionText: questions.questionText,
      answer: questions.answer,
      category: categories.name,
      subcategory: subcategories.name,
      difficulty: questions.difficulty,
      didYouKnow: questions.didYouKnow,
      imagePath: questions.imagePath,
      createdAt: questions.createdAt,
      updatedAt: questions.updatedAt,
    })
    .from(questions)
    .leftJoin(categories, eq(questions.categoryId, categories.id))
    .leftJoin(subcategories, eq(questions.subcategoryId, subcategories.id))
    .orderBy(questions.id)
    .all();

  const headers = [
    "ID",
    "Question",
    "Answer",
    "Category",
    "Subcategory",
    "Difficulty",
    "Did You Know",
    "Image Path",
    "Created At",
    "Updated At",
  ];

  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.id,
        escapeCsvField(row.questionText),
        escapeCsvField(row.answer),
        escapeCsvField(row.category),
        escapeCsvField(row.subcategory),
        escapeCsvField(row.difficulty),
        escapeCsvField(row.didYouKnow),
        escapeCsvField(row.imagePath),
        escapeCsvField(row.createdAt),
        escapeCsvField(row.updatedAt),
      ].join(",")
    ),
  ];

  const csv = csvLines.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="houseoftrivia-questions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
