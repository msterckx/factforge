import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

const mapsDir = () => {
  const dir = path.join(process.env.DATABASE_DIR ?? process.cwd(), "maps");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fd = await req.formData();
  const file = fd.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.name.endsWith(".svg")) return NextResponse.json({ error: "Only .svg files are allowed" }, { status: 400 });

  // Sanitise the filename: keep only alphanumeric, hyphens, underscores, dots
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  if (safeName.includes("..")) return NextResponse.json({ error: "Invalid filename" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Basic check: must look like an SVG
  const preview = buffer.slice(0, 512).toString("utf8");
  if (!preview.includes("<svg") && !preview.includes("<?xml")) {
    return NextResponse.json({ error: "File does not appear to be a valid SVG" }, { status: 400 });
  }

  fs.writeFileSync(path.join(mapsDir(), safeName), buffer);

  return NextResponse.json({ ok: true, path: `/api/maps/${safeName}`, filename: safeName }, { status: 201 });
}
