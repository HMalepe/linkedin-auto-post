import { db } from "@/lib/supabase";
import { logActivity } from "@/lib/activity";
import { fail, json } from "@/lib/http";

// Forget the stored token. (To fully revoke, also remove the app at linkedin.com/psettings/permitted-services.)
export async function POST() {
  const { error } = await db().from("linkedin_connection").delete().eq("id", 1);
  if (error) return fail(error.message);
  await logActivity("connect", "Disconnected LinkedIn");
  return json({ ok: true });
}
