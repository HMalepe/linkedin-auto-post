import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ db: () => { throw new Error("no db in tests"); } }));
const { LinkedInError } = await import("@/lib/linkedin");

describe("LinkedInError.retryable", () => {
  it("retries anything transient before the post request", () => {
    expect(new LinkedInError("x", 0, "image").retryable).toBe(true);
    expect(new LinkedInError("x", 500, "image").retryable).toBe(true);
    expect(new LinkedInError("x", 400, "image").retryable).toBe(false);
  });
  it("only retries gateway errors on the post request", () => {
    expect(new LinkedInError("x", 429, "post").retryable).toBe(true);
    expect(new LinkedInError("x", 503, "post").retryable).toBe(true);
    expect(new LinkedInError("x", 500, "post").retryable).toBe(false);
    expect(new LinkedInError("x", 0, "post").retryable).toBe(false);
  });
  it("flags uncertain outcomes and auth problems", () => {
    expect(new LinkedInError("x", 0, "post").outcomeUnknown).toBe(true);
    expect(new LinkedInError("x", 500, "post").outcomeUnknown).toBe(true);
    expect(new LinkedInError("x", 422, "post").outcomeUnknown).toBe(false);
    expect(new LinkedInError("x", 401, "post").authProblem).toBe(true);
  });
});

const { versionAgeMonths } = await import("@/lib/linkedin");

describe("versionAgeMonths", () => {
  const now = new Date("2026-10-08T00:00:00Z");
  it("counts months since a YYYYMM version", () => {
    expect(versionAgeMonths("202608", now)).toBe(2);
    expect(versionAgeMonths("202509", now)).toBe(13);
  });
  it("rejects malformed versions", () => {
    expect(versionAgeMonths("2026-08", now)).toBeNull();
    expect(versionAgeMonths("202613", now)).toBeNull();
  });
  it("flags a sunset version error", () => {
    expect(new LinkedInError("x", 426, "post").versionSunset).toBe(true);
    expect(new LinkedInError("x", 426, "post").retryable).toBe(false);
  });
});
