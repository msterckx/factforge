# Phase 3: Shared Layout & Navigation

> Build the application shell that wraps all pages.

## Depends On
- Phase 1 (project scaffolded)

## Tasks

- [ ] Create `src/components/Navbar.tsx`
  - Game of Trivia logo/brand text linking to home (`/`)
  - Clean, minimal top navigation bar
  - Styled with Tailwind (dark background, white text, or similar)

- [ ] Update `src/app/layout.tsx` (root layout)
  - Include Navbar component
  - Set page metadata: `title: "Game of Trivia"`, description
  - Apply global font (e.g., Inter via next/font)
  - Wrap children in a main container with sensible max-width and padding

- [ ] Update `src/app/globals.css`
  - Tailwind directives (`@tailwind base`, `components`, `utilities`)
  - Custom base styles if needed (body background color, font smoothing)

- [ ] Verify layout renders correctly at `http://localhost:3000`
  - Navbar visible at top
  - Content area properly centered/padded

## Files Created/Modified
| File | Action |
|------|--------|
| `src/components/Navbar.tsx` | Created |
| `src/app/layout.tsx` | Modified |
| `src/app/globals.css` | Modified |

## Done When
- Navbar appears on all pages
- Brand text links to home
- Layout looks clean with consistent spacing
