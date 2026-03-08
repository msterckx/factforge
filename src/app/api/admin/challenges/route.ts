import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { challengeGames } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const games = db.select().from(challengeGames).orderBy(asc(challengeGames.sortOrder)).all();
  return NextResponse.json(games);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { slug, gameType, icon, category, titleEn, titleNl, subtitleEn, subtitleNl, available, sortOrder } = body;

  if (!slug || !gameType || !titleEn || !titleNl) {
    return NextResponse.json({ error: "slug, gameType, titleEn, titleNl are required" }, { status: 400 });
  }

  const [game] = db
    .insert(challengeGames)
    .values({ slug, gameType, icon: icon ?? "🎮", category: category ?? "other", titleEn, titleNl, subtitleEn: subtitleEn ?? "", subtitleNl: subtitleNl ?? "", available: available ?? true, sortOrder: sortOrder ?? 0 })
    .returning()
    .all();

  return NextResponse.json(game, { status: 201 });
}
