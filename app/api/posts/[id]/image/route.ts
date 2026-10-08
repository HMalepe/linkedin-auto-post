import { db, getPost } from "@/lib/supabase";
import { removeImage, storeImage } from "@/lib/images";
import { fail, json } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = ["draft", "approved", "failed"];

// multipart/form-data with a "file" field (JPG/PNG/GIF, max 4 MB) and optional "alt".
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return fail("Post not found", 404);
  if (!EDITABLE.includes(post.status)) return fail("Post not editable", 409);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("No file uploaded", 400);

  try {
    const path = await storeImage(id, file);
    const alt = form?.get("alt");
    const { error } = await db()
      .from("posts")
      .update({ image_path: path, ...(typeof alt === "string" ? { image_alt: alt.slice(0, 4000) || null } : {}) })
      .eq("id", id);
    if (error) {
      await removeImage(path);
      return fail(error.message);
    }
    if (post.image_path) await removeImage(post.image_path).catch(() => {});
    return json({ ok: true, image_path: path });
  } catch (e) {
    return fail(e, 400);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return fail("Post not found", 404);
  if (!EDITABLE.includes(post.status)) return fail("Post not editable", 409);
  const { error } = await db().from("posts").update({ image_path: null, image_alt: null }).eq("id", id);
  if (error) return fail(error.message);
  await removeImage(post.image_path).catch(() => {});
  return json({ ok: true });
}
