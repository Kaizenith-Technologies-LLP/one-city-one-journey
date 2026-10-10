import { MODES } from '../config.js';
import { haversine } from '../utils/geo.js';
import { round } from './network.js';

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulates a day of integrated-ticket trips between random stops and totals
 * what each operator would collect under the fare-sharing rule, compared with
 * what it would earn if every leg were sold as a separate ticket.
 */
export function simulateSettlement(network, planner, { trips = 300, seed = 42 } = {}) {
  const rand = mulberry32(seed);
  const stops = [...network.stops.values()];
  const ops = new Map();
  const totals = { trips: 0, multimodalTrips: 0, standaloneRevenue: 0, integratedRevenue: 0, passengerKm: 0 };

  let attempts = 0;
  while (totals.trips < trips && attempts < trips * 4) {
    attempts++;
    const a = stops[Math.floor(rand() * stops.length)];
    const b = stops[Math.floor(rand() * stops.length)];
    if (a.id === b.id || haversine(a, b) < 2000) continue;

    const { options } = planner.plan({ stopId: a.id }, { stopId: b.id });
    const j = options.find((o) => o.tags.includes('fastest')) ?? options[0];
    if (!j) continue;

    totals.trips++;
    totals.standaloneRevenue += j.fareSplit.standaloneFare;
    totals.integratedRevenue += j.fareSplit.integratedFare;
    totals.passengerKm += j.distanceKm;
    if (j.fareSplit.shares.length >= 2) totals.multimodalTrips++;

    for (const s of j.fareSplit.shares) {
      const o = ops.get(s.operator) ?? {
        operator: s.operator,
        operatorName: MODES[s.mode].operatorName,
        mode: s.mode,
        trips: 0,
        passengerKm: 0,
        standaloneRevenue: 0,
        settledRevenue: 0,
      };
      o.trips++;
      o.passengerKm += s.km;
      o.standaloneRevenue += s.standaloneFare;
      o.settledRevenue += s.amount;
      ops.set(s.operator, o);
    }
  }

  const operators = [...ops.values()]
    .map((o) => ({
      ...o,
      passengerKm: round(o.passengerKm, 1),
      settledRevenue: round(o.settledRevenue, 2),
      revenueSharePct: round((o.settledRevenue / (totals.integratedRevenue || 1)) * 100, 1),
      vsStandalone: round(o.settledRevenue - o.standaloneRevenue, 2),
    }))
    .sort((x, y) => y.settledRevenue - x.settledRevenue);

  return {
    seed,
    ...totals,
    passengerKm: round(totals.passengerKm, 1),
    commuterSavings: totals.standaloneRevenue - totals.integratedRevenue,
    operators,
  };
}
