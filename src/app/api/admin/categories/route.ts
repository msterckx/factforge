import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { categories, subcategories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cats = db.select().from(categories).orderBy(asc(categories.name)).all();
  const subs = db.select().from(subcategories).orderBy(asc(subcategories.name)).all();

  const result = cats.map((cat) => ({
    ...cat,
    subcategories: subs.filter((s) => s.categoryId === cat.id),
  }));

  return NextResponse.json(result);
}
