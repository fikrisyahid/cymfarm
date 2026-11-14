import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "cymfarm_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets, API routes, manifest, and service worker
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const rawCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session: { username: string; role: "ADMIN" | "USER" } | null = null;

  if (rawCookie) {
    try {
      session = JSON.parse(decodeURIComponent(rawCookie));
    } catch {
      session = null;
    }
  }

  // If not logged in and not on /login -> redirect to /login
  if (!session && pathname !== "/login") {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If logged in and visiting /login or root / -> redirect to /lapangan
  if (session && (pathname === "/login" || pathname === "/")) {
    const fieldUrl = new URL("/lapangan", request.url);
    return NextResponse.redirect(fieldUrl);
  }

  // Role check: USER cannot access /admin
  if (session && pathname.startsWith("/admin") && session.role !== "ADMIN") {
    const fieldUrl = new URL("/lapangan", request.url);
    return NextResponse.redirect(fieldUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
