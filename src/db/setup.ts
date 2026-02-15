import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";

const dbDir = process.env.DATABASE_DIR || process.cwd();
const dbPath = path.join(dbDir, "factforge.db");
const migrationsFolder = path.join(process.cwd(), "drizzle");

// Ensure the directory exists
fs.mkdirSync(dbDir, { recursive: true });

console.log(`Setting up database at ${dbPath}...`);
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder });
console.log("Database ready. Migrations applied.");

sqlite.close();
