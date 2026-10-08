import { db, type Post } from "@/lib/supabase";
import { signedUrls } from "@/lib/images";
import { MAX_POST_CHARS } from "@/lib/prompts";
import { fail, json, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await db().from("posts").select("*").order("created_at", { ascending: false }).limit(300);
  if (error) return fail(error.message);
  const posts = data as Post[];
  const urls = await signedUrls(posts.map((p) => p.image_path).filter((p): p is string => !!p));
  return json({ posts: posts.map((p) => ({ ...p, image_url: p.image_path ? (urls.get(p.image_path) ?? null) : null })) });
}

// Manually add your own post to the queue.
export async function POST(req: Request) {
  const { content } = await readJson(req);
  if (typeof content !== "string" || !content.trim()) return fail("content required", 400);
  if (content.length > MAX_POST_CHARS) return fail(`Max ${MAX_POST_CHARS} characters`, 400);
  const { data, error } = await db()
    .from("posts")
    .insert({ content: content.trim(), status: "draft", source: "manual" })
    .select()
    .single();
  if (error) return fail(error.message);
  return json({ post: data });
}
