import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { mapRegions } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

/** Extract circle region keys from an SVG using the same logic as rewriteInkscapeLabels. */
function circleRegionKeysFromSvg(svgContent: string): string[] {
  const keys: string[] = [];
  for (const match of svgContent.matchAll(/<circle([\s\S]*?)\/>/g)) {
    const attrs = match[1];
    const labelMatch = attrs.match(/inkscape:label="([^"]+)"/);
    const idMatch    = attrs.match(/\bid="([^"]+)"/);
    const key = labelMatch ? labelMatch[1].trim() : idMatch?.[1]?.trim();
    if (key) keys.push(key);
  }
  return keys;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gameId } = await req.json() as { gameId?: number };
  if (!gameId || isNaN(gameId)) return NextResponse.json({ error: "gameId required" }, { status: 400 });

  const svgPath = path.join(process.cwd(), "public", "maps", "south_america_v2.svg");
  if (!fs.existsSync(svgPath)) return NextResponse.json({ error: "SVG not found" }, { status: 404 });

  const regionKeys = circleRegionKeysFromSvg(fs.readFileSync(svgPath, "utf-8"));
  if (regionKeys.length === 0) return NextResponse.json({ error: "No circles found in SVG" }, { status: 422 });

  const rows = regionKeys.map((key) => ({
    gameId,
    regionKey: key,
    labelEn: key.replaceAll("_", " "),
    labelNl: "",
  }));

  db.delete(mapRegions).where(eq(mapRegions.gameId, gameId)).run();
  db.insert(mapRegions).values(rows).run();

  return NextResponse.json({ ok: true, inserted: rows.length });
}
