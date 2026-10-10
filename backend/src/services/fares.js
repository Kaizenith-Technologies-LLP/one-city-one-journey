import { MODES, FARE_SHARE } from '../config.js';
import { round } from './network.js';

function slabsFor(fares, mode) {
  const slabs = fares[mode]?.slabs;
  if (!slabs?.length) throw Object.assign(new Error(`No fare data for mode ${mode}`), { status: 503 });
  return slabs;
}

/** Fare for one ticket of `mode` covering `km`, from that mode's distance slabs. */
export function slabFare(fares, mode, km) {
  const slabs = slabsFor(fares, mode);
  const slab = slabs.find((s) => km <= s.uptoKm) ?? slabs[slabs.length - 1];
  return slab.fare;
}

/** Cheapest boarding fare of a mode, used as the per-boarding weight in routing. */
export function minFare(fares, mode) {
  return slabsFor(fares, mode)[0].fare;
}

/**
 * Turns ride legs into tickets. Consecutive legs of a mode that allows
 * in-system transfers (Metro, BRTS) share one ticket priced on total km.
 */
export function ticketsForLegs(fares, legs) {
  const tickets = [];
  let prevRide = null;
  let walkedSinceRide = false;

  legs.forEach((leg, i) => {
    if (leg.type === 'walk') {
      if (leg.distanceM > 0) walkedSinceRide = true;
      return;
    }
    const last = tickets[tickets.length - 1];
    const canShare =
      last && prevRide && !walkedSinceRide && prevRide.mode === leg.mode && MODES[leg.mode].sharedTicketWithinMode;
    if (canShare) {
      last.km += leg.distanceKm;
      last.legIndices.push(i);
    } else {
      tickets.push({ mode: leg.mode, operator: MODES[leg.mode].operator, km: leg.distanceKm, legIndices: [i] });
    }
    prevRide = leg;
    walkedSinceRide = false;
  });

  for (const t of tickets) {
    t.km = round(t.km, 2);
    t.fare = slabFare(fares, t.mode, t.km);
  }
  return tickets;
}

/**
 * Integrated-ticket fare and how its revenue is split between operators.
 * Each operator's share = fareWeight x (its standalone fare share)
 *                        + (1 - fareWeight) x (its cost-weighted passenger-km share).
 * The km part applies only when every operator on the trip has a cost weight
 * configured; otherwise the split follows standalone fares alone.
 */
export function fareSplit(tickets) {
  const standalone = tickets.reduce((s, t) => s + t.fare, 0);
  const byOp = new Map();
  for (const t of tickets) {
    const o = byOp.get(t.operator) ?? { operator: t.operator, mode: t.mode, standaloneFare: 0, km: 0, weightedKm: 0 };
    o.standaloneFare += t.fare;
    o.km += t.km;
    o.weightedKm += t.km * (MODES[t.mode].costWeight ?? 0);
    byOp.set(t.operator, o);
  }
  const ops = [...byOp.values()];
  const multiOperator = ops.length >= 2;
  const discount = multiOperator ? FARE_SHARE.integrationDiscount : 0;
  const integratedFare = multiOperator ? Math.round(standalone * (1 - discount)) : standalone;
  const totalWeightedKm = ops.reduce((s, o) => s + o.weightedKm, 0);
  const useKm = totalWeightedKm > 0 && ops.every((o) => MODES[o.mode].costWeight > 0);
  const fareWeight = useKm ? FARE_SHARE.fareWeight : 1;

  for (const o of ops) {
    const fareShare = standalone ? o.standaloneFare / standalone : 0;
    const kmShare = useKm ? o.weightedKm / totalWeightedKm : 0;
    o.sharePct = fareWeight * fareShare + (1 - fareWeight) * kmShare;
  }

  // Round to paise, then hand any rounding remainder to the largest share.
  ops.forEach((o) => (o.amount = round(integratedFare * o.sharePct, 2)));
  const diff = round(integratedFare - ops.reduce((s, o) => s + o.amount, 0), 2);
  if (ops.length && diff) {
    const top = ops.reduce((a, b) => (b.amount > a.amount ? b : a));
    top.amount = round(top.amount + diff, 2);
  }

  return {
    standaloneFare: standalone,
    integratedFare,
    discountPct: Math.round(discount * 100),
    savings: standalone - integratedFare,
    method: useKm
      ? `${fareWeight * 100}% by standalone fare + ${100 - fareWeight * 100}% by cost-weighted passenger-km`
      : '100% by standalone fare (operator cost weights not configured)',
    shares: ops.map((o) => ({
      operator: o.operator,
      operatorName: MODES[o.mode].operatorName,
      mode: o.mode,
      standaloneFare: o.standaloneFare,
      km: round(o.km, 2),
      sharePct: round(o.sharePct * 100, 1),
      amount: o.amount,
    })),
  };
}
