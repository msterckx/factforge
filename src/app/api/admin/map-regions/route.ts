import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { mapRegions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    gameId?: number; regionKey?: string;
    labelEn?: string; labelNl?: string;
    capitalEn?: string | null; capitalNl?: string | null;
  };

  const { gameId, regionKey, labelEn, labelNl, capitalEn, capitalNl } = body;
  if (!gameId || !regionKey || !labelEn || !labelNl) {
    return NextResponse.json({ error: "gameId, regionKey, labelEn, labelNl are required" }, { status: 400 });
  }

  const [row] = db.insert(mapRegions)
    .values({ gameId, regionKey, labelEn, labelNl, capitalEn: capitalEn ?? null, capitalNl: capitalNl ?? null })
    .returning().all();

  return NextResponse.json(row, { status: 201 });
}
