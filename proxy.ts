import { NextResponse, type NextRequest } from "next/server";
import { basicAuthOk, isCrossSiteWrite } from "@/lib/auth";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Single-user gate. A signed session cookie (set by /api/auth/login) lets the browser in;
// HTTP Basic auth with the admin password still works for scripts/curl.
// /api/cron/* is exempt here and checks CRON_SECRET itself.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return new NextResponse("ADMIN_PASSWORD is not set", { status: 500 });

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  if (isCrossSiteWrite({ method: req.method, headers: req.headers, host }))
    return new NextResponse("Cross-site request blocked", { status: 403 });

  const signedIn =
    (await verifySession(req.cookies.get(SESSION_COOKIE)?.value, pw)) ||
    basicAuthOk(req.headers.get("authorization"), pw);

  // The sign-in page and endpoint must be reachable without a session.
  if (pathname === "/login" || pathname === "/api/auth/login") {
    if (pathname === "/login" && signedIn) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (signedIn) return NextResponse.next();

  // No WWW-Authenticate header: browsers must never show their native password popup.
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
