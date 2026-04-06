import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { mapRegions } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/admin/map-regions/import
 *
 * Accepts multipart/form-data with:
 *   gameId  – the challenge_games.id
 *   file    – a CSV file with header: region_key,label_en,label_nl,capital_en,capital_nl
 *
 * Replaces all existing regions for that game.
 *
 * CSV example:
 *   region_key,label_en,label_nl,capital_en,capital_nl
 *   NG,Nigeria,Nigeria,Abuja,Abuja
 *   EG,Egypt,Egypte,Cairo,Caïro
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const gameIdRaw = formData.get("gameId");
  const file      = formData.get("file") as File | null;

  if (!gameIdRaw || !file) {
    return NextResponse.json({ error: "gameId and file are required" }, { status: 400 });
  }

  const gameId = Number(gameIdRaw);
  if (isNaN(gameId)) return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must have a header and at least one data row" }, { status: 400 });
  }

  // Parse header
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    regionKey: headers.indexOf("region_key"),
    labelEn:   headers.indexOf("label_en"),
    labelNl:   headers.indexOf("label_nl"),
    capitalEn: headers.indexOf("capital_en"),
    capitalNl: headers.indexOf("capital_nl"),
  };

  if (idx.regionKey < 0 || idx.labelEn < 0 || idx.labelNl < 0) {
    return NextResponse.json({ error: "CSV must have columns: region_key, label_en, label_nl" }, { status: 400 });
  }

  const rows: {
    gameId: number;
    regionKey: string;
    labelEn: string;
    labelNl: string;
    capitalEn: string | null;
    capitalNl: string | null;
  }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const regionKey = cols[idx.regionKey];
    const labelEn   = cols[idx.labelEn];
    const labelNl   = cols[idx.labelNl];
    if (!regionKey || !labelEn || !labelNl) continue;

    rows.push({
      gameId,
      regionKey,
      labelEn,
      labelNl,
      capitalEn: idx.capitalEn >= 0 ? (cols[idx.capitalEn] || null) : null,
      capitalNl: idx.capitalNl >= 0 ? (cols[idx.capitalNl] || null) : null,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 });
  }

  // Replace all existing regions for this game
  db.delete(mapRegions).where(eq(mapRegions.gameId, gameId)).run();
  db.insert(mapRegions).values(rows).run();

  return NextResponse.json({ ok: true, inserted: rows.length });
}
