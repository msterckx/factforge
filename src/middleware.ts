import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { isValidLang, DEFAULT_LANG } from "@/i18n";

const SKIP_PREFIXES = ["/api", "/_next", "/uploads"];

// Wrap NextAuth's auth middleware so we can add lang routing alongside it
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";

  const firstSegment = pathname.split("/")[1];
  const detectedLang = isValidLang(firstSegment) ? firstSegment : DEFAULT_LANG;

  // Pass lang and pathname to server components via request headers
  const withLang = () => {
    const reqHeaders = new Headers(req.headers);
    reqHeaders.set("x-lang", detectedLang);
    reqHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: reqHeaders } });
  };

  // Admin auth logic (unchanged)
  if (isAdminRoute) {
    if (!isLoginPage && !isLoggedIn) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    if (isLoginPage && isLoggedIn) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return withLang();
  }

  // Skip API routes, Next.js internals, static files, and uploaded assets
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return withLang();
  }
  if (pathname.includes(".")) {
    return withLang();
  }

  // Lang routing: if first segment is a valid lang, pass through
  if (isValidLang(firstSegment)) {
    return withLang();
  }

  // Always default to English regardless of browser language
  const preferredLang = DEFAULT_LANG;

  // Redirect to detected (or default) lang
  const url = req.nextUrl.clone();
  url.pathname = `/${preferredLang}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
