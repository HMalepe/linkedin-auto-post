// Posting-slot maths. Pure functions (no I/O) so they can be unit tested.
// Times are wall-clock HH:MM in an IANA time zone, so DST is handled correctly.

export type SlotConfig = {
  times: string[]; // "HH:MM", local to `timezone`
  days: number[]; // allowed weekdays, 0 = Sunday … 6 = Saturday
  timezone: string; // IANA zone, e.g. "Africa/Johannesburg"
};

const MIN = 60_000;
const DAY = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string) {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

export function isValidTime(t: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

// Wall-clock fields of `date` in `tz`.
export function zonedParts(date: Date, tz: string) {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(date))
    if (part.type !== "literal") p[part.type] = Number(part.value);
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

// Offset of `tz` from UTC at `date`, in ms (positive east of Greenwich).
export function tzOffsetMs(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// UTC instant for a wall-clock time in `tz`. Times that fall in a DST gap
// are shifted forward by the gap, matching how clocks behave.
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = tzOffsetMs(new Date(guess), tz);
  const off2 = tzOffsetMs(new Date(guess - off1), tz);
  // A candidate is valid if the zone really has that offset at that instant.
  const valid = [off1, off2].filter((off) => tzOffsetMs(new Date(guess - off), tz) === off).map((off) => guess - off);
  if (valid.length) return new Date(Math.min(...valid)); // ambiguous (fall back): earlier instant
  // DST gap (spring forward): apply the pre-transition (smaller) offset, landing after the gap.
  return new Date(guess - Math.min(off1, off2));
}

// The next `count` free posting slots strictly after `after`.
// A slot counts as taken if an existing scheduled post is within `minGapMinutes` of it.
export function nextSlots(
  count: number,
  cfg: SlotConfig,
  after: Date,
  taken: Date[] = [],
  minGapMinutes = 60,
): Date[] {
  const times = [...new Set(cfg.times.filter(isValidTime))].sort();
  if (!times.length) times.push("08:00");
  const days = new Set(cfg.days.length ? cfg.days : [0, 1, 2, 3, 4, 5, 6]);
  const gap = minGapMinutes * MIN;
  const takenMs = taken.map((d) => d.getTime());
  const out: Date[] = [];

  const today = zonedParts(after, cfg.timezone);
  const base = Date.UTC(today.year, today.month - 1, today.day);

  for (let i = 0; out.length < count && i < 400; i++) {
    const cal = new Date(base + i * DAY); // calendar date, read with UTC getters
    if (!days.has(cal.getUTCDay())) continue;
    for (const t of times) {
      const [h, m] = t.split(":").map(Number);
      const slot = zonedTimeToUtc(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), h, m, cfg.timezone);
      const ms = slot.getTime();
      if (ms <= after.getTime()) continue;
      if (takenMs.some((t2) => Math.abs(t2 - ms) < gap)) continue;
      out.push(slot);
      takenMs.push(ms);
      if (out.length >= count) break;
    }
  }
  return out;
}
