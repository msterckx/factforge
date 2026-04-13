import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const mapsDir = () =>
  path.join(process.env.DATABASE_DIR ?? process.cwd(), "maps");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Security: only allow plain .svg filenames, no path traversal
  if (!filename.endsWith(".svg") || filename.includes("/") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(mapsDir(), filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = fs.readFileSync(filePath);
  return new Response(content, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
