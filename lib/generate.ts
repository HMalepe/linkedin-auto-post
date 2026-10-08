import { db, getSettings, type Post } from "./supabase";
import { generateDrafts } from "./claude";
import { logActivity } from "./activity";

export async function generateIntoQueue(count: number, idea?: string) {
  const s = await getSettings();
  const [{ data: recent }, { data: published }] = await Promise.all([
    db().from("posts").select("content").order("created_at", { ascending: false }).limit(15),
    db()
      .from("posts")
      .select("content")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
  ]);

  const drafts = await generateDrafts({
    count,
    settings: s,
    idea,
    recent: (recent ?? []).map((r: { content: string }) => r.content),
    examples: (published ?? []).map((r: { content: string }) => r.content),
  });
  if (!drafts.length) return [];

  const { data, error } = await db()
    .from("posts")
    .insert(drafts.map((d) => ({ content: d.content, topic: d.topic || null, status: "draft", source: "claude" })))
    .select();
  if (error) throw new Error(error.message);
  await logActivity("generate", `Claude wrote ${data.length} draft${data.length === 1 ? "" : "s"}${idea ? " from an idea" : ""}`);
  return data as Post[];
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
