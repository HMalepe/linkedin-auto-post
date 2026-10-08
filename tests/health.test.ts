import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ db: () => { throw new Error("no db in tests"); }, IMAGE_BUCKET: "post-images" }));
const { envChecks } = await import("@/lib/health");

describe("envChecks", () => {
  it("reports missing variables by name only", () => {
    const checks = envChecks({ APP_URL: "https://x.vercel.app", ANTHROPIC_API_KEY: "sk-secret" });
    expect(checks.find((c) => c.id === "env:ANTHROPIC_API_KEY")?.ok).toBe(true);
    expect(checks.find((c) => c.id === "env:CRON_SECRET")?.ok).toBe(false);
    expect(JSON.stringify(checks)).not.toContain("sk-secret");
  });
  it("flags a trailing slash on APP_URL", () => {
    expect(envChecks({ APP_URL: "https://x.vercel.app/" }).find((c) => c.id === "env:APP_URL:format")?.ok).toBe(false);
    expect(envChecks({ APP_URL: "http://localhost:3000" }).find((c) => c.id === "env:APP_URL:format")?.ok).toBe(true);
  });
});

describe("LinkedIn version check", () => {
  it("fails for a retired version and passes for the default", () => {
    expect(envChecks({ LINKEDIN_VERSION: "202401" }).find((c) => c.id === "env:LINKEDIN_VERSION")?.ok).toBe(false);
    expect(envChecks({ LINKEDIN_VERSION: "bogus" }).find((c) => c.id === "env:LINKEDIN_VERSION")?.ok).toBe(false);
  });
});
