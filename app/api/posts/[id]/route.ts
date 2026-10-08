import { NextResponse } from "next/server";
import { db, getSettings } from "@/lib/supabase";
import { nextSlots } from "@/lib/schedule";

type Ctx = { params: Promise<{ id: string }> };

const MAX_LEN = 3000; // LinkedIn commentary limit

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = await req.json();
  const patch: Record<string, unknown> = {};

  if (typeof b.content === "string") {
    if (b.content.length > MAX_LEN)
      return NextResponse.json({ error: `Max ${MAX_LEN} characters` }, { status: 400 });
    patch.content = b.content;
  }
  if (b.scheduled_for !== undefined) patch.scheduled_for = b.scheduled_for;

  if (b.status === "approved") {
    patch.status = "approved";
    patch.error = null;
    if (!patch.scheduled_for) {
      const s = await getSettings();
      const { data: taken } = await db()
        .from("posts")
        .select("scheduled_for")
        .eq("status", "approved")
        .not("scheduled_for", "is", null);
      const [slot] = nextSlots(
        1,
        s.post_times,
        s.utc_offset_minutes,
        new Date(),
        (taken ?? []).map((t: { scheduled_for: string }) => new Date(t.scheduled_for)),
      );
      patch.scheduled_for = slot.toISOString();
    }
  } else if (b.status === "draft") {
    patch.status = "draft";
    patch.scheduled_for = null;
  }

  const { data, error } = await db()
    .from("posts")
    .update(patch)
    .eq("id", id)
    .in("status", ["draft", "approved", "failed"]) // never edit in-flight or published posts
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Post not editable" }, { status: 409 });
  return NextResponse.json({ post: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { error } = await db().from("posts").delete().eq("id", id).neq("status", "publishing");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
