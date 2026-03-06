import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// SQLite file magic header: "SQLite format 3\000"
const SQLITE_MAGIC = Buffer.from("53514c69746520666f726d6174203300", "hex");

function isSqliteFile(buf: Buffer): boolean {
  return buf.length >= 16 && buf.subarray(0, 16).equals(SQLITE_MAGIC);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  if (!isSqliteFile(buf)) {
    return NextResponse.json(
      { error: "Invalid file: not a SQLite database" },
      { status: 400 }
    );
  }

  const dbDir = process.env.DATABASE_DIR || process.cwd();
  const dbPath = path.join(dbDir, "gameoftrivia.db");

  // Close and clear the global DB singletons so connections are released
  const g = globalThis as Record<string, unknown>;
  const rawDb = g.__rawDb as { close?: () => void } | undefined;
  if (rawDb?.close) rawDb.close();
  g.__rawDb = undefined;

  const drizzleDb = g.__db as { _db?: { close?: () => void } } | undefined;
  if (drizzleDb?._db?.close) drizzleDb._db.close();
  g.__db = undefined;

  // Write the uploaded database, replacing the current one
  fs.writeFileSync(dbPath, buf);

  return NextResponse.json({ success: true });
}
