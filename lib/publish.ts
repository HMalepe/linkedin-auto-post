import { db, type Post } from "./supabase";
import { getConnection, LinkedInError, linkedinVersion, publishToLinkedIn, uploadImage } from "./linkedin";
import { downloadImage } from "./images";
import { logActivity } from "./activity";

export const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MIN = 20;
const STALE_PUBLISHING_MIN = 10;

export type PublishResult =
  | { ok: true; urn: string }
  | { ok: false; error: string; skipped?: boolean; retrying?: boolean };

// Claims the post atomically (draft/approved/failed -> publishing) so overlapping
// triggers (cron + "post now") cannot double-post.
export async function publishPostById(id: string): Promise<PublishResult> {
  const conn = await getConnection();
  if (!conn) return { ok: false, error: "LinkedIn is not connected", skipped: true };
  if (new Date(conn.expires_at) <= new Date())
    return { ok: false, error: "LinkedIn token expired: reconnect", skipped: true };

  const { data: claimed } = await db()
    .from("posts")
    .update({ status: "publishing", error: null, publishing_started_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "approved", "failed"])
    .select()
    .maybeSingle();
  if (!claimed) return { ok: false, error: "Post not claimable (already publishing/published?)", skipped: true };
  const post = claimed as Post;
  const attempts = (post.attempts ?? 0) + 1;

  try {
    let image: { urn: string; alt: string | null } | undefined;
    if (post.image_path) {
      const { bytes, contentType } = await downloadImage(post.image_path);
      image = { urn: await uploadImage(conn.access_token, conn.member_urn, bytes, contentType), alt: post.image_alt };
    }
    const urn = await publishToLinkedIn(conn.access_token, conn.member_urn, post.content, image);
    await db()
      .from("posts")
      .update({ status: "published", published_at: new Date().toISOString(), linkedin_post_urn: urn, attempts })
      .eq("id", id);
    await logActivity("publish", `Published "${snippet(post.content)}"`, { postId: id });
    return { ok: true, urn };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const li = e instanceof LinkedInError ? e : null;

    if (li?.retryable && attempts < MAX_ATTEMPTS) {
      const retryAt = new Date(Date.now() + RETRY_DELAY_MIN * attempts * 60_000);
      const error = `Attempt ${attempts}/${MAX_ATTEMPTS} failed, retrying around ${retryAt.toISOString()}: ${err}`;
      await db().from("posts").update({ status: "approved", scheduled_for: retryAt.toISOString(), error, attempts }).eq("id", id);
      await logActivity("publish", error, { ok: false, postId: id });
      return { ok: false, error, retrying: true };
    }

    let error = err;
    if (li?.versionSunset)
      error = `LinkedIn retired API version ${linkedinVersion()}. Set LINKEDIN_VERSION to a newer YYYYMM version (see README), redeploy, then retry. ${err}`;
    else if (li?.authProblem) error = `LinkedIn rejected the token (401). Reconnect LinkedIn, then retry. ${err}`;
    else if (li?.outcomeUnknown)
      error = `LinkedIn may or may not have published this. Check your profile before retrying. ${err}`;
    await db().from("posts").update({ status: "failed", error, attempts }).eq("id", id);
    await logActivity("publish", `Failed: ${error}`, { ok: false, postId: id });
    return { ok: false, error };
  }
}

// A function that dies mid-publish leaves a post stuck in "publishing".
// We can't know whether LinkedIn received it, so fail it loudly instead of retrying.
export async function recoverStalePublishing() {
  const cutoff = new Date(Date.now() - STALE_PUBLISHING_MIN * 60_000).toISOString();
  const { data } = await db()
    .from("posts")
    .update({
      status: "failed",
      error: "Publishing was interrupted. Check your LinkedIn profile before retrying so it isn't posted twice.",
    })
    .eq("status", "publishing")
    .lt("publishing_started_at", cutoff)
    .select("id");
  for (const r of data ?? []) await logActivity("publish", "Recovered a stuck publish", { ok: false, postId: r.id });
  return data?.length ?? 0;
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

export const snippet = (s: string, n = 60) => {
  const line = s.split("\n")[0].trim();
  return line.length > n ? line.slice(0, n - 1) + "…" : line;
};
