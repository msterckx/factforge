# Phase 7: Admin Panel — Dashboard

> Entry point for administrators after login.

## Depends On
- Phase 2 (database — for querying stats)
- Phase 6 (authentication — admin must be logged in)

## Tasks

- [ ] Create `src/components/AdminSidebar.tsx`
  - Navigation links: Dashboard, Categories, Questions
  - Logout button (calls NextAuth signOut)
  - Highlight the currently active link
  - Collapsible on mobile (hamburger menu)
  - Consistent styling with the rest of the app

- [ ] Create `src/app/admin/page.tsx` (dashboard)
  - Server Component: fetch counts from DB
  - Display stat cards showing:
    - Total number of categories
    - Total number of questions
    - Questions without images (to flag incomplete entries)
  - Quick-action links: "Add Category", "Add Question"
  - Welcome message or app name

- [ ] Wire AdminSidebar into `src/app/admin/layout.tsx`
  - Sidebar on the left, content area on the right
  - Responsive: sidebar collapses on mobile

- [ ] Verify dashboard loads with correct stats after login

## Files Created/Modified
| File | Action |
|------|--------|
| `src/components/AdminSidebar.tsx` | Created |
| `src/app/admin/page.tsx` | Created |
| `src/app/admin/layout.tsx` | Modified (add sidebar) |

## Done When
- After login, admin sees a dashboard with correct category/question counts
- Sidebar navigation links are visible and functional
- Quick-action links point to correct pages (even if those pages don't exist yet)
- Mobile layout collapses sidebar appropriately
