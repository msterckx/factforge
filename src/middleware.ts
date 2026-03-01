import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidLang, DEFAULT_LANG } from "@/i18n";

const SKIP_PREFIXES = ["/api", "/_next", "/uploads"];

// Wrap NextAuth's auth middleware so we can add lang routing alongside it
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";

  // Admin auth logic (unchanged)
  if (isAdminRoute) {
    if (!isLoginPage && !isLoggedIn) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    if (isLoginPage && isLoggedIn) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  // Skip API routes, Next.js internals, static files, and uploaded assets
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (pathname.includes(".")) {
    return NextResponse.next();
  }

  // Lang routing: if first segment is a valid lang, pass through
  const firstSegment = pathname.split("/")[1];
  if (isValidLang(firstSegment)) {
    return NextResponse.next();
  }

  // Redirect to default lang
  const url = req.nextUrl.clone();
  url.pathname = `/${DEFAULT_LANG}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
