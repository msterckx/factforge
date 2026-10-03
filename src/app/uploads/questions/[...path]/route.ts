import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { resolveImageFile } from "@/lib/questionImages";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  // Descriptive names live in folders: <category>/<subcategory>/<answer>.<ext>.
  // resolveImageFile refuses anything outside the question images folder.
  const resolved = segments.length > 0 ? resolveImageFile(segments.join("/")) : null;
  if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }
  const filename = path.basename(resolved);

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(resolved);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      // Not immutable: a replaced image keeps its descriptive name (same URL).
      "Cache-Control": "public, max-age=86400",
    },
  });
}
