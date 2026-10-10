import { MODES, PLANNER } from '../config.js';
import { haversine } from '../utils/geo.js';
import { round } from './network.js';
import { minFare, ticketsForLegs, fareSplit } from './fares.js';

/**
 * Multimodal route planner.
 *
 * Graph states:
 *   O            virtual origin
 *   D            virtual destination
 *   F|stopId     on foot at a stop
 *   R|lineId|i   on board line at stop index i
 *
 * Each edge carries a cost vector (time, walk metres, estimated fare,
 * boardings). Dijkstra runs once per objective, with that objective's scalar
 * weight; exact fares are recomputed on the finished itinerary.
 */

const OBJECTIVES = {
  fastest: (c) => c.timeMin + c.board * 3,
  cheapest: (c) => c.fare * 10 + c.timeMin * 0.05,
  leastWalking: (c) => c.walkM * 0.1 + c.timeMin,
  fewestTransfers: (c) => c.board * 30 + c.timeMin,
};

class MinHeap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(item) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export class Planner {
  constructor(network, stopToHub) {
    this.network = network;
    this.stopToHub = stopToHub;
    this.walkLinks = this.#buildWalkLinks();
    // Only routable lines are in the network, and each has fare slabs for its mode.
    this.perKm = {};
    for (const line of network.lines.values()) this.perKm[line.mode] ??= this.#estimatePerKm(line.mode);
  }

