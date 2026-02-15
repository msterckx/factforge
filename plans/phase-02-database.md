# Phase 2: Database Layer

> Define the data model and get the database operational with seed data.

## Depends On
- Phase 1 (project scaffolded, dependencies installed)

## Tasks

### 2.1 Schema Definition
- [ ] Create `src/db/schema.ts` with Drizzle table definitions:
  - **categories** table
    - `id` — integer, primary key, autoincrement
    - `name` — text, not null, unique
    - `slug` — text, not null, unique
    - `created_at` — text, default now
  - **questions** table
    - `id` — integer, primary key, autoincrement
    - `question_text` — text, not null
    - `answer` — text, not null
    - `category_id` — integer, not null, foreign key → categories.id
    - `image_path` — text, nullable (relative path like `/uploads/questions/abc.jpg`)
    - `created_at` — text, default now
    - `updated_at` — text, default now

### 2.2 Database Connection
- [ ] Create `src/db/index.ts` — singleton database connection using better-sqlite3
- [ ] Export typed Drizzle database instance
- [ ] Ensure the connection is reused across hot-reloads in development (store on `globalThis`)

### 2.3 Migrations
- [ ] Add scripts to `package.json`:
  ```json
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio"
  ```
- [ ] Generate initial migration: `npm run db:generate`
- [ ] Run migration to create tables: `npm run db:migrate`

### 2.4 Seed Data
- [ ] Create `src/db/seed.ts` script that:
  - Creates sample categories: Geography, History, Television, Science, Sports
  - Creates 2-3 sample questions per category with placeholder image paths
  - Is idempotent (clears existing data before inserting)
- [ ] Add seed script to `package.json`:
  ```json
  "db:seed": "npx tsx src/db/seed.ts"
  ```
- [ ] Run seed script: `npm run db:seed`
- [ ] Verify data exists using Drizzle Studio: `npm run db:studio`

## Files Created/Modified
| File | Action |
|------|--------|
| `src/db/schema.ts` | Created |
| `src/db/index.ts` | Created |
| `src/db/seed.ts` | Created |
| `package.json` | Modified (added db scripts) |
| `drizzle/` | Generated migration files |
| `factforge.db` | Created (SQLite database file) |

## Done When
- Migration runs without errors
- Seed script populates 5 categories and ~10-15 sample questions
- `npm run db:studio` shows the data in a browser
