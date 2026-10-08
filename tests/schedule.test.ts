import { describe, expect, it } from "vitest";
import { isValidTime, isValidTimeZone, nextSlots, tzOffsetMs, zonedTimeToUtc } from "@/lib/schedule";

const iso = (d: Date) => d.toISOString();
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

describe("zonedTimeToUtc", () => {
  it("handles a fixed-offset zone (SAST, UTC+2)", () => {
    expect(iso(zonedTimeToUtc(2026, 3, 10, 8, 0, "Africa/Johannesburg"))).toBe("2026-03-10T06:00:00.000Z");
  });

  it("uses summer and winter offsets in a DST zone", () => {
    // London: GMT in January, BST (UTC+1) in July
    expect(iso(zonedTimeToUtc(2026, 1, 15, 9, 0, "Europe/London"))).toBe("2026-01-15T09:00:00.000Z");
    expect(iso(zonedTimeToUtc(2026, 7, 15, 9, 0, "Europe/London"))).toBe("2026-07-15T08:00:00.000Z");
  });

  it("shifts times in a spring-forward gap forward", () => {
    // New York skips 02:00-03:00 on 8 March 2026
    expect(iso(zonedTimeToUtc(2026, 3, 8, 2, 30, "America/New_York"))).toBe("2026-03-08T07:30:00.000Z");
  });

  it("handles half-hour zones", () => {
    expect(iso(zonedTimeToUtc(2026, 5, 1, 9, 0, "Asia/Kolkata"))).toBe("2026-05-01T03:30:00.000Z");
    expect(tzOffsetMs(new Date("2026-05-01T00:00:00Z"), "Asia/Kolkata")).toBe(330 * 60_000);
  });
});

describe("nextSlots", () => {
  const sast = { times: ["08:00", "17:30"], days: ALL_DAYS, timezone: "Africa/Johannesburg" };

  it("returns the next slots after now, in order", () => {
    const after = new Date("2026-03-10T07:00:00Z"); // 09:00 SAST
    expect(nextSlots(3, sast, after).map(iso)).toEqual([
      "2026-03-10T15:30:00.000Z",
      "2026-03-11T06:00:00.000Z",
      "2026-03-11T15:30:00.000Z",
    ]);
  });

  it("skips slots near already-scheduled posts", () => {
    const after = new Date("2026-03-10T05:00:00Z");
    const taken = [new Date("2026-03-10T06:20:00Z")]; // 20 min after the 08:00 slot
    expect(iso(nextSlots(1, sast, after, taken)[0])).toBe("2026-03-10T15:30:00.000Z");
  });

  it("only uses allowed weekdays", () => {
    // 2026-03-13 is a Friday; weekdays only -> next is Monday 16th
    const after = new Date("2026-03-13T10:00:00Z");
    const slots = nextSlots(1, { times: ["08:00"], days: [1, 2, 3, 4, 5], timezone: "Africa/Johannesburg" }, after);
    expect(iso(slots[0])).toBe("2026-03-16T06:00:00.000Z");
  });

  it("uses the local date, not the UTC date, near midnight", () => {
    // 23:30 UTC on the 10th is already 01:30 on the 11th in SAST
    const after = new Date("2026-03-10T23:30:00Z");
    expect(iso(nextSlots(1, { times: ["08:00"], days: ALL_DAYS, timezone: "Africa/Johannesburg" }, after)[0])).toBe(
      "2026-03-11T06:00:00.000Z",
    );
  });

  it("keeps wall-clock time across a DST change", () => {
    const ny = { times: ["09:00"], days: ALL_DAYS, timezone: "America/New_York" };
    const slots = nextSlots(3, ny, new Date("2026-03-07T00:00:00Z")).map(iso);
    expect(slots).toEqual(["2026-03-07T14:00:00.000Z", "2026-03-08T13:00:00.000Z", "2026-03-09T13:00:00.000Z"]);
  });

  it("falls back to 08:00 and every day when nothing is configured", () => {
    const slots = nextSlots(1, { times: [], days: [], timezone: "UTC" }, new Date("2026-03-10T09:00:00Z"));
    expect(iso(slots[0])).toBe("2026-03-11T08:00:00.000Z");
  });

  it("dedupes and sorts times", () => {
    const slots = nextSlots(2, { times: ["17:00", "09:00", "09:00"], days: ALL_DAYS, timezone: "UTC" }, new Date("2026-03-10T00:00:00Z"));
    expect(slots.map(iso)).toEqual(["2026-03-10T09:00:00.000Z", "2026-03-10T17:00:00.000Z"]);
  });
});

describe("validators", () => {
  it("validates HH:MM", () => {
    expect(isValidTime("08:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("8:00")).toBe(false);
    expect(isValidTime("12:60")).toBe(false);
  });

  it("validates time zones", () => {
    expect(isValidTimeZone("Africa/Johannesburg")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
  });
});

describe("DST edge cases", () => {
  it("shifts gap times forward in zones east of Greenwich", () => {
    // London skips 01:00-02:00 on 29 March 2026; 01:30 becomes 02:30 BST
    expect(iso(zonedTimeToUtc(2026, 3, 29, 1, 30, "Europe/London"))).toBe("2026-03-29T01:30:00.000Z");
  });
  it("picks the first occurrence of an ambiguous fall-back time", () => {
    // New York repeats 01:00-02:00 on 1 November 2026; first 01:30 is EDT (UTC-4)
    expect(iso(zonedTimeToUtc(2026, 11, 1, 1, 30, "America/New_York"))).toBe("2026-11-01T05:30:00.000Z");
  });
});
