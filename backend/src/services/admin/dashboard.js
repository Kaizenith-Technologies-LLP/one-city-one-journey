import { MODES } from '../../config.js';
import { getState } from '../../state.js';
import { readData } from './store.js';
import { revenueReport, todayKey } from './tickets.js';

/** Network counts (from the raw files, so suspended lines show), hubs and ticket stats. */
export function dashboard() {
  const stops = readData('stops.json');
  const lines = readData('lines.json');
  let hubs = [];
  let overlaps = [];
  let dataLoaded = true;
  try {
    ({ hubs, overlaps } = getState());
  } catch {
    dataLoaded = false;
  }

  const modes = Object.entries(MODES).map(([key, m]) => {
    const ml = lines.filter((l) => l.mode === key);
    return {
      key,
      label: m.label,
      operator: m.operator,
      color: m.color,
      stops: stops.filter((s) => s.mode === key).length,
      lines: ml.length,
      suspendedLines: ml.filter((l) => l.active === false).length,
      hubs: hubs.filter((h) => h.modes.includes(key)).length,
    };
  });

  const today = todayKey();
  const all = revenueReport();
  const day = revenueReport({ from: today, to: today });
  const hubTypes = {};
  for (const h of hubs) hubTypes[h.type] = (hubTypes[h.type] ?? 0) + 1;

  return {
    dataLoaded,
    counts: {
      stops: stops.length,
      lines: lines.length,
      activeLines: lines.filter((l) => l.active !== false).length,
      suspendedLines: lines.filter((l) => l.active === false).length,
      hubs: hubs.length,
      corridorOverlaps: overlaps.length,
      platforms: stops.reduce((n, s) => n + (s.platforms?.length ?? 0), 0),
    },
    modes,
    hubTypes,
    tickets: {
      issued: all.totals.tickets,
      active: all.totals.active,
      used: all.totals.used,
      cancelled: all.totals.cancelled,
      expired: all.totals.expired,
      multiOperator: all.totals.multiOperator,
      revenueTotal: all.totals.net,
      issuedToday: day.totals.tickets,
      revenueToday: day.totals.net,
      commuterSavings: all.totals.savings,
    },
    revenueByOperator: all.operators,
    revenueTodayByOperator: day.operators,
    daily: all.daily.slice(-14),
  };
}
