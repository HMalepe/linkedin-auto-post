import { db, getPost, getSettings, takenSlots } from "@/lib/supabase";
import { nextSlots } from "@/lib/schedule";
import { parsePostPatch } from "@/lib/validate";
import { removeImage } from "@/lib/images";
import { fail, json, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = ["draft", "approved", "failed"]; // never edit in-flight or published posts

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = parsePostPatch(await readJson(req));
  if (!parsed.ok) return fail(parsed.error, 400);
  const b = parsed.value;

  const patch: Record<string, unknown> = {};
  if (b.content !== undefined) patch.content = b.content;
  if (b.image_alt !== undefined) patch.image_alt = b.image_alt;
  if (b.topic !== undefined) patch.topic = b.topic;
  if (b.scheduled_for !== undefined) patch.scheduled_for = b.scheduled_for;

  if (b.status === "approved") {
    patch.status = "approved";
    patch.error = null;
    patch.attempts = 0;
  } else if (b.status === "draft") {
    patch.status = "draft";
    patch.scheduled_for = null;
  }

  // An approved post always needs a time: if none was given (or it was cleared), take the next free slot.
  const needsSlot =
    !patch.scheduled_for &&
    (b.status === "approved" ||
      (b.status === undefined && b.scheduled_for === null && (await getPost(id))?.status === "approved"));
  if (needsSlot) {
    const s = await getSettings();
    const [slot] = nextSlots(
      1,
      { times: s.post_times, days: s.post_days, timezone: s.timezone },
      new Date(),
      await takenSlots(id),
    );
    patch.scheduled_for = slot.toISOString();
  }

  if (!Object.keys(patch).length) return fail("Nothing to change", 400);

  const { data, error } = await db()
    .from("posts")
    .update(patch)
    .eq("id", id)
    .in("status", EDITABLE)
    .select()
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("Post not editable", 409);
  return json({ post: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { data, error } = await db().from("posts").delete().eq("id", id).neq("status", "publishing").select("image_path");
  if (error) return fail(error.message);
  if (!data?.length) return fail("Post not found or currently publishing", 409);
  await removeImage(data[0].image_path).catch(() => {});
  return json({ ok: true });
}
