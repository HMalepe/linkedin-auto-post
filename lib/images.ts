import { db, IMAGE_BUCKET } from "./supabase";

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
};
// Vercel caps request bodies at ~4.5 MB, so keep uploads under that.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function storeImage(postId: string, file: File) {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Use a JPG, PNG or GIF image");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be 4 MB or smaller");
  const path = `${postId}/${Date.now()}.${ext}`;
  const { error } = await db()
    .storage.from(IMAGE_BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) throw new Error(`Image upload: ${error.message}`);
  return path;
}

export async function removeImage(path: string | null | undefined) {
  if (!path) return;
  await db().storage.from(IMAGE_BUCKET).remove([path]);
}

export async function downloadImage(path: string) {
  const { data, error } = await db().storage.from(IMAGE_BUCKET).download(path);
  if (error || !data) throw new Error(`Image download: ${error?.message ?? "not found"}`);
  return { bytes: await data.arrayBuffer(), contentType: data.type || "image/jpeg" };
}

// Signed URLs so the dashboard can show previews from the private bucket.
export async function signedUrls(paths: string[], ttlSeconds = 3600) {
  if (!paths.length) return new Map<string, string>();
  const { data } = await db().storage.from(IMAGE_BUCKET).createSignedUrls(paths, ttlSeconds);
  const map = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  return map;
}
