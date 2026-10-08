import { NextResponse } from "next/server";
import { publishPostById } from "@/lib/publish";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const r = await publishPostById(id);
  return NextResponse.json(r, { status: r.ok ? 200 : r.skipped ? 409 : 502 });
}
