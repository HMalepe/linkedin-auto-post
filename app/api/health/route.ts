import { runHealthChecks } from "@/lib/health";
import { fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const checks = await runHealthChecks();
    return json({ ok: checks.every((c) => c.ok), checks });
  } catch (e) {
    return fail(e);
  }
}
