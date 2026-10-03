import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import { contentSource, openPublishedContent } from "@/content/published";

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __db: DrizzleDB | undefined;
};

// Content database: the local authoring DB, or — in production — a read-only
// in-memory copy of content/published (see src/content/published.ts). Player
// scores live in the separate runtime database (src/db/runtime.ts).
function getDb(): DrizzleDB {
  if (!globalForDb.__db && contentSource() === "published") {
    globalForDb.__db = drizzle(openPublishedContent(), { schema });
  }
  if (!globalForDb.__db) {
    const dbDir = process.env.DATABASE_DIR || process.cwd();
    const dbPath = path.join(dbDir, "gameoftrivia.db");
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    globalForDb.__db = drizzle(sqlite, { schema });
  }
  return globalForDb.__db;
}

export const db = new Proxy({} as DrizzleDB, {
  get(_target, prop, receiver) {
    const realDb = getDb();
    const value = Reflect.get(realDb, prop, receiver);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});
