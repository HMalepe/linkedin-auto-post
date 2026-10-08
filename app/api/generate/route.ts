import { NextResponse } from "next/server";
import { generateIntoQueue } from "@/lib/generate";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { count } = await req.json().catch(() => ({ count: 3 }));
  const n = Math.min(Math.max(Number(count) || 3, 1), 7);
  try {
    const made = await generateIntoQueue(n);
    return NextResponse.json({ created: made.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
