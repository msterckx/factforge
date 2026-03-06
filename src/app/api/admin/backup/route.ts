import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbDir = process.env.DATABASE_DIR || process.cwd();
  const dbPath = path.join(dbDir, "gameoftrivia.db");
  const tmpPath = path.join(os.tmpdir(), `db-backup-${Date.now()}.db`);

  try {
    // Use better-sqlite3's backup API for a WAL-safe, consistent copy
    const src = new Database(dbPath, { readonly: true });
    await src.backup(tmpPath);
    src.close();

    const buffer = fs.readFileSync(tmpPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="gameoftrivia-backup-${timestamp}.db"`,
      },
    });
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
}
