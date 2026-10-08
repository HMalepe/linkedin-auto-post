import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { authUrl } from "@/lib/linkedin";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("li_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
