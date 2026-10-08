import { db, IMAGE_BUCKET } from "./supabase";
import { DEFAULT_LINKEDIN_VERSION, getConnection, versionAgeMonths } from "./linkedin";

export type Check = { id: string; label: string; ok: boolean; hint?: string };

const REQUIRED_ENV: [string, string][] = [
  ["APP_URL", "Public URL of the app, no trailing slash (used for the LinkedIn redirect)"],
  ["ADMIN_PASSWORD", "Dashboard password"],
  ["CRON_SECRET", "Shared secret the cron sends as a Bearer token"],
  ["SUPABASE_URL", "Supabase → Project Settings → API → Project URL"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase → Project Settings → API → service_role key"],
  ["LINKEDIN_CLIENT_ID", "LinkedIn developer app → Auth tab"],
  ["LINKEDIN_CLIENT_SECRET", "LinkedIn developer app → Auth tab"],
  ["ANTHROPIC_API_KEY", "console.anthropic.com → API keys"],
];

// Names only: values are never returned.
export function envChecks(env: Record<string, string | undefined>): Check[] {
  const checks: Check[] = REQUIRED_ENV.map(([name, hint]) => ({
    id: `env:${name}`,
    label: `${name} is set`,
    ok: !!env[name]?.trim(),
    hint,
  }));
  const appUrl = env.APP_URL?.trim();
  if (appUrl)
    checks.push({
      id: "env:APP_URL:format",
      label: "APP_URL is a full URL without a trailing slash",
      ok: /^https?:\/\/[^/]+(\/.*[^/])?$/.test(appUrl),
      hint: "e.g. https://my-autoposter.vercel.app",
    });
  const version = env.LINKEDIN_VERSION?.trim() || DEFAULT_LINKEDIN_VERSION;
  const age = versionAgeMonths(version);
  checks.push({
    id: "env:LINKEDIN_VERSION",
    label: `LinkedIn API version ${version} is current`,
    ok: age !== null && age >= 0 && age <= 10,
    hint:
      age === null
        ? "LINKEDIN_VERSION must be YYYYMM, e.g. 202608"
        : "LinkedIn retires versions about 12 months after release. Set LINKEDIN_VERSION to a recent YYYYMM (see learn.microsoft.com/linkedin/marketing/versioning).",
  });
  return checks;
}

export async function runHealthChecks(): Promise<Check[]> {
  const checks = envChecks(process.env);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return checks;

  const schema = await db()
    .from("posts")
    .select("id, attempts, image_path, publishing_started_at, source")
    .limit(1);
  const settings = await db().from("settings").select("timezone, post_days, rules, max_hashtags").eq("id", 1).maybeSingle();
  const activity = await db().from("activity").select("id").limit(1);
  checks.push({
    id: "db:schema",
    label: "Database schema is up to date",
    ok: !schema.error && !settings.error && !activity.error && !!settings.data,
    hint: schema.error?.message ?? settings.error?.message ?? activity.error?.message ?? "Run supabase/schema.sql in the Supabase SQL editor",
  });

  const bucket = await db().storage.getBucket(IMAGE_BUCKET);
  checks.push({
    id: "db:bucket",
    label: `Storage bucket "${IMAGE_BUCKET}" exists`,
    ok: !bucket.error,
    hint: "Run supabase/schema.sql (it creates the bucket). Needed for image posts only.",
  });

  const conn = await getConnection().catch(() => null);
  checks.push({
    id: "linkedin",
    label: "LinkedIn connected",
    ok: !!conn && new Date(conn.expires_at) > new Date(),
    hint: conn ? "Token expired: click Reconnect" : "Click Connect LinkedIn",
  });
  return checks;
}
