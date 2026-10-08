import { db, getPost } from "@/lib/supabase";
import { fail, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// Copy any post (e.g. a published one that did well) back into the queue as a new draft.
// The image isn't copied: it belongs to the original post's storage folder.
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return fail("Post not found", 404);
  const { data, error } = await db()
    .from("posts")
    .insert({ content: post.content, topic: post.topic, status: "draft", source: post.source })
    .select()
    .single();
  if (error) return fail(error.message);
  return json({ post: data });
}