  /** Stops reachable on foot from each stop: anything within 500 m, plus every other member of its hub. */
  #buildWalkLinks() {
    const { stops } = this.network;
    const list = [...stops.values()];
    const links = new Map(list.map((s) => [s.id, []]));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const d = haversine(a, b);
        const sameHub = this.stopToHub.has(a.id) && this.stopToHub.get(a.id) === this.stopToHub.get(b.id);
        if (d <= PLANNER.transferWalkMaxM || sameHub) {
          links.get(a.id).push({ to: b.id, distM: d });
          links.get(b.id).push({ to: a.id, distM: d });
        }
      }
    }
    return links;
  }

  /** Average fare increase per km across a mode's finite slabs; a routing weight, not a price. */
  #estimatePerKm(mode) {
    const slabs = this.network.fares[mode].slabs.filter((s) => s.uptoKm < 999);
    if (slabs.length < 2) return 0;
    const last = slabs[slabs.length - 1];
    return Math.max(0.2, (last.fare - slabs[0].fare) / Math.max(1, last.uptoKm));
  }

  /** Resolves an endpoint (stop id or {lat,lng}) into walk links to/from stops. */
  resolveEndpoint(endpoint) {
    const { stops } = this.network;
    if (endpoint.stopId) {
      const s = stops.get(endpoint.stopId);
      if (!s) throw httpError(404, `Unknown stop: ${endpoint.stopId}`);
      return { point: { name: s.name, lat: s.lat, lng: s.lng, stopId: s.id }, access: [{ stopId: s.id, distM: 0 }] };
    }
    const p = endpoint.point;
    const ranked = [...stops.values()]
      .map((s) => ({ stopId: s.id, distM: haversine(p, s) }))
      .sort((a, b) => a.distM - b.distM);
    // Stops within walking range; only if there are none, fall back to the nearest few.
    const inRange = ranked.filter((r) => r.distM <= PLANNER.accessWalkMaxM);
    const access = inRange.length ? inRange : ranked.slice(0, PLANNER.accessMinStops);
    return { point: { name: endpoint.name ?? 'Selected location', lat: p.lat, lng: p.lng }, access };
  }

  #dijkstra(origin, dest, weight, linePenalty) {
    const { stops, lines } = this.network;
    const destAccess = new Map(dest.access.map((a) => [a.stopId, a.distM]));
    const dist = new Map([['O', 0]]);
    const prev = new Map();
    const heap = new MinHeap();
    heap.push([0, 'O']);

    const relax = (from, to, cost, d0) => {
      const nd = d0 + weight(cost);
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, from);
        heap.push([nd, to]);
      }
    };
    const walkCost = (distM) => ({ timeMin: distM / PLANNER.walkSpeedMpm, walkM: distM, fare: 0, board: 0 });

    while (heap.size) {
      const [d0, state] = heap.pop();
      if (d0 > (dist.get(state) ?? Infinity)) continue;
      if (state === 'D') break;

      if (state === 'O') {
        for (const a of origin.access) relax(state, `F|${a.stopId}`, walkCost(a.distM), d0);
        continue;
      }

      const parts = state.split('|');
      if (parts[0] === 'F') {
        const stopId = parts[1];
        if (destAccess.has(stopId)) relax(state, 'D', walkCost(destAccess.get(stopId)), d0);
        for (const { lineId, idx } of stops.get(stopId).lines) {
          const line = lines.get(lineId);
          relax(state, `R|${lineId}|${idx}`, { timeMin: line.headwayMin / 2, walkM: 0, fare: minFare(this.network.fares, line.mode), board: 1 }, d0);
        }
        // Walk only directly after alighting or from the origin, never chained.
        const from = prev.get(state);
        if (from && !from.startsWith('F|')) {
          for (const w of this.walkLinks.get(stopId)) relax(state, `F|${w.to}`, { ...walkCost(w.distM), timeMin: w.distM / PLANNER.walkSpeedMpm + 1 }, d0);
        }
      } else {
        const line = lines.get(parts[1]);
        const idx = Number(parts[2]);
        relax(state, `F|${line.stops[idx]}`, { timeMin: 0, walkM: 0, fare: 0, board: 0 }, d0);
        const factor = linePenalty?.has(line.id) ? 1.6 : 1;
        for (const next of [idx - 1, idx + 1]) {
          if (next < 0 || next >= line.stops.length) continue;
          const km = Math.abs(line.cumKm[next] - line.cumKm[idx]);
          const timeMin = ((km / line.avgSpeedKmph) * 60 + PLANNER.dwellMin) * factor;
          relax(state, `R|${line.id}|${next}`, { timeMin, walkM: 0, fare: km * this.perKm[line.mode], board: 0 }, d0);
        }
      }
    }

    if (!prev.has('D')) return null;
    const path = ['D'];
    while (path[0] !== 'O') path.unshift(prev.get(path[0]));
    return path;
  }

  #buildJourney(path, origin, dest) {
    const { stops, lines, fares } = this.network;
    const legs = [];
    const place = (stopId) => {
      const s = stops.get(stopId);
      return { stopId, name: s.name, mode: s.mode, lat: s.lat, lng: s.lng, hubId: this.stopToHub.get(stopId) ?? null };
    };
    const pushWalk = (from, to, kind) => {
      const distM = haversine(from, to);
      const last = legs[legs.length - 1];
      if (last?.type === 'walk') {
        last.to = to;
        last.distanceM += distM;
        return;
      }
      legs.push({ type: 'walk', kind, from, to, distanceM: distM });
    };

    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1];
      const b = path[k];
      if (a === 'O') {
        const to = place(b.split('|')[1]);
        if (!origin.point.stopId) pushWalk(origin.point, to, 'access');
      } else if (b === 'D') {
        const from = place(a.split('|')[1]);
        if (!dest.point.stopId) pushWalk(from, dest.point, 'egress');
      } else if (a.startsWith('F|') && b.startsWith('F|')) {
        pushWalk(place(a.split('|')[1]), place(b.split('|')[1]), 'transfer');
      } else if (a.startsWith('F|') && b.startsWith('R|')) {
        const [, lineId, idx] = b.split('|');
        legs.push({ type: 'ride', lineId, boardIdx: Number(idx), alightIdx: Number(idx) });
      } else if (a.startsWith('R|') && b.startsWith('R|')) {
        legs[legs.length - 1].alightIdx = Number(b.split('|')[2]);
      }
    }

    // Fill in the ride and walk details.
    for (const leg of legs) {
      if (leg.type === 'walk') {
        leg.distanceM = Math.round(leg.distanceM);
        leg.durationMin = Math.max(1, Math.round(leg.distanceM / PLANNER.walkSpeedMpm));
        const target = leg.to.stopId ? `${leg.to.name} (${MODES[leg.to.mode].label})` : leg.to.name;
        leg.instruction = `Walk ${leg.distanceM} m (${leg.durationMin} min) to ${target}`;
        continue;
      }
      const line = lines.get(leg.lineId);
      const step = leg.alightIdx >= leg.boardIdx ? 1 : -1;
      const idxs = [];
      for (let i = leg.boardIdx; i !== leg.alightIdx + step; i += step) idxs.push(i);
      const km = Math.abs(line.cumKm[leg.alightIdx] - line.cumKm[leg.boardIdx]);
      const towards = stops.get(line.stops[step === 1 ? line.stops.length - 1 : 0]).name;
      Object.assign(leg, {
        mode: line.mode,
        operator: line.operator,
        lineName: line.name,
        lineShortName: line.shortName ?? line.name,
        color: line.color,
        towards,
        from: place(line.stops[leg.boardIdx]),
        to: place(line.stops[leg.alightIdx]),
        stopCount: idxs.length - 1,
        path: idxs.map((i) => {
          const s = stops.get(line.stops[i]);
          return { stopId: s.id, name: s.name, lat: s.lat, lng: s.lng };
        }),
        distanceKm: round(km, 2),
        headwayMin: line.headwayMin,
        waitMin: Math.round(line.headwayMin / 2),
        rideMin: Math.max(1, Math.round((km / line.avgSpeedKmph) * 60 + PLANNER.dwellMin * Math.max(0, idxs.length - 2))),
      });
      leg.instruction = `Take ${MODES[line.mode].label} ${leg.lineShortName} towards ${towards} from ${leg.from.name}, ride ${leg.stopCount} stop${leg.stopCount === 1 ? '' : 's'} to ${leg.to.name}`;
      delete leg.boardIdx;
      delete leg.alightIdx;
    }

    const rides = legs.filter((l) => l.type === 'ride');
    if (!rides.length) return null; // walking-only "routes" are not transit options
    const tickets = ticketsForLegs(fares, legs);
    const split = fareSplit(tickets);
    const walkM = legs.filter((l) => l.type === 'walk').reduce((s, l) => s + l.distanceM, 0);
    const walkMin = legs.filter((l) => l.type === 'walk').reduce((s, l) => s + l.durationMin, 0);
    const waitMin = rides.reduce((s, l) => s + l.waitMin, 0);
    const rideMin = rides.reduce((s, l) => s + l.rideMin, 0);

    return {
      signature: rides.map((r) => `${r.lineId}:${r.from.stopId}>${r.to.stopId}`).join('|'),
      totalMin: walkMin + waitMin + rideMin,
      rideMin,
      waitMin,
      walkMin,
      walkM,
      distanceKm: round(rides.reduce((s, r) => s + r.distanceKm, 0), 2),
      transfers: rides.length - 1,
      modes: [...new Set(rides.map((r) => r.mode))],
      operators: [...new Set(rides.map((r) => r.operator))],
      fare: split.integratedFare,
      standaloneFare: split.standaloneFare,
      tickets: tickets.map(({ legIndices, ...t }) => ({ ...t, legs: legIndices })),
      fareSplit: split,
      legs,
    };
  }

  plan(fromEndpoint, toEndpoint) {
    const origin = this.resolveEndpoint(fromEndpoint);
    const dest = this.resolveEndpoint(toEndpoint);
    if (origin.point.stopId && origin.point.stopId === dest.point.stopId) {
      throw httpError(400, 'Start and destination are the same stop');
    }

    const found = new Map();
    const add = (path, source) => {
      if (!path) return null;
      const j = this.#buildJourney(path, origin, dest);
      if (!j) return null;
      if (!found.has(j.signature)) found.set(j.signature, { ...j, foundBy: [source] });
      else found.get(j.signature).foundBy.push(source);
      return j;
    };

    for (const [name, fn] of Object.entries(OBJECTIVES)) add(this.#dijkstra(origin, dest, fn, null), name);

    // Diversity: re-run "fastest" while penalising lines already used.
    const penalty = new Set();
    for (let k = 0; k < 2; k++) {
      [...found.values()].forEach((j) => j.legs.forEach((l) => l.lineId && penalty.add(l.lineId)));
      add(this.#dijkstra(origin, dest, OBJECTIVES.fastest, penalty), 'alternative');
    }

    // Drop options that another option beats or matches on every criterion.
    const KEYS = ['totalMin', 'fare', 'walkM', 'transfers'];
    const all = [...found.values()];
    let options = all.filter(
      (o) => !all.some((p) => p !== o && KEYS.every((k) => p[k] <= o[k]) && KEYS.some((k) => p[k] < o[k])),
    );
    if (!options.length) return { from: origin.point, to: dest.point, options: [] };

    const best = (key, tie = 'totalMin') =>
      options.reduce((a, b) => (b[key] < a[key] || (b[key] === a[key] && b[tie] < a[tie]) ? b : a));
    const tags = new Map(options.map((o) => [o, []]));
    tags.get(best('totalMin', 'fare')).push('fastest');
    tags.get(best('fare')).push('cheapest');
    tags.get(best('walkM')).push('leastWalking');
    tags.get(best('transfers')).push('fewestTransfers');

    options = options
      .sort((a, b) => tags.get(b).length - tags.get(a).length || a.totalMin - b.totalMin)
      .slice(0, PLANNER.maxOptions)
      .sort((a, b) => a.totalMin - b.totalMin)
      .map((o, i) => ({ id: `opt-${i + 1}`, tags: tags.get(o), ...o }));

    return { from: origin.point, to: dest.point, options };
  }
}

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
