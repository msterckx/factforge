import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const dbDir = process.env.DATABASE_DIR || process.cwd();
const dbPath = path.join(dbDir, "factforge.db");

const globalForDb = globalThis as unknown as {
  __db: ReturnType<typeof drizzle> | undefined;
};

if (!globalForDb.__db) {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  globalForDb.__db = drizzle(sqlite, { schema });
}

export const db = globalForDb.__db;
