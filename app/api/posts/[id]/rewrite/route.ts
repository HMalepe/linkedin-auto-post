import { getPost, getSettings } from "@/lib/supabase";
import { rewritePost } from "@/lib/claude";
import { fail, json, readJson } from "@/lib/http";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

// Returns a rewritten version without saving it; the dashboard puts it in the editor for review.
// Body: { instruction: string, content?: string } (content = unsaved editor text, if any)
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = await readJson(req);
  const post = await getPost(id);
  if (!post) return fail("Post not found", 404);
  const source = typeof b.content === "string" && b.content.trim() ? b.content : post.content;
  try {
    const content = await rewritePost(source, String(b.instruction ?? "").slice(0, 1000), await getSettings());
    return json({ content });
  } catch (e) {
    return fail(e);
  }
}
