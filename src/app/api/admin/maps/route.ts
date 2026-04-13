import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Maps bundled in the repo (public/maps/)
  const publicDir = path.join(process.cwd(), "public", "maps");
  const publicMaps: { label: string; value: string }[] = fs.existsSync(publicDir)
    ? fs.readdirSync(publicDir)
        .filter((f) => f.endsWith(".svg"))
        .map((f) => ({ label: stem(f), value: `/maps/${f}` }))
    : [];

  // Maps uploaded to /var/data/maps/
  const uploadedDir = path.join(process.env.DATABASE_DIR ?? process.cwd(), "maps");
  const uploadedMaps: { label: string; value: string }[] = fs.existsSync(uploadedDir)
    ? fs.readdirSync(uploadedDir)
        .filter((f) => f.endsWith(".svg"))
        .map((f) => ({ label: `${stem(f)} (uploaded)`, value: `/api/maps/${f}` }))
    : [];

  return NextResponse.json({ maps: [...publicMaps, ...uploadedMaps] });
}

function stem(filename: string) {
  return filename.replace(/\.svg$/i, "").replace(/[_-]/g, " ");
}
