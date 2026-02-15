# Phase 6: Authentication

> Lock down the admin panel behind a login.

## Depends On
- Phase 1 (dependencies installed: next-auth, bcryptjs)

## Tasks

### 6.1 NextAuth Configuration
- [ ] Create `src/lib/auth.ts`
  - Configure NextAuth with CredentialsProvider
  - `authorize` function compares input against `ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars
  - Simple direct comparison (no DB lookup needed — single admin account)
  - Configure session strategy as JWT
  - Define session/jwt callbacks to include user info
  - Export `auth`, `signIn`, `signOut` helpers

### 6.2 Auth API Route
- [ ] Create `src/app/api/auth/[...nextauth]/route.ts`
  - Export GET and POST handlers from NextAuth config

### 6.3 Login Page
- [ ] Create `src/app/admin/login/page.tsx`
  - Username and password input fields
  - Submit button
  - Error message display on failed login
  - Redirect to `/admin` on success
  - Clean, centered form design
  - Should NOT use the admin layout (no sidebar, no auth check)

### 6.4 Admin Layout with Auth Guard
- [ ] Create `src/app/admin/layout.tsx`
  - Check session server-side using `auth()`
  - Redirect unauthenticated users to `/admin/login`
  - Wrap authenticated content with admin navigation (sidebar built in Phase 7)
  - Exclude the login page from auth check (login is a nested route but should be accessible)

### 6.5 Verification
- [ ] Test login with correct credentials → redirects to `/admin`
- [ ] Test login with wrong credentials → shows error message
- [ ] Test accessing `/admin` directly without login → redirects to `/admin/login`
- [ ] Test logout → session cleared, redirected to login

## Files Created/Modified
| File | Action |
|------|--------|
| `src/lib/auth.ts` | Created |
| `src/app/api/auth/[...nextauth]/route.ts` | Created |
| `src/app/admin/login/page.tsx` | Created |
| `src/app/admin/layout.tsx` | Created |

## Done When
- Admin login works with env var credentials
- Unauthenticated access to `/admin/*` redirects to login
- Login page is accessible without authentication
- Session persists across page reloads
