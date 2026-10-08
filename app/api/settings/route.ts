import { db, getSettings, takenSlots } from "@/lib/supabase";
import { getConnection } from "@/lib/linkedin";
import { nextSlots } from "@/lib/schedule";
import { parseSettings } from "@/lib/validate";
import { model } from "@/lib/claude";
import { fail, json, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [settings, conn, taken] = await Promise.all([getSettings(), getConnection(), takenSlots()]);
    const upcoming = nextSlots(
      5,
      { times: settings.post_times, days: settings.post_days, timezone: settings.timezone },
      new Date(),
      taken,
    ).map((d) => d.toISOString());
    return json({
      settings,
      upcoming,
      model: model(),
      connection: conn
        ? { connected: true, name: conn.name, picture: conn.picture, expires_at: conn.expires_at }
        : { connected: false },
    });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request) {
  const parsed = parseSettings(await readJson(req));
  if (!parsed.ok) return fail(parsed.error, 400);
  const { error } = await db().from("settings").update(parsed.value).eq("id", 1);
  if (error) return fail(error.message);
  return json({ ok: true, settings: parsed.value });
}
