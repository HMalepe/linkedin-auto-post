import { NextResponse, type NextRequest } from "next/server";

// Single-user gate: HTTP Basic auth with ADMIN_PASSWORD (any username).
// /api/cron/* is exempt here and checks CRON_SECRET itself.
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/cron/")) return NextResponse.next();

  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return new NextResponse("ADMIN_PASSWORD is not set", { status: 500 });

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (given === pw) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="LinkedIn Autoposter"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
