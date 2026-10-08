import { NextResponse, type NextRequest } from "next/server";
import { publishNextDue } from "@/lib/publish";
import { topUpQueue } from "@/lib/generate";

export const maxDuration = 120;

// Hit by Vercel Cron (daily by default) or any external pinger (cron-job.org etc.)
// with: Authorization: Bearer $CRON_SECRET
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return new NextResponse("Unauthorized", { status: 401 });

  const published = await publishNextDue();

  let generated = 0;
  let generateError: string | null = null;
  try {
    generated = await topUpQueue();
  } catch (e) {
    generateError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({ published, generated, generateError });
}
