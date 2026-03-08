import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { challengeItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface Params { params: Promise<{ id: string; itemId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const body = await req.json();
  const allowed = ["position","name","imageUrl","descriptionEn","descriptionNl","dates","fact","hint","achievement"] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [item] = db
    .update(challengeItems)
    .set(updates)
    .where(and(eq(challengeItems.id, Number(itemId)), eq(challengeItems.gameId, Number(id))))
    .returning()
    .all();

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  db.delete(challengeItems)
    .where(and(eq(challengeItems.id, Number(itemId)), eq(challengeItems.gameId, Number(id))))
    .run();
  return new NextResponse(null, { status: 204 });
}
