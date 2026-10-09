import { describe, expect, it } from "vitest";
import { createSession, safeNext, verifySession } from "@/lib/session";

describe("session tokens", () => {
  const now = 1_800_000_000_000;

  it("verifies a fresh token", async () => {
    const t = await createSession("pw", now);
    expect(await verifySession(t, "pw", now + 1000)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const t = await createSession("pw", now, 1000);
    expect(await verifySession(t, "pw", now + 999)).toBe(true);
    expect(await verifySession(t, "pw", now + 1000)).toBe(false);
  });

  it("rejects a token signed with a different password", async () => {
    const t = await createSession("old", now);
    expect(await verifySession(t, "new", now + 1000)).toBe(false);
  });

  it("rejects tampered expiry or signature", async () => {
    const t = await createSession("pw", now, 1000);
    const [exp, sig] = t.split(".");
    expect(await verifySession(`${Number(exp) + 10_000_000}.${sig}`, "pw", now)).toBe(false);
    expect(await verifySession(`${exp}.${sig.slice(0, -1)}0`, "pw", now)).toBe(false);
  });

  it("rejects missing or malformed tokens and empty secrets", async () => {
    expect(await verifySession(undefined, "pw", now)).toBe(false);
    expect(await verifySession("", "pw", now)).toBe(false);
    expect(await verifySession("garbage", "pw", now)).toBe(false);
    expect(await verifySession(".abc", "pw", now)).toBe(false);
    expect(await verifySession("abc.def", "pw", now)).toBe(false);
    expect(await verifySession(await createSession("x", now), "", now)).toBe(false);
  });
});

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/?tab=settings")).toBe("/?tab=settings");
  });
  it("blocks open redirects and loops", () => {
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/login?next=/")).toBe("/");
    expect(safeNext("/api/posts")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
