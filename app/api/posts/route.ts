import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await db()
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data });
}

// Manually add your own post to the queue.
export async function POST(req: Request) {
  const { content } = await req.json();
  if (typeof content !== "string" || !content.trim())
    return NextResponse.json({ error: "content required" }, { status: 400 });
  const { data, error } = await db()
    .from("posts")
    .insert({ content: content.trim(), status: "draft" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}
