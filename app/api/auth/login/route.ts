import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { createSession, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return NextResponse.json({ error: "ADMIN_PASSWORD is not set on the server." }, { status: 500 });

  const body = await readJson(req);
  const given = typeof body.password === "string" ? body.password : "";

  if (!given || !safeEqual(given, pw)) {
    // Slow guessing down. (No per-IP counter: serverless instances don't share memory,
    // so rely on a long ADMIN_PASSWORD.)
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(pw), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
