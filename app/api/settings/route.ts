import { NextResponse } from "next/server";
import { db, getSettings } from "@/lib/supabase";
import { getConnection } from "@/lib/linkedin";

export async function GET() {
  const [settings, conn] = await Promise.all([getSettings(), getConnection()]);
  return NextResponse.json({
    settings,
    connection: conn
      ? { connected: true, name: conn.name, expires_at: conn.expires_at }
      : { connected: false },
  });
}

export async function PUT(req: Request) {
  const b = await req.json();
  const patch = {
    topics: Array.isArray(b.topics) ? b.topics.map(String).map((t: string) => t.trim()).filter(Boolean) : [],
    voice: String(b.voice ?? ""),
    post_times: Array.isArray(b.post_times)
      ? b.post_times.map(String).filter((t: string) => /^\d{2}:\d{2}$/.test(t))
      : ["08:00"],
    utc_offset_minutes: Number.isFinite(b.utc_offset_minutes) ? Math.trunc(b.utc_offset_minutes) : 120,
    auto_generate: !!b.auto_generate,
    queue_target: Math.min(Math.max(Number(b.queue_target) || 5, 1), 20),
  };
  const { error } = await db().from("settings").update(patch).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
