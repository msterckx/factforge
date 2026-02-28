# House of Trivia - Implementation Plan

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) with TypeScript |
| Database | SQLite via better-sqlite3 |
| ORM | Drizzle ORM |
| Styling | Tailwind CSS |
| Auth | NextAuth.js (Credentials Provider, single admin via env vars) |
| Image Storage | Local filesystem (`public/uploads/`) |
| Validation | Zod |

## Phase Overview & Progress

| # | Phase | Plan File | Status |
|---|-------|-----------|--------|
| 1 | Project Scaffolding & Configuration | [phase-01-scaffolding.md](phase-01-scaffolding.md) | [ ] |
| 2 | Database Layer | [phase-02-database.md](phase-02-database.md) | [ ] |
| 3 | Shared Layout & Navigation | [phase-03-layout.md](phase-03-layout.md) | [ ] |
| 4 | Home Page — Category Listing | [phase-04-home-page.md](phase-04-home-page.md) | [ ] |
| 5 | Quiz Interface | [phase-05-quiz-interface.md](phase-05-quiz-interface.md) | [ ] |
| 6 | Authentication | [phase-06-authentication.md](phase-06-authentication.md) | [ ] |
| 7 | Admin Dashboard | [phase-07-admin-dashboard.md](phase-07-admin-dashboard.md) | [ ] |
| 8 | Category Management | [phase-08-category-management.md](phase-08-category-management.md) | [ ] |
| 9 | Image Upload System | [phase-09-image-uploads.md](phase-09-image-uploads.md) | [ ] |
| 10 | Question Management | [phase-10-question-management.md](phase-10-question-management.md) | [ ] |
| 11 | Polish & Error Handling | [phase-11-polish.md](phase-11-polish.md) | [ ] |

## Dependency Graph

```
Phase 1 (Scaffolding)
  ├── Phase 2 (Database)
  │     ├── Phase 4 (Home Page) ← also needs Phase 3
  │     ├── Phase 5 (Quiz) ← also needs Phase 3, 4
  │     ├── Phase 7 (Admin Dashboard) ← also needs Phase 6
  │     ├── Phase 8 (Category CRUD) ← also needs Phase 6, 7
  │     └── Phase 10 (Question CRUD) ← also needs Phase 6, 7, 8, 9
  ├── Phase 3 (Layout)
  ├── Phase 6 (Auth)
  └── Phase 9 (Image Uploads)

Phase 11 (Polish) ← depends on all above
```

## Database Schema

- **categories** — `id`, `name`, `slug`, `created_at`
- **questions** — `id`, `question_text`, `answer`, `category_id` (FK), `image_path`, `created_at`, `updated_at`

No user accounts — quiz-takers are anonymous. Single admin via environment variables.
