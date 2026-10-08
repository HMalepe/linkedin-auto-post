import { db, getSettings } from "./supabase";
import { generateDrafts } from "./claude";

export async function generateIntoQueue(count: number) {
  const s = await getSettings();
  const { data: recent } = await db()
    .from("posts")
    .select("content")
    .order("created_at", { ascending: false })
    .limit(15);
  const drafts = await generateDrafts(
    count,
    s,
    (recent ?? []).map((r: { content: string }) => r.content),
  );
  if (!drafts.length) return [];
  const { data, error } = await db()
    .from("posts")
    .insert(drafts.map((d) => ({ content: d.content, topic: d.topic, status: "draft" })))
    .select();
  if (error) throw new Error(error.message);
  return data;
}

// Used by the cron: keep (drafts + approved-but-unpublished) at queue_target.
export async function topUpQueue() {
  const s = await getSettings();
  if (!s.auto_generate) return 0;
  const { count } = await db()
    .from("posts")
    .select("id", { count: "exact", head: true })
    .in("status", ["draft", "approved"]);
  const need = Math.min(s.queue_target - (count ?? 0), 5);
  if (need <= 0) return 0;
  const made = await generateIntoQueue(need);
  return made.length;
}
