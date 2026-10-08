import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Server-only client using the service role key (bypasses RLS). Never import from client components.
export const db = () =>
  (client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  }));

export const IMAGE_BUCKET = "post-images";

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

export type PostStatus = "draft" | "approved" | "publishing" | "published" | "failed";

export type Post = {
  id: string;
  content: string;
  topic: string | null;
  source: "claude" | "manual";
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  publishing_started_at: string | null;
  linkedin_post_urn: string | null;
  error: string | null;
  attempts: number;
  image_path: string | null;
  image_alt: string | null;
  created_at: string;
  updated_at: string;
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await db().from("settings").select("*").eq("id", 1).single();
  if (error) throw new Error(`settings: ${error.message}`);
  return data as Settings;
}

export async function getPost(id: string): Promise<Post | null> {
  const { data, error } = await db().from("posts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Post | null;
}

// Times of approved posts that already hold a slot (for collision avoidance).
export async function takenSlots(excludeId?: string): Promise<Date[]> {
  let q = db().from("posts").select("id, scheduled_for").eq("status", "approved").not("scheduled_for", "is", null);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { scheduled_for: string }) => new Date(r.scheduled_for));
}
