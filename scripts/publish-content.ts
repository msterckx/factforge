/**
 * publish-content.ts
 * Exports the public content tables from the local authoring database to
 * content/published/<table>.json — the snapshot the live site serves (see
 * src/content/published.ts). Commit the result and deploy to publish.
 *
 * Usage:
 *   npm run content:publish                 # from ./gameoftrivia.db
 *   npm run content:publish -- --db=path/to/gameoftrivia.db
 *   npm run content:publish -- --check      # only report what would change
 *
 * After writing, the snapshot is loaded into an in-memory database exactly as
 * production does, so a schema mismatch fails here instead of on the server.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { PUBLISHED_TABLES, PUBLISHED_DIR, openPublishedContent } from "../src/content/published";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
) as Record<string, string | boolean>;

const dbPath = path.resolve(typeof args.db === "string" ? args.db : "gameoftrivia.db");
const checkOnly = Boolean(args.check);

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

const source = new Database(dbPath, { readonly: true, fileMustExist: true });
console.log(`Source:  ${dbPath}`);
console.log(`Target:  ${path.relative(process.cwd(), PUBLISHED_DIR)}/${checkOnly ? "  (check only — nothing written)" : ""}\n`);

if (!checkOnly) fs.mkdirSync(PUBLISHED_DIR, { recursive: true });

let changedTables = 0;
for (const table of PUBLISHED_TABLES) {
  const rows = source.prepare(`SELECT * FROM "${table}" ORDER BY id`).all();
  const json = JSON.stringify(rows, null, 2) + "\n";
  const file = path.join(PUBLISHED_DIR, `${table}.json`);
  const previous = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : null;
  const status = previous === null ? "new" : previous === json ? "unchanged" : "changed";
  if (status !== "unchanged") changedTables++;
  console.log(`  ${table.padEnd(26)} ${String(rows.length).padStart(5)} rows  ${status}`);
  if (!checkOnly && status !== "unchanged") fs.writeFileSync(file, json, "utf-8");
}
source.close();

if (checkOnly) {
  console.log(`\n${changedTables} table(s) would change.`);
  process.exit(0);
}

// Load the snapshot the way production does — fails loudly on any mismatch.
const published = openPublishedContent();
for (const table of PUBLISHED_TABLES) {
  const { n } = published.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number };
  const expected = (JSON.parse(fs.readFileSync(path.join(PUBLISHED_DIR, `${table}.json`), "utf-8")) as unknown[]).length;
  if (n !== expected) throw new Error(`${table}: loaded ${n} rows, expected ${expected}`);
}
published.close();

console.log(`\n✓ ${changedTables} table(s) updated; snapshot verified by loading it like production.`);
console.log(`  Next: review with "git diff content/published", commit, and deploy.`);
