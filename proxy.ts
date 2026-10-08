import { NextResponse, type NextRequest } from "next/server";
import { basicAuthOk, isCrossSiteWrite } from "@/lib/auth";

// Single-user gate: HTTP Basic auth with ADMIN_PASSWORD (any username).
// /api/cron/* is exempt here and checks CRON_SECRET itself.
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/cron/")) return NextResponse.next();

  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return new NextResponse("ADMIN_PASSWORD is not set", { status: 500 });

  if (!basicAuthOk(req.headers.get("authorization"), pw))
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="LinkedIn Autoposter", charset="UTF-8"' },
    });

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  if (isCrossSiteWrite({ method: req.method, headers: req.headers, host }))
    return new NextResponse("Cross-site request blocked", { status: 403 });

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
