import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const audioDir = process.env.AUDIO_DIR;

  if (!audioDir) {
    return NextResponse.json({ error: "AUDIO_DIR not configured" }, { status: 500 });
  }

  // Resolve and validate the path stays within AUDIO_DIR
  const filePath = path.resolve(audioDir, ...segments);
  if (!filePath.startsWith(path.resolve(audioDir))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".wav": "audio/wav",
  };
  const contentType = contentTypes[ext] ?? "application/octet-stream";

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: { "Content-Type": contentType },
  });
}
