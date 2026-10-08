import { createClient } from "@supabase/supabase-js";

export const db = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

export type Settings = {
  topics: string[];
  voice: string;
  post_times: string[];
  utc_offset_minutes: number;
  auto_generate: boolean;
  queue_target: number;
};

export type Post = {
  id: string;
  content: string;
  topic: string | null;
  status: "draft" | "approved" | "publishing" | "published" | "failed";
  scheduled_for: string | null;
  published_at: string | null;
  linkedin_post_urn: string | null;
  error: string | null;
  created_at: string;
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await db().from("settings").select("*").eq("id", 1).single();
  if (error) throw new Error(`settings: ${error.message}`);
  return data as Settings;
}
