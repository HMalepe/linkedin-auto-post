import { NextResponse, type NextRequest } from "next/server";
import { publishNextDue, recoverStalePublishing } from "@/lib/publish";
import { topUpQueue } from "@/lib/generate";
import { getConnection } from "@/lib/linkedin";
import { loggedRecently, logActivity, pruneActivity } from "@/lib/activity";
import { bearerOk } from "@/lib/auth";
import { errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Hit by Vercel Cron (daily by default) or any external pinger (cron-job.org etc.)
// with: Authorization: Bearer $CRON_SECRET
async function run(req: NextRequest) {
  if (!bearerOk(req.headers.get("authorization"), process.env.CRON_SECRET))
    return new NextResponse("Unauthorized", { status: 401 });

  const recovered = await recoverStalePublishing();
  const published = await publishNextDue();

  let generated = 0;
  let generateError: string | null = null;
  try {
    generated = await topUpQueue();
  } catch (e) {
    generateError = errorMessage(e);
  }

  // Warn (once a day at most, via the log) when the LinkedIn token is close to expiring.
  const conn = await getConnection();
  const daysLeft = conn ? Math.floor((new Date(conn.expires_at).getTime() - Date.now()) / 86_400_000) : null;
  if (daysLeft !== null && daysLeft <= 7 && !(await loggedRecently("token", 24)))
    await logActivity("token", daysLeft <= 0 ? "LinkedIn token has expired: reconnect" : `LinkedIn token expires in ${daysLeft} day(s): reconnect soon`, { ok: false });

  const summary = [
    "idle" in published ? "nothing due" : published.ok ? "published 1 post" : `publish failed: ${published.error}`,
    generated ? `generated ${generated} draft(s)` : null,
    generateError ? `generation failed: ${generateError}` : null,
    recovered ? `recovered ${recovered} stuck post(s)` : null,
  ]
    .filter(Boolean)
    .join("; ");
  // Quiet runs aren't logged, so a 15-minute pinger doesn't flood the activity feed.
  if (summary !== "nothing due")
    await logActivity("cron", `Cron run: ${summary}`, { ok: !generateError && ("idle" in published || published.ok) });
  await pruneActivity();

  return NextResponse.json({ published, generated, generateError, recovered, tokenDaysLeft: daysLeft });
}

export const GET = run;
export const POST = run;
