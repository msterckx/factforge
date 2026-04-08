import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { mapRegions } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

// PATCH /api/admin/map-regions/toggle
// Body: { ids: number[], enabled: boolean }  — toggle specific rows
// Body: { gameId: number, enabled: boolean } — toggle all rows for a game
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    gameId?: number;
    ids?: number[];
    enabled: boolean;
  };

  if (body.gameId !== undefined) {
    db.update(mapRegions)
      .set({ enabled: body.enabled })
      .where(eq(mapRegions.gameId, body.gameId))
      .run();
    return NextResponse.json({ ok: true });
  }

  if (body.ids && body.ids.length > 0) {
    db.update(mapRegions)
      .set({ enabled: body.enabled })
      .where(inArray(mapRegions.id, body.ids))
      .run();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide gameId or ids" }, { status: 400 });
}
