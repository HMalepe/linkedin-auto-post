// Client-side helpers and types shared by the dashboard components.
import { zonedParts, zonedTimeToUtc } from "@/lib/schedule";

export type Status = "draft" | "approved" | "publishing" | "published" | "failed";

export type Post = {
  id: string;
  content: string;
  topic: string | null;
  source: "claude" | "manual";
  status: Status;
  scheduled_for: string | null;
  published_at: string | null;
  linkedin_post_urn: string | null;
  error: string | null;
  attempts: number;
  image_path: string | null;
  image_alt: string | null;
  image_url: string | null;
  created_at: string;
};

export type Settings = {
  topics: string[];
  voice: string;
  rules: string;
  post_times: string[];
  post_days: number[];
  timezone: string;
  auto_generate: boolean;
  queue_target: number;
  max_hashtags: number;
};

export type Conn = { connected: boolean; name?: string | null; picture?: string | null; expires_at?: string };

export type SettingsResponse = { settings: Settings; upcoming: string[]; model: string; connection: Conn };

export type Activity = { id: number; at: string; kind: string; ok: boolean; message: string; post_id: string | null };

export type Check = { id: string; label: string; ok: boolean; hint?: string };

export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `HTTP ${res.status}`);
  return json as T;
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

// Times are shown and entered in the configured posting time zone, not the browser's.
export function fmt(iso: string | null, tz: string) {
  if (!iso) return "unscheduled";
  return new Date(iso).toLocaleString(undefined, {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toZonedInput(iso: string | null, tz: string) {
  if (!iso) return "";
  const p = zonedParts(new Date(iso), tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function fromZonedInput(value: string, tz: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return undefined;
  return zonedTimeToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], tz).toISOString();
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
