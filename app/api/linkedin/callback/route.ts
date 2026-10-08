import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, fetchUserinfo } from "@/lib/linkedin";
import { db } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const home = (q: string) => NextResponse.redirect(`${process.env.APP_URL}/?${q}`);

  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (err) return home(`li_error=${encodeURIComponent(err)}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("li_state")?.value)
    return home("li_error=state_mismatch");

  try {
    const tok = await exchangeCode(code);
    const me = await fetchUserinfo(tok.access_token);
    const { error } = await db()
      .from("linkedin_connection")
      .upsert({
        id: 1,
        member_urn: `urn:li:person:${me.sub}`,
        name: me.name ?? null,
        access_token: tok.access_token,
        expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    const res = home("li_connected=1");
    res.cookies.delete("li_state");
    return res;
  } catch (e) {
    return home(`li_error=${encodeURIComponent(e instanceof Error ? e.message : "failed")}`);
  }
}
