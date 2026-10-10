import { HEAT, MODES, PLANNER } from '../config.js';
import { haversine } from '../utils/geo.js';
import { round } from './network.js';
import { ticketsForLegs, fareSplit } from './fares.js';
import { departuresFor, headwayAt, istClock, fmtMin, toMin } from './schedules.js';

/**
 * Schedule-aware multimodal planner (RAPTOR).
 *
 * Each line runs as two patterns (one per direction) with trips generated
 * from its published schedule. Round k finds the earliest arrival at every
 * stop using at most k rides, so one search yields the fastest journey for
 * each number of changes. A change is only feasible when the walk plus
 * PLANNER.transferBufferMin fits before the next departure.
 */

const walkMinutes = (m) => m / PLANNER.walkSpeedMpm;

/** Index of the first value >= x in a sorted array. */
function lowerBound(arr, x) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export class Planner {
  constructor(network, stopToHub) {
    this.network = network;
    this.stopToHub = stopToHub;
    this.walkLinks = this.#buildWalkLinks();
    this.patterns = this.#buildPatterns();
    this.patternsByStop = new Map();
    this.patterns.forEach((p) =>
      p.stops.forEach((s, pos) => {
        if (!this.patternsByStop.has(s)) this.patternsByStop.set(s, []);
        this.patternsByStop.get(s).push({ p, pos });
      }),
    );
    this.tripCache = new Map();
  }

  /** Stops reachable on foot from each stop: anything within 500 m, plus every other member of its hub. */
  #buildWalkLinks() {
    const list = [...this.network.stops.values()];
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

  /** One pattern per line direction, with minute offsets of each stop from the first departure. */
  #buildPatterns() {
    const out = [];
    for (const line of this.network.lines.values()) {
      const s = line.schedule;
      // Published end-to-end run time spread by distance; otherwise a sourced average speed.
      const minPerKm = s.runTimeMin > 0 ? s.runTimeMin / line.lengthKm : 60 / line.avgSpeedKmph;
      const n = line.stops.length;
      for (const dir of ['forward', 'reverse']) {
        const idxs = [...Array(n).keys()];
        if (dir === 'reverse') idxs.reverse();
        const origin = line.cumKm[idxs[0]];
        out.push({
          key: `${line.id}:${dir}`,
          line,
          dir,
          idxs,
          stops: idxs.map((i) => line.stops[i]),
          offsets: idxs.map((i) => Math.abs(line.cumKm[i] - origin) * minPerKm),
          schedule: dir === 'reverse' && s.reverse ? { ...s, ...s.reverse } : s,
        });
      }
    }
    return out;
  }

  #trips(p, day) {
    const key = `${p.key}:${day}`;
    if (!this.tripCache.has(key)) this.tripCache.set(key, departuresFor(p.schedule, day));
    return this.tripCache.get(key);
  }

  /**
   * Stops served by a routable line that can be walked to from `p`: all within
   * walking range, or the nearest few when none are.
   */
  #walkToService(p, exclude = new Set()) {
    const ranked = [...this.network.stops.values()]
      .filter((s) => s.lines.length && !exclude.has(s.id))
      .map((s) => ({ stopId: s.id, distM: haversine(p, s) }))
      .sort((a, b) => a.distM - b.distM);
    const inRange = ranked.filter((r) => r.distM <= PLANNER.accessWalkMaxM);
    return inRange.length ? inRange : ranked.slice(0, PLANNER.accessMinStops);
  }

  /** Resolves an endpoint (stop id or {lat,lng}) into walking links to stops with service. */
  resolveEndpoint(endpoint) {
    const { stops } = this.network;
    if (endpoint.stopId) {
      const s = stops.get(endpoint.stopId);
      if (!s) throw httpError(404, `Unknown stop: ${endpoint.stopId}`);
      // The stop itself plus its interchange neighbours, so a nearby mode can start or end the trip.
      const access = [{ stopId: s.id, distM: 0 }, ...this.walkLinks.get(s.id).map((w) => ({ stopId: w.to, distM: w.distM }))];
      // When none of those has a routable line, walk to the nearest stops that do.
      if (!access.some((a) => stops.get(a.stopId).lines.length)) access.push(...this.#walkToService(s, new Set(access.map((a) => a.stopId))));
      return { point: { name: s.name, lat: s.lat, lng: s.lng, stopId: s.id, mode: s.mode }, access };
    }
    const p = endpoint.point;
    return { point: { name: endpoint.name ?? 'Selected location', lat: p.lat, lng: p.lng }, access: this.#walkToService(p) };
  }

  /** Stops, lines and line sections closed by active closures. */
  #blocked(closures) {
    const blocked = { lines: new Set(), stops: new Set(), sections: new Map() };
    for (const c of closures) {
      if (c.type === 'line') blocked.lines.add(c.lineId);
      else if (c.type === 'stop') blocked.stops.add(c.stopId);
      else {
        const line = this.network.lines.get(c.lineId);
        if (!line) continue;
        const a = line.stops.indexOf(c.fromStopId);
        const b = line.stops.indexOf(c.toStopId);
        if (a < 0 || b < 0) continue;
        if (!blocked.sections.has(line.id)) blocked.sections.set(line.id, []);
        blocked.sections.get(line.id).push([Math.min(a, b), Math.max(a, b)]);
      }
    }
    return blocked;
  }

  /** Returns the Pareto set: for each number of rides, the earliest arrival that beats every option with fewer rides. */
  #raptor(origin, dest, t0, day, excluded, blocked) {
    const buffer = PLANNER.transferBufferMin;
    const closedStop = (s) => blocked.stops.has(s);
    const sectionClosed = (p, i) => {
      const ranges = blocked.sections.get(p.line.id);
      if (!ranges) return false;
      const lo = Math.min(p.idxs[i - 1], p.idxs[i]);
      const hi = Math.max(p.idxs[i - 1], p.idxs[i]);
      return ranges.some(([a, b]) => a <= lo && hi <= b);
    };
    const egress = new Map();
    for (const e of dest.access) {
      if (closedStop(e.stopId)) continue;
      if (!egress.has(e.stopId) || e.distM < egress.get(e.stopId)) egress.set(e.stopId, e.distM);
    }

    const arr = [new Map()];
    const ready = [new Map()];
    const parent = [new Map()];
    const best = new Map();
    let marked = new Set();
    for (const a of origin.access) {
      if (closedStop(a.stopId)) continue;
      const t = t0 + walkMinutes(a.distM);
      if (t < (best.get(a.stopId) ?? Infinity)) {
        arr[0].set(a.stopId, t);
        ready[0].set(a.stopId, t); // no change yet, so no buffer before the first boarding
        parent[0].set(a.stopId, { type: 'access', distM: a.distM });
        best.set(a.stopId, t);
        marked.add(a.stopId);
      }
    }

    let bestDest = Infinity;
    const found = [];
    for (let k = 1; k <= PLANNER.maxRides && marked.size; k++) {
      arr[k] = new Map(arr[k - 1]);
      ready[k] = new Map(ready[k - 1]);
      parent[k] = new Map(parent[k - 1]);

      const queue = new Map();
      for (const s of marked) {
        for (const { p, pos } of this.patternsByStop.get(s) ?? []) {
          if (excluded.has(p.line.id)) continue;
          if (!queue.has(p) || pos < queue.get(p)) queue.set(p, pos);
        }
      }

      const rideMarked = new Set();
      for (const [p, startPos] of queue) {
        const deps = this.#trips(p, day);
        if (!deps.length) continue;
        let trip = -1;
        let boardPos = -1;
        for (let i = startPos; i < p.stops.length; i++) {
          const s = p.stops[i];
          // A closed section cannot be ridden through; board again beyond it if possible.
          if (trip >= 0 && i > 0 && sectionClosed(p, i)) trip = -1;
          if (trip >= 0 && !closedStop(s)) {
            const t = deps[trip] + p.offsets[i];
            if (t < (best.get(s) ?? Infinity) && t < bestDest) {
              arr[k].set(s, t);
              ready[k].set(s, t + buffer);
              parent[k].set(s, { type: 'ride', round: k, p, trip, boardPos, alightPos: i });
              best.set(s, t);
              rideMarked.add(s);
            }
          }
          const r = ready[k - 1].get(s);
          if (r == null || i === p.stops.length - 1 || closedStop(s)) continue;
          const idx = lowerBound(deps, r - p.offsets[i]);
          if (idx < deps.length && (trip < 0 || idx < trip)) {
            trip = idx;
            boardPos = i;
          }
        }
      }

      // One walk after each ride, to a nearby stop or another mode at the same hub.
      const newMarked = new Set(rideMarked);
      for (const s of rideMarked) {
        const base = arr[k].get(s);
        for (const w of this.walkLinks.get(s)) {
          if (closedStop(w.to)) continue;
          const t = base + walkMinutes(w.distM);
          if (t < (best.get(w.to) ?? Infinity) && t < bestDest) {
            arr[k].set(w.to, t);
            ready[k].set(w.to, t + buffer);
            parent[k].set(w.to, { type: 'walk', round: k, from: s, distM: w.distM });
            best.set(w.to, t);
            newMarked.add(w.to);
          }
        }
      }

      let roundBest = null;
      for (const s of newMarked) {
        if (!egress.has(s)) continue;
        const t = arr[k].get(s) + walkMinutes(egress.get(s));
        if (t < bestDest) {
          bestDest = t;
          roundBest = s;
        }
      }
      if (roundBest) found.push(this.#reconstruct(parent, arr, k, roundBest, day));
      marked = newMarked;
    }
    return found;
  }

  /** Walks the parent pointers back from `stop` in round k into raw legs with clock times. */
  #reconstruct(parent, arr, k, stop, day) {
    const legs = [];
    let cur = stop;
    let r = k;
    for (;;) {
      const p = parent[r].get(cur);
      if (p.type === 'access') {
        legs.unshift({ type: 'access', toStop: cur, distM: p.distM });
        break;
      }
      if (p.type === 'walk') {
        legs.unshift({ type: 'walk', fromStop: p.from, toStop: cur, distM: p.distM, depart: arr[p.round].get(p.from) });
        cur = p.from;
        r = p.round;
        continue;
      }
      const deps = this.#trips(p.p, day);
      legs.unshift({
        type: 'ride',
        pattern: p.p,
        boardPos: p.boardPos,
        alightPos: p.alightPos,
        depart: deps[p.trip] + p.p.offsets[p.boardPos],
        arrive: deps[p.trip] + p.p.offsets[p.alightPos],
      });
      cur = p.p.stops[p.boardPos];
      r = p.round - 1;
    }
    return { legs, finalStop: stop };
  }

  #place(stopId) {
    const s = this.network.stops.get(stopId);
    return { stopId, name: s.name, mode: s.mode, lat: s.lat, lng: s.lng, hubId: this.stopToHub.get(stopId) ?? null };
  }

  /** Turns raw RAPTOR legs into the journey shape the clients render. */
  #buildJourney(raw, origin, dest, day) {
    const { fares } = this.network;
    const firstRide = raw.legs.find((l) => l.type === 'ride');
    if (!firstRide) return null;
    const legs = [];
    const egressM = dest.access.find((a) => a.stopId === raw.finalStop)?.distM ?? 0;

    const walk = (from, to, distM, depart, kind) => {
      const durationMin = Math.max(1, Math.round(walkMinutes(distM)));
      const target = to.stopId ? `${to.name} (${MODES[to.mode].label})` : to.name;
      legs.push({
        type: 'walk',
        kind,
        from,
        to,
        distanceM: Math.round(distM),
        durationMin,
        departTime: fmtMin(depart),
        arriveTime: fmtMin(depart + walkMinutes(distM)),
        instruction: `Walk ${Math.round(distM)} m (${durationMin} min) to ${target}`,
      });
    };

    const access = raw.legs[0];
    const leave = firstRide.depart - walkMinutes(access.distM);
    if (access.distM > 0) walk(origin.point.stopId ? origin.point : origin.point, this.#place(access.toStop), access.distM, leave, 'access');

    let clock = firstRide.depart;
    for (const l of raw.legs.slice(1)) {
      if (l.type === 'walk') {
        walk(this.#place(l.fromStop), this.#place(l.toStop), l.distM, l.depart, 'transfer');
        clock = l.depart + walkMinutes(l.distM);
        continue;
      }
      const p = l.pattern;
      const line = p.line;
      const idxs = p.idxs.slice(l.boardPos, l.alightPos + 1);
      const km = Math.abs(line.cumKm[idxs[idxs.length - 1]] - line.cumKm[idxs[0]]);
      const from = this.#place(p.stops[l.boardPos]);
      const to = this.#place(p.stops[l.alightPos]);
      const towards = this.network.stops.get(p.stops[p.stops.length - 1]).name;
      const headway = headwayAt(p.schedule, day, l.depart);
      const stopCount = idxs.length - 1;
      legs.push({
        type: 'ride',
        mode: line.mode,
        operator: line.operator,
        lineId: line.id,
        lineName: line.name,
        lineShortName: line.shortName ?? line.name,
        color: line.color,
        towards,
        from,
        to,
        stopCount,
        path: idxs.map((i) => {
          const s = this.network.stops.get(line.stops[i]);
          return { stopId: s.id, name: s.name, lat: s.lat, lng: s.lng };
        }),
        distanceKm: round(km, 2),
        headwayMin: headway,
        departTime: fmtMin(l.depart),
        arriveTime: fmtMin(l.arrive),
        waitMin: Math.max(0, Math.round(l.depart - clock)),
        rideMin: Math.max(1, Math.round(l.arrive - l.depart)),
        instruction: `${fmtMin(l.depart)} take ${MODES[line.mode].label} ${line.shortName ?? line.name} towards ${towards} from ${from.name}, ride ${stopCount} stop${stopCount === 1 ? '' : 's'} to ${to.name} (arrive ${fmtMin(l.arrive)})`,
      });
      clock = l.arrive;
    }
    if (egressM > 0 || dest.point.stopId !== raw.finalStop) {
      walk(this.#place(raw.finalStop), dest.point, egressM, clock, 'egress');
      clock += walkMinutes(egressM);
    }

    const rides = legs.filter((l) => l.type === 'ride');
    const walks = legs.filter((l) => l.type === 'walk');
    const tickets = ticketsForLegs(fares, legs);
    const split = fareSplit(tickets);
    return {
      signature: rides.map((r) => `${r.lineId}:${r.from.stopId}>${r.to.stopId}`).join('|'),
      leaveTime: fmtMin(leave),
      arriveTime: fmtMin(clock),
      arriveMin: clock,
      totalMin: Math.round(clock - leave),
      rideMin: rides.reduce((s, l) => s + l.rideMin, 0),
      waitMin: rides.reduce((s, l) => s + l.waitMin, 0),
      walkMin: walks.reduce((s, l) => s + l.durationMin, 0),
      walkM: walks.reduce((s, l) => s + l.distanceM, 0),
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

  /** Lines that cannot be boarded around the requested time, so clients can explain missing options. */
  #notRunning(t0, day) {
    const out = [];
    for (const line of this.network.lines.values()) {
      const deps = this.patterns.filter((p) => p.line === line).flatMap((p) => this.#trips(p, day));
      if (!deps.length) out.push({ lineId: line.id, name: line.name, mode: line.mode, status: 'noServiceToday' });
      else if (Math.max(...deps) < t0) out.push({ lineId: line.id, name: line.name, mode: line.mode, status: 'ended', lastDeparture: fmtMin(Math.max(...deps)) });
      else if (Math.min(...deps) > t0) out.push({ lineId: line.id, name: line.name, mode: line.mode, status: 'notStarted', firstDeparture: fmtMin(Math.min(...deps)) });
    }
    return out;
  }

  /**
   * Plans from `fromEndpoint` to `toEndpoint` leaving at `at` (a Date; IST
   * clock), avoiding the closures `closuresAt(date)` returns. `weather`
   * ({feelsLikeC, ...} or null) switches on heat-aware ranking. When nothing
   * runs after `at` that day, it plans the first trips of the next day and
   * says so (`nextDay`, `requestedDepartAt`). Returns feasible options, the
   * recommended one first; `departIso` is the time actually planned for.
   */
  plan(fromEndpoint, toEndpoint, { at = new Date(), closuresAt = () => [], weather = null } = {}) {
    const result = this.#planAt(fromEndpoint, toEndpoint, { at, closures: closuresAt(at), weather });
    if (result.options.length) return { ...result, departIso: at.toISOString(), nextDay: false };

    // Next IST midnight: the search then boards the first departures of the day.
    const { min } = istClock(at);
    const next = new Date(at.getTime() + (24 * 60 - min) * 60e3 - (at.getTime() % 60e3));
    const tomorrow = this.#planAt(fromEndpoint, toEndpoint, { at: next, closures: closuresAt(next), weather: null });
    if (!tomorrow.options.length) return { ...result, departIso: at.toISOString(), nextDay: false };
    return { ...tomorrow, departIso: next.toISOString(), nextDay: true, requestedDepartAt: result.departAt, notRunning: result.notRunning };
  }

  #planAt(fromEndpoint, toEndpoint, { at, closures, weather }) {
    const origin = this.resolveEndpoint(fromEndpoint);
    const dest = this.resolveEndpoint(toEndpoint);
    if (origin.point.stopId && origin.point.stopId === dest.point.stopId) {
      throw httpError(400, 'Start and destination are the same stop');
    }
    const { day, min: t0 } = istClock(at);
    const blocked = this.#blocked(closures);
    const hot = weather?.feelsLikeC >= HEAT.thresholdC;

    const found = new Map();
    const collect = (journeys) => {
      for (const raw of journeys) {
        const j = this.#buildJourney(raw, origin, dest, day);
        if (j && !found.has(j.signature)) found.set(j.signature, j);
      }
    };
    const pareto = this.#raptor(origin, dest, t0, day, blocked.lines, blocked);
    collect(pareto);

    // Alternatives: re-run without each line of the fastest journey in turn.
    const fastest = pareto[pareto.length - 1];
    const fastestLines = fastest ? [...new Set(fastest.legs.filter((l) => l.type === 'ride').map((l) => l.pattern.line.id))] : [];
    for (const lineId of fastestLines.slice(0, 3)) collect(this.#raptor(origin, dest, t0, day, new Set([...blocked.lines, lineId]), blocked));

    let options = [...found.values()];
    const result = {
      from: origin.point,
      to: dest.point,
      departAt: fmtMin(t0),
      day,
      weather: weather && { ...weather, heatMode: hot },
      notRunning: this.#notRunning(t0, day),
    };
    if (!options.length) return { ...result, options: [] };

    // Drop options another option beats or matches on arrival, changes, walking and fare.
    const KEYS = ['arriveMin', 'transfers', 'walkM', 'fare'];
    options = options.filter((o) => !options.some((q) => q !== o && KEYS.every((k) => q[k] <= o[k]) && KEYS.some((k) => q[k] < o[k])));

    if (hot) {
      for (const o of options)
        for (const l of o.legs) if (l.type === 'walk' && l.distanceM >= HEAT.longWalkM) l.heatWarning = `${l.distanceM} m walk at ${Math.round(weather.feelsLikeC)} °C feels-like`;
    }

    const earliest = Math.min(...options.map((o) => o.arriveMin));
    const byFeasibility = (a, b) => a.transfers - b.transfers || a.walkM - b.walkM || a.fare - b.fare || a.arriveMin - b.arriveMin;
    const byShade = (a, b) => a.walkM - b.walkM || byFeasibility(a, b);
    // In heat, less walking outranks fewer changes within a wider arrival window.
    const recommended = hot
      ? options.filter((o) => o.arriveMin <= earliest + HEAT.windowMin).sort(byShade)[0]
      : options.filter((o) => o.arriveMin <= earliest + PLANNER.similarArrivalMin).sort(byFeasibility)[0];
    const pick = (cmp) => [...options].sort(cmp)[0];
    const tags = new Map(options.map((o) => [o, []]));
    tags.get(recommended).push('recommended');
    tags.get(pick((a, b) => a.arriveMin - b.arriveMin || byFeasibility(a, b))).push('fastest');
    tags.get(pick(byFeasibility)).push('fewestTransfers');
    tags.get(pick((a, b) => a.walkM - b.walkM || a.arriveMin - b.arriveMin)).push('leastWalking');
    tags.get(pick((a, b) => a.fare - b.fare || a.arriveMin - b.arriveMin)).push('cheapest');

    const changes = (o) => (o.transfers === 0 ? 'no changes' : `${o.transfers} change${o.transfers === 1 ? '' : 's'}`);
    const why = (o) => {
      if (o !== recommended) return null;
      if (hot) return `It is ${Math.round(weather.feelsLikeC)} °C feels-like: least walking (${o.walkM} m) among routes arriving within ${HEAT.windowMin} min of the fastest`;
      return o.arriveMin === earliest
        ? `Earliest arrival (${o.arriveTime}) with ${changes(o)}`
        : `Arrives ${Math.round(o.arriveMin - earliest)} min after the fastest option but with fewer changes or less walking`;
    };

    options = options
      .sort((a, b) => (a === recommended ? -1 : b === recommended ? 1 : a.arriveMin - b.arriveMin))
      .slice(0, PLANNER.maxOptions)
      .map((o, i) => {
        const { arriveMin, ...rest } = o;
        return { id: `opt-${i + 1}`, tags: tags.get(o), reason: why(o), ...rest };
      });
    return { ...result, options };
  }
}

/** Parses a departure: "HH:MM" today (IST) or an ISO date-time; defaults to now. */
export function parseDepart(value, now = new Date()) {
  if (!value) return now;
  const m = toMin(value);
  if (m != null) {
    const { min } = istClock(now);
    return new Date(now.getTime() + (m - min) * 60e3);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw httpError(400, 'depart must be "HH:MM" or an ISO date-time');
  return d;
}

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
