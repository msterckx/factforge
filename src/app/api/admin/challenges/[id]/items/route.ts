import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { challengeItems, challengeGames } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const items = db.select().from(challengeItems).where(eq(challengeItems.gameId, Number(id))).orderBy(asc(challengeItems.position)).all();
  return NextResponse.json(items);
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const game = db.select().from(challengeGames).where(eq(challengeGames.id, Number(id))).get();
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const body = await req.json();
  const { position, name, imageUrl, descriptionEn, descriptionNl, dates, milestoneEn, milestoneNl, hint, achievement } = body;

  if (!name || position == null) {
    return NextResponse.json({ error: "name and position are required" }, { status: 400 });
  }

  const [item] = db
    .insert(challengeItems)
    .values({ gameId: Number(id), position, name, imageUrl: imageUrl ?? "", descriptionEn: descriptionEn ?? "", descriptionNl: descriptionNl ?? "", dates, milestoneEn, milestoneNl, hint, achievement })
    .returning()
    .all();

  return NextResponse.json(item, { status: 201 });
}
