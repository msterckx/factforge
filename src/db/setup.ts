import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";

const dbPath = path.join(process.cwd(), "factforge.db");
const migrationsFolder = path.join(process.cwd(), "drizzle");

console.log("Setting up database...");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder });
console.log("Database ready. Migrations applied.");

sqlite.close();
