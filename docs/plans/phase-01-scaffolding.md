# Phase 1: Project Scaffolding & Configuration

> Set up the project foundation. Nothing works yet, but everything is wired.

## Prerequisites
- Node.js 18+ installed
- npm available

## Tasks

- [ ] Initialize Next.js project with TypeScript, Tailwind CSS, App Router, `src/` directory
  ```bash
  npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
  ```

- [ ] Install production dependencies
  ```bash
  npm install drizzle-orm better-sqlite3 next-auth@beta @auth/core bcryptjs uuid zod
  ```

- [ ] Install dev dependencies
  ```bash
  npm install -D drizzle-kit @types/better-sqlite3 @types/bcryptjs @types/uuid
  ```

- [ ] Create `.env.local` with required environment variables
  ```
  NEXTAUTH_SECRET=<generated-random-string>
  NEXTAUTH_URL=http://localhost:3000
  ADMIN_USERNAME=admin
  ADMIN_PASSWORD=changeme
  ```

- [ ] Update `.gitignore` to include:
  ```
  gameoftrivia.db
  .env.local
  public/uploads/questions/*
  !public/uploads/questions/.gitkeep
  ```

- [ ] Create `drizzle.config.ts` pointing to local SQLite file
  ```typescript
  import { defineConfig } from "drizzle-kit";
  export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "sqlite",
    dbCredentials: { url: "./gameoftrivia.db" },
  });
  ```

- [ ] Create empty upload directory with gitkeep
  ```
  public/uploads/questions/.gitkeep
  ```

- [ ] Verify project runs with `npm run dev` — default Next.js page loads at http://localhost:3000

## Files Created/Modified
| File | Action |
|------|--------|
| `package.json` | Created by create-next-app, deps added |
| `.env.local` | Created |
| `.gitignore` | Modified |
| `drizzle.config.ts` | Created |
| `public/uploads/questions/.gitkeep` | Created |

## Done When
- `npm run dev` starts without errors
- All dependencies installed
- Environment variables configured
