import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { challengeScores } from "./schema";
import path from "path";
import fs from "fs";

/**
 * Runtime database: data the live site itself writes (player scores), kept
 * apart from the published content so a content publish never touches it.
 * Lives next to the content DB as <DATABASE_DIR>/runtime.db and creates its
 * own table on first use — it isn't part of the drizzle content migrations.
 */

const runtimeSchema = { challengeScores };
type RuntimeDB = ReturnType<typeof drizzle<typeof runtimeSchema>>;

const globalForRuntime = globalThis as unknown as { __runtimeDb: RuntimeDB | undefined };

function getRuntimeDb(): RuntimeDB {
  if (!globalForRuntime.__runtimeDb) {
    const dir = process.env.DATABASE_DIR || process.cwd();
    fs.mkdirSync(dir, { recursive: true });
    const sqlite = new Database(path.join(dir, "runtime.db"));
    sqlite.pragma("journal_mode = WAL");
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS challenge_scores (
        id           integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_email   text NOT NULL,
        challenge_id text NOT NULL,
        score        integer NOT NULL,
        max_score    integer NOT NULL,
        completed_at text DEFAULT (datetime('now')) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS challenge_scores_user_challenge_idx
        ON challenge_scores (user_email, challenge_id);
    `);
    globalForRuntime.__runtimeDb = drizzle(sqlite, { schema: runtimeSchema });
  }
  return globalForRuntime.__runtimeDb;
}

export const runtimeDb = new Proxy({} as RuntimeDB, {
  get(_target, prop, receiver) {
    const realDb = getRuntimeDb();
    const value = Reflect.get(realDb, prop, receiver);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});
