import { db } from "./supabase";
import { getConnection, publishToLinkedIn } from "./linkedin";

export type PublishResult =
  | { ok: true; urn: string }
  | { ok: false; error: string; skipped?: boolean };

// Claims the post atomically (approved/draft/failed -> publishing) so overlapping
// triggers (cron + "post now") cannot double-post.
export async function publishPostById(id: string): Promise<PublishResult> {
  const conn = await getConnection();
  if (!conn) return { ok: false, error: "LinkedIn is not connected", skipped: true };
  if (new Date(conn.expires_at) <= new Date())
    return { ok: false, error: "LinkedIn token expired: reconnect", skipped: true };

  const { data: claimed } = await db()
    .from("posts")
    .update({ status: "publishing", error: null })
    .eq("id", id)
    .in("status", ["draft", "approved", "failed"])
    .select()
    .maybeSingle();
  if (!claimed) return { ok: false, error: "Post not claimable (already publishing/published?)", skipped: true };

  try {
    const urn = await publishToLinkedIn(conn.access_token, conn.member_urn, claimed.content);
    await db()
      .from("posts")
      .update({ status: "published", published_at: new Date().toISOString(), linkedin_post_urn: urn })
      .eq("id", id);
    return { ok: true, urn };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db().from("posts").update({ status: "failed", error }).eq("id", id);
    return { ok: false, error };
  }
}

// One due post per run: avoids bursts that look spammy.
export async function publishNextDue(): Promise<PublishResult | { ok: true; idle: true }> {
  const { data } = await db()
    .from("posts")
    .select("id")
    .eq("status", "approved")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(1);
  if (!data?.length) return { ok: true, idle: true };
  return publishPostById(data[0].id);
}
