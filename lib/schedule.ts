// Next posting slots from local HH:MM times and a fixed UTC offset (SAST has no DST).
export function nextSlots(
  count: number,
  times: string[],
  offsetMin: number,
  after: Date,
  taken: Date[] = [],
): Date[] {
  const slotsPerDay = [...times].sort();
  if (!slotsPerDay.length) slotsPerDay.push("08:00");
  const takenSet = new Set(taken.map((d) => d.getTime()));
  const out: Date[] = [];

  // "local now" expressed as a UTC-based Date so we can use UTC getters for local fields
  const localNow = new Date(after.getTime() + offsetMin * 60_000);
  const day = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());

  for (let d = 0; out.length < count && d < 365; d++) {
    for (const t of slotsPerDay) {
      const [h, m] = t.split(":").map(Number);
      const utcMs = day + d * 86_400_000 + (h * 60 + m) * 60_000 - offsetMin * 60_000;
      if (utcMs <= after.getTime() || takenSet.has(utcMs)) continue;
      out.push(new Date(utcMs));
      if (out.length >= count) break;
    }
  }
  return out;
}
