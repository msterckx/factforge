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
    infoImageEn?: string | null; infoImageNl?: string | null;
    infoTextEn?: string | null; infoTextNl?: string | null;
    infographData?: string | null;
  };

  const { gameId, regionKey, labelEn, labelNl, capitalEn, capitalNl, infoImageEn, infoImageNl, infoTextEn, infoTextNl, infographData } = body;
  if (!gameId || !regionKey || !labelEn || !labelNl) {
    return NextResponse.json({ error: "gameId, regionKey, labelEn, labelNl are required" }, { status: 400 });
  }

  const [row] = db.insert(mapRegions)
    .values({ gameId, regionKey, labelEn, labelNl, capitalEn: capitalEn ?? null, capitalNl: capitalNl ?? null, infoImageEn: infoImageEn ?? null, infoImageNl: infoImageNl ?? null, infoTextEn: infoTextEn ?? null, infoTextNl: infoTextNl ?? null, infographData: infographData ?? null })
    .returning().all();

  return NextResponse.json(row, { status: 201 });
}
