import { describe, expect, it } from "vitest";
import { parsePostPatch, parseSettings } from "@/lib/validate";

const base = {
  topics: [" a ", "", "b"],
  voice: "me",
  rules: "",
  post_times: ["17:30", "08:00", "08:00"],
  post_days: [5, 1, 1, 9],
  timezone: "Africa/Johannesburg",
  auto_generate: 1,
  queue_target: 99,
  max_hashtags: "2",
};

describe("parseSettings", () => {
  it("normalises a valid body", () => {
    const r = parseSettings(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.topics).toEqual(["a", "b"]);
    expect(r.value.post_times).toEqual(["08:00", "17:30"]);
    expect(r.value.post_days).toEqual([1, 5]);
    expect(r.value.auto_generate).toBe(true);
    expect(r.value.queue_target).toBe(20);
    expect(r.value.max_hashtags).toBe(2);
  });

  it("rejects bad times, zones and empty days", () => {
    expect(parseSettings({ ...base, post_times: ["8am"] })).toMatchObject({ ok: false });
    expect(parseSettings({ ...base, post_times: [] })).toMatchObject({ ok: false });
    expect(parseSettings({ ...base, timezone: "Nowhere/Land" })).toMatchObject({ ok: false });
    expect(parseSettings({ ...base, post_days: [] })).toMatchObject({ ok: false });
  });
});

describe("parsePostPatch", () => {
  it("accepts content, status and a schedule", () => {
    const r = parsePostPatch({ content: "hi", status: "approved", scheduled_for: "2026-03-10T06:00:00Z" });
    expect(r).toEqual({ ok: true, value: { content: "hi", status: "approved", scheduled_for: "2026-03-10T06:00:00.000Z" } });
  });

  it("treats an empty schedule as clearing it", () => {
    expect(parsePostPatch({ scheduled_for: "" })).toEqual({ ok: true, value: { scheduled_for: null } });
  });

  it("rejects invalid input", () => {
    expect(parsePostPatch({ content: "" })).toMatchObject({ ok: false });
    expect(parsePostPatch({ content: "x".repeat(3001) })).toMatchObject({ ok: false });
    expect(parsePostPatch({ scheduled_for: "tomorrow-ish" })).toMatchObject({ ok: false });
    expect(parsePostPatch({ status: "published" })).toMatchObject({ ok: false });
  });
});
