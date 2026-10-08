// Request-body sanitisers. Pure so they can be unit tested.
import { isValidTime, isValidTimeZone } from "./schedule";
import { MAX_POST_CHARS } from "./prompts";
import type { Settings } from "./supabase";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : dflt;
};

export function parseSettings(b: Record<string, unknown>): Result<Settings> {
  const timezone = String(b.timezone ?? "").trim();
  if (!isValidTimeZone(timezone)) return { ok: false, error: `Unknown time zone "${timezone}"` };

  const rawTimes = Array.isArray(b.post_times) ? b.post_times.map((t) => String(t).trim()).filter(Boolean) : [];
  const bad = rawTimes.find((t) => !isValidTime(t));
  if (bad) return { ok: false, error: `"${bad}" is not a valid HH:MM time` };
  const post_times = [...new Set(rawTimes)].sort();
  if (!post_times.length) return { ok: false, error: "Add at least one posting time" };

  const post_days = Array.isArray(b.post_days)
    ? [...new Set(b.post_days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  if (!post_days.length) return { ok: false, error: "Pick at least one posting day" };

  return {
    ok: true,
    value: {
      topics: Array.isArray(b.topics)
        ? b.topics.map((t) => String(t).trim()).filter(Boolean).slice(0, 50)
        : [],
      voice: String(b.voice ?? "").slice(0, 5000),
      rules: String(b.rules ?? "").slice(0, 3000),
      post_times,
      post_days,
      timezone,
      auto_generate: !!b.auto_generate,
      queue_target: clampInt(b.queue_target, 1, 20, 5),
      max_hashtags: clampInt(b.max_hashtags, 0, 10, 3),
    },
  };
}

export type PostPatch = {
  content?: string;
  scheduled_for?: string | null;
  status?: "approved" | "draft";
  image_alt?: string | null;
  topic?: string | null;
};

export function parsePostPatch(b: Record<string, unknown>): Result<PostPatch> {
  const out: PostPatch = {};
  if (b.content !== undefined) {
    if (typeof b.content !== "string" || !b.content.trim()) return { ok: false, error: "Content can't be empty" };
    if (b.content.length > MAX_POST_CHARS) return { ok: false, error: `Max ${MAX_POST_CHARS} characters` };
    out.content = b.content;
  }
  if (b.scheduled_for !== undefined) {
    if (b.scheduled_for === null || b.scheduled_for === "") out.scheduled_for = null;
    else {
      const d = new Date(String(b.scheduled_for));
      if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid schedule time" };
      out.scheduled_for = d.toISOString();
    }
  }
  if (b.status !== undefined) {
    if (b.status !== "approved" && b.status !== "draft") return { ok: false, error: "Status must be approved or draft" };
    out.status = b.status;
  }
  if (b.image_alt !== undefined) out.image_alt = b.image_alt ? String(b.image_alt).slice(0, 4000) : null;
  if (b.topic !== undefined) out.topic = b.topic ? String(b.topic).slice(0, 200) : null;
  return { ok: true, value: out };
}
