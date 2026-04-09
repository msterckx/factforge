import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { mapRegions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rowId = parseInt(id, 10);
  if (isNaN(rowId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json() as {
    labelEn?: string; labelNl?: string;
    capitalEn?: string | null; capitalNl?: string | null;
    infoImageEn?: string | null; infoImageNl?: string | null;
    infoTextEn?: string | null; infoTextNl?: string | null;
  };

  const [row] = db.update(mapRegions)
    .set(body)
    .where(eq(mapRegions.id, rowId))
    .returning().all();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rowId = parseInt(id, 10);
  if (isNaN(rowId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  db.delete(mapRegions).where(eq(mapRegions.id, rowId)).run();
  return NextResponse.json({ ok: true });
}
