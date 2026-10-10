import { OVERLAP, MODES } from '../config.js';
import { haversine, centroid } from '../utils/geo.js';
import { round } from './network.js';

// Words that describe the stop type rather than the place itself.
const NOISE = new Set([
  'metro', 'station', 'brts', 'amts', 'gsrtc', 'bus', 'stand', 'port', 'busport',
  'depot', 'terminus', 'terminal', 'stop', 'st', 'junction', 'jn', 'the',
]);

export function normaliseName(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !NOISE.has(w))
    .join(' ');
}

function namesMatch(a, b) {
  const x = normaliseName(a);
  const y = normaliseName(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

class UnionFind {
  constructor(ids) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }
  find(x) {
    let p = this.parent.get(x);
    while (p !== x) {
      const gp = this.parent.get(p);
      this.parent.set(x, gp);
      x = p;
      p = gp;
    }
    return x;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

const HUB_TYPES = { 2: 'dual', 3: 'triple', 4: 'quad', 5: 'penta' };
const MODE_PRIORITY = ['metro', 'brts', 'gsrtc', 'gmcbus', 'amts'];

/**
 * Finds overlapping stations: stops of different modes that are close enough
 * (or close and similarly named) to count as one interchange hub.
 */
export function detectHubs(network) {
  const stops = [...network.stops.values()];
  const uf = new UnionFind(stops.map((s) => s.id));
  const links = [];

  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const a = stops[i];
      const b = stops[j];
      if (a.mode === b.mode) continue;
      const d = haversine(a, b);
      if (d > OVERLAP.sameNameM) continue;
      const sameName = namesMatch(a.name, b.name);
      if (d <= OVERLAP.nearM || sameName) {
        uf.union(a.id, b.id);
        links.push({ a: a.id, b: b.id, distanceM: Math.round(d), reason: sameName ? 'name+distance' : 'distance' });
      }
    }
  }

  const groups = new Map();
  for (const s of stops) {
    const root = uf.find(s.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(s);
  }

  const hubs = [];
  const stopToHub = new Map();
  for (const members of groups.values()) {
    const modes = [...new Set(members.map((m) => m.mode))];
    if (modes.length < 2) continue;

    let maxWalkM = 0;
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++)
        maxWalkM = Math.max(maxWalkM, haversine(members[i], members[j]));

    const anchor = [...members].sort(
      (x, y) => MODE_PRIORITY.indexOf(x.mode) - MODE_PRIORITY.indexOf(y.mode),
    )[0];
    const lineIds = [...new Set(members.flatMap((m) => m.lines.map((l) => l.lineId)))];

    hubs.push({
      name: anchor.name,
      ...roundPoint(centroid(members)),
      modes: MODE_PRIORITY.filter((m) => modes.includes(m)),
      type: HUB_TYPES[modes.length] ?? 'multi',
      operators: [...new Set(members.map((m) => MODES[m.mode].operator))],
      lineCount: lineIds.length,
      lines: lineIds,
      maxWalkM: Math.round(maxWalkM),
      maxWalkMin: round(maxWalkM / 80, 1),
      members: members.map((m) => ({
        stopId: m.id,
        name: m.name,
        mode: m.mode,
        lat: m.lat,
        lng: m.lng,
        lines: m.lines.map((l) => l.lineId),
      })),
    });
  }

  // Most connected first, then id assignment is stable for the clients.
  hubs.sort((x, y) => y.modes.length - x.modes.length || y.lineCount - x.lineCount || x.name.localeCompare(y.name));
  hubs.forEach((h, i) => {
    h.id = `hub-${String(i + 1).padStart(3, '0')}`;
    h.members.forEach((m) => stopToHub.set(m.stopId, h.id));
  });

  return { hubs, stopToHub, links };
}

/**
 * Corridor overlaps: pairs of lines (from different operators) that pass
 * through 2+ of the same hubs in the same order, i.e. duplicated service.
 */
export function detectCorridorOverlaps(network, stopToHub) {
  const lineHubSeq = new Map();
  for (const line of network.lines.values()) {
    const seq = [];
    line.stops.forEach((id, idx) => {
      const hub = stopToHub.get(id);
      if (hub && seq[seq.length - 1]?.hub !== hub) seq.push({ hub, idx });
    });
    lineHubSeq.set(line.id, seq);
  }

  const lines = [...network.lines.values()];
  const overlaps = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const A = lines[i];
      const B = lines[j];
      if (A.operator === B.operator) continue;
      const bPos = new Map(lineHubSeq.get(B.id).map((h, k) => [h.hub, k]));
      const shared = lineHubSeq.get(A.id).filter((h) => bPos.has(h.hub));
      if (shared.length < 2) continue;

      // Split the shared hubs into runs that are consecutive in both lines.
      let run = [shared[0]];
      const flush = () => {
        if (run.length >= 2) {
          const first = run[0];
          const last = run[run.length - 1];
          overlaps.push({
            lineA: A.id,
            lineB: B.id,
            modes: [A.mode, B.mode],
            operators: [A.operator, B.operator],
            hubs: run.map((h) => h.hub),
            sharedHubCount: run.length,
            lengthKm: round(Math.abs(A.cumKm[last.idx] - A.cumKm[first.idx]), 2),
          });
        }
      };
      for (let k = 1; k < shared.length; k++) {
        const step = bPos.get(shared[k].hub) - bPos.get(shared[k - 1].hub);
        const prevStep = run.length >= 2 ? bPos.get(run[run.length - 1].hub) - bPos.get(run[run.length - 2].hub) : step;
        if (Math.abs(step) === 1 && Math.sign(step) === Math.sign(prevStep)) {
          run.push(shared[k]);
        } else {
          flush();
          run = [shared[k]];
        }
      }
      flush();
    }
  }

  overlaps.sort((x, y) => y.lengthKm - x.lengthKm);
  return overlaps.map((o, i) => ({ id: `ovl-${String(i + 1).padStart(3, '0')}`, ...o }));
}

function roundPoint(p) {
  return { lat: round(p.lat, 6), lng: round(p.lng, 6) };
}
