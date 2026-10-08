import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, fetchUserinfo } from "@/lib/linkedin";
import { db } from "@/lib/supabase";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/http";
import { safeEqual } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const home = (q: string) => {
    const res = NextResponse.redirect(`${process.env.APP_URL}/?${q}`);
    res.cookies.delete("li_state");
    return res;
  };

  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (err) return home(`li_error=${encodeURIComponent(err)}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get("li_state")?.value;
  if (!code || !state || !expected || !safeEqual(state, expected)) return home("li_error=state_mismatch");

  try {
    const tok = await exchangeCode(code);
    const me = await fetchUserinfo(tok.access_token);
    const { error } = await db()
      .from("linkedin_connection")
      .upsert({
        id: 1,
        member_urn: `urn:li:person:${me.sub}`,
        name: me.name ?? null,
        picture: me.picture ?? null,
        access_token: tok.access_token,
        expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    await logActivity("connect", `Connected LinkedIn as ${me.name ?? me.sub}`);
    return home("li_connected=1");
  } catch (e) {
    await logActivity("connect", `LinkedIn connect failed: ${errorMessage(e)}`, { ok: false });
    return home(`li_error=${encodeURIComponent(errorMessage(e))}`);
  }
}
