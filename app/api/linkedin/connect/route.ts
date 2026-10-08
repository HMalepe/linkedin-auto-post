import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { authUrl } from "@/lib/linkedin";

export async function GET() {
  if (!process.env.LINKEDIN_CLIENT_ID || !process.env.APP_URL)
    return new NextResponse("LINKEDIN_CLIENT_ID and APP_URL must be set", { status: 500 });
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("li_state", state, {
    httpOnly: true,
    secure: process.env.APP_URL.startsWith("https://"),
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
