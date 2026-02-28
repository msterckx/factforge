import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";

console.log("=== House of Trivia Database Setup ===");
console.log(`  NODE_ENV:      ${process.env.NODE_ENV || "(not set)"}`);
console.log(`  DATABASE_DIR:  ${process.env.DATABASE_DIR || "(not set, using cwd)"}`);
console.log(`  cwd:           ${process.cwd()}`);

const dbDir = process.env.DATABASE_DIR || process.cwd();
const dbPath = path.join(dbDir, "houseoftrivia.db");
const migrationsFolder = path.join(process.cwd(), "drizzle");

console.log(`  DB path:       ${dbPath}`);
console.log(`  Migrations:    ${migrationsFolder}`);

// Check if DB already exists
const dbExists = fs.existsSync(dbPath);
console.log(`  DB exists:     ${dbExists}`);

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
  console.log(`  Creating directory: ${dbDir}`);
  fs.mkdirSync(dbDir, { recursive: true });
}

// Verify directory is writable
try {
  fs.accessSync(dbDir, fs.constants.W_OK);
  console.log(`  Directory writable: yes`);
} catch {
  console.error(`  ERROR: Directory ${dbDir} is not writable!`);
  process.exit(1);
}

console.log("  Opening database...");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

console.log("  Running migrations...");
migrate(db, { migrationsFolder });

// Verify tables exist
const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
console.log(`  Tables found:  ${tables.map(t => t.name).join(", ") || "(none)"}`);

sqlite.close();
console.log("=== Database ready ===");
