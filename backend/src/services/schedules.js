const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** "06:20" -> 380 minutes after midnight, or null. */
export function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ''));
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 && v <= 30 * 60 ? v : null;
}

export function fmtMin(min) {
  const m = Math.round(min);
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Day key ('mon'...) and minutes after midnight for a Date, in IST. */
export function istClock(date) {
  const ist = new Date(date.getTime() + 330 * 60e3);
  return { day: DAYS[ist.getUTCDay()], min: ist.getUTCHours() * 60 + ist.getUTCMinutes() };
}

/** Missing pieces that keep a schedule from producing trips; empty when usable. */
export function scheduleGaps(schedule, line) {
  if (!schedule) return ['schedule'];
  const gaps = [];
  if (toMin(schedule.serviceStart) == null || toMin(schedule.serviceEnd) == null) gaps.push('service hours');
  if (!schedule.departures?.length && !schedule.bands?.length) gaps.push('headways or departures');
  if (!(schedule.runTimeMin > 0) && !(line.avgSpeedKmph > 0)) gaps.push('run time');
  return gaps;
}

/**
 * Departure times from the first stop of one direction on a given day,
 * from an explicit timetable or generated from published headway bands.
 */
export function departuresFor(schedule, day) {
  const start = toMin(schedule.serviceStart);
  const end = toMin(schedule.serviceEnd);
  if (schedule.departures?.length) {
    return schedule.departures.map(toMin).filter((t) => t != null).sort((a, b) => a - b);
  }
  const out = new Set();
  for (const band of schedule.bands ?? []) {
    if (band.days && !band.days.includes(day)) continue;
    const from = Math.max(toMin(band.from), start);
    const to = Math.min(toMin(band.to), end);
    for (let t = from; t <= to; t += band.headwayMin) out.add(t);
  }
  return [...out].sort((a, b) => a - b);
}

/** Headway in force at a given minute, for display; null when the line runs to a fixed timetable. */
export function headwayAt(schedule, day, min) {
  const band = (schedule.bands ?? []).find(
    (b) => (!b.days || b.days.includes(day)) && toMin(b.from) <= min && min < toMin(b.to),
  );
  return band?.headwayMin ?? null;
}
