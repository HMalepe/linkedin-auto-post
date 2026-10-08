import { db } from "./supabase";

export type ActivityKind = "cron" | "publish" | "generate" | "connect" | "token";

// Best-effort audit log. Never throws: logging must not break the action being logged.
export async function logActivity(
  kind: ActivityKind,
  message: string,
  opts: { ok?: boolean; postId?: string | null } = {},
) {
  try {
    await db()
      .from("activity")
      .insert({ kind, message: message.slice(0, 2000), ok: opts.ok ?? true, post_id: opts.postId ?? null });
  } catch {
    /* ignore */
  }
}

export async function loggedRecently(kind: ActivityKind, hours: number) {
  const { count } = await db()
    .from("activity")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .gte("at", new Date(Date.now() - hours * 3_600_000).toISOString());
  return (count ?? 0) > 0;
}

export async function pruneActivity(days = 90) {
  try {
    await db()
      .from("activity")
      .delete()
      .lt("at", new Date(Date.now() - days * 86_400_000).toISOString());
  } catch {
    /* ignore */
  }
}
