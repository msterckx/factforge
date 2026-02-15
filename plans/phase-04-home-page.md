# Phase 4: Public Pages — Home (Category Listing)

> Users land here and pick a category to start quizzing.

## Depends On
- Phase 2 (database with seed data)
- Phase 3 (layout and navbar)

## Tasks

- [ ] Create `src/components/CategoryCard.tsx`
  - Displays category name prominently
  - Shows question count for that category (e.g., "12 questions")
  - Styled as a clickable card with hover effect
  - Links to `/category/[slug]`
  - Responsive: looks good at various widths

- [ ] Build `src/app/page.tsx` (home page)
  - Server Component: fetches all categories with question counts from DB
  - Query joins categories with question count
  - Renders a responsive grid of CategoryCard components
  - Page heading: "Choose a Category" or similar
  - Shows friendly message if no categories exist yet

- [ ] Add a loading state `src/app/loading.tsx`
  - Simple skeleton/spinner for page transitions

- [ ] Verify: home page shows seeded categories with correct question counts

## Files Created/Modified
| File | Action |
|------|--------|
| `src/components/CategoryCard.tsx` | Created |
| `src/app/page.tsx` | Modified (replace default Next.js content) |
| `src/app/loading.tsx` | Created |

## Done When
- Home page displays all seeded categories as a card grid
- Each card shows the category name and correct question count
- Clicking a card navigates to `/category/[slug]` (404 is fine — quiz page is Phase 5)
- Empty state works if no categories in DB
