import Database from "better-sqlite3";
import path from "path";

type RawDB = InstanceType<typeof Database>;

const globalForRaw = globalThis as unknown as { __rawDb: RawDB | undefined };

export function getRawDb(): RawDB {
  if (!globalForRaw.__rawDb) {
    const dbDir = process.env.DATABASE_DIR || process.cwd();
    const dbPath = path.join(dbDir, "gameoftrivia.db");
    const sqlite = new Database(dbPath, { readonly: true });
    globalForRaw.__rawDb = sqlite;
  }
  return globalForRaw.__rawDb;
}
