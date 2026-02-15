import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __db: DrizzleDB | undefined;
};

function getDb(): DrizzleDB {
  if (!globalForDb.__db) {
    const dbDir = process.env.DATABASE_DIR || process.cwd();
    const dbPath = path.join(dbDir, "factforge.db");
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
