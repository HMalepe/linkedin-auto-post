import { db } from "@/lib/supabase";
import { fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await db().from("activity").select("*").order("at", { ascending: false }).limit(100);
  if (error) return fail(error.message);
  return json({ activity: data });
}
