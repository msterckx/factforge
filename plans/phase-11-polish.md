# Phase 11: Polish & Error Handling

> Make the app feel complete and handle edge cases gracefully.

## Depends On
- All previous phases (this is the final pass)

## Tasks

### 11.1 Error & Loading States
- [ ] Add `src/app/not-found.tsx` — global 404 page with link to home
- [ ] Add loading spinners/skeletons for page transitions where needed
- [ ] Add error boundaries for unexpected server failures

### 11.2 Responsive Design
- [ ] Verify and fix mobile layout for:
  - Home page category grid (1 column on mobile, 2-3 on desktop)
  - Quiz interface (image scales down, buttons stack vertically)
  - Admin sidebar (collapses to hamburger menu on mobile)
  - Admin tables (horizontal scroll on small screens)

### 11.3 UX Improvements
- [ ] Enter key triggers "Check Answer" on quiz page
- [ ] Auto-focus answer input when navigating to next question
- [ ] Subtle transition/animation on answer check feedback (green/red flash)
- [ ] "Back to Categories" link on quiz page
- [ ] Toast/notification on admin CRUD success (created/updated/deleted)
- [ ] Confirm dialog before delete actions in admin

### 11.4 Security Hardening
- [ ] Verify all admin routes are protected (test without session)
- [ ] Verify image upload validates file type server-side (not just client)
- [ ] Verify image paths cannot escape uploads directory (path traversal)
- [ ] Verify all user inputs are sanitized before DB insertion (Drizzle parameterizes by default)

### 11.5 Final End-to-End Verification
- [ ] Full flow: seed DB → browse categories → complete quiz → admin login → create category → add question with image → verify on public site → edit question → delete question
- [ ] Test with empty database (no categories, no questions) — graceful empty states everywhere
- [ ] Test with various image sizes and formats (jpg, png, webp)
- [ ] Run `npm run build` — production build succeeds with no errors
- [ ] Run production build: `npm start` — verify everything works in production mode

## Files Created/Modified
| File | Action |
|------|--------|
| `src/app/not-found.tsx` | Created |
| Various existing files | Modified for polish |

## Done When
- No broken states or unhandled errors in normal usage
- Mobile-friendly across all pages
- Build succeeds with zero errors
- All CRUD operations work end-to-end
- Security checks pass
