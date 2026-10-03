import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";
import path from "path";

/**
 * Published content: the read-only snapshot of the authoring database that
 * the public site serves in production.
 *
 * Authoring happens in the local gameoftrivia.db; `npm run content:publish`
 * exports these tables to content/published/<table>.json (committed to git).
 * In production the site loads those files into an in-memory SQLite database
 * with the same schema, so every page query works unchanged — while nothing
 * can write to it (writes like scores go to the separate runtime database).
 */

// Parents before children, so foreign keys are satisfied on import.
export const PUBLISHED_TABLES = [
  "categories",
  "category_translations",
  "subcategories",
  "subcategory_translations",
  "questions",
  "question_translations",
  "challenge_games",
  "challenge_items",
  "map_regions",
] as const;

export const PUBLISHED_DIR = path.join(process.cwd(), "content", "published");
const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

/** "published" in production (unless overridden), "db" for local authoring. */
export function contentSource(): "published" | "db" {
  const explicit = process.env.CONTENT_SOURCE;
  if (explicit === "published" || explicit === "db") return explicit;
  return process.env.NODE_ENV === "production" ? "published" : "db";
}

/** Builds a read-only in-memory database from content/published/*.json. */
export function openPublishedContent(): Database.Database {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_DIR });

  const load = sqlite.transaction(() => {
    for (const table of PUBLISHED_TABLES) {
      const file = path.join(PUBLISHED_DIR, `${table}.json`);
      if (!fs.existsSync(file)) {
        throw new Error(`Published content missing: ${file} — run "npm run content:publish"`);
      }
      const rows = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>[];
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]);
      const insert = sqlite.prepare(
        `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) ` +
        `VALUES (${columns.map((c) => `@${c}`).join(", ")})`
      );
      for (const row of rows) insert.run(row);
    }
  });
  load();

  sqlite.pragma("query_only = ON");
  return sqlite;
}
