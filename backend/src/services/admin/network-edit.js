import { MODES } from '../../config.js';
import { getState } from '../../state.js';
import { haversine } from '../../utils/geo.js';
import { round } from '../network.js';
import { httpError } from '../planner.js';
import { readData, commitData } from './store.js';
import { checkStop, checkPlatform, checkLine, checkSlabs, checkMode, slugify, uniqueId } from './validate.js';

/**
 * Admin edits work on the raw data files (which include suspended lines and
 * extra fields), then commitData() rewrites them and rebuilds the live state.
 */

const notFound = (what) => httpError(404, `${what} not found`);
const hubOf = (stopId) => {
  try {
    return getState().stopToHub.get(stopId) ?? null;
  } catch {
    return null;
  }
};

function load() {
  return { stops: readData('stops.json'), lines: readData('lines.json') };
}

function lineLengthKm(line, stopById) {
  let km = 0;
  for (let i = 1; i < line.stops.length; i++) {
    const a = stopById.get(line.stops[i - 1]);
    const b = stopById.get(line.stops[i]);
    if (a && b) km += haversine(a, b) / 1000;
  }
  return round(km, 2);
}

// ---------- stops ----------

export function listStops({ mode, q, limit = 200, offset = 0 } = {}) {
  const { stops, lines } = load();
  const linesAt = new Map();
  for (const l of lines) for (const id of new Set(l.stops)) linesAt.set(id, [...(linesAt.get(id) ?? []), l.id]);
  let list = stops;
  if (mode) list = list.filter((s) => s.mode === mode);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((s) => s.name.toLowerCase().includes(needle) || s.id.toLowerCase().includes(needle));
  }
  list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  return {
    total: list.length,
    items: list.slice(offset, offset + limit).map((s) => ({
      ...s,
      approx: Boolean(s.approx),
      lines: linesAt.get(s.id) ?? [],
      platformCount: s.platforms?.length ?? 0,
      hubId: hubOf(s.id),
    })),
  };
}

export function getStop(id) {
  const { stops, lines } = load();
  const s = stops.find((x) => x.id === id);
  if (!s) throw notFound('Stop');
  return {
    ...s,
    approx: Boolean(s.approx),
    platforms: s.platforms ?? [],
    lines: lines.filter((l) => l.stops.includes(id)).map((l) => ({ id: l.id, name: l.name, shortName: l.shortName, mode: l.mode, color: l.color ?? MODES[l.mode]?.color, active: l.active !== false })),
    hubId: hubOf(id),
  };
}

export function createStop(body) {
  const { stops } = load();
  const taken = new Set(stops.map((s) => s.id));
  const id = body.id ? String(body.id) : uniqueId(`${body.mode}-${slugify(body.name ?? '')}`, taken);
  if (taken.has(id)) throw httpError(409, `Stop id ${id} already exists`);
  const stop = checkStop({ ...body, id, platforms: [] });
  commitData({ 'stops.json': [...stops, stop] });
  return stop;
}

export function updateStop(id, body) {
  const { stops } = load();
  const i = stops.findIndex((s) => s.id === id);
  if (i < 0) throw notFound('Stop');
  const merged = { ...stops[i], ...body, id }; // id is immutable; lines reference it
  if (body.approx === false) delete merged.approx;
  const stop = checkStop(merged);
  const next = [...stops];
  next[i] = stop;
  commitData({ 'stops.json': next });
  return { before: stops[i], after: stop };
}

/** Refuses while lines use the stop, unless force, which also drops it from those lines. */
export function deleteStop(id, force) {
  const { stops, lines } = load();
  const stop = stops.find((s) => s.id === id);
  if (!stop) throw notFound('Stop');
  const using = lines.filter((l) => l.stops.includes(id));
  if (using.length && !force) {
    throw httpError(409, `Stop is used by ${using.length} line(s): ${using.map((l) => l.id).join(', ')}. Use ?force=1 to remove it from them.`);
  }
  const changes = { 'stops.json': stops.filter((s) => s.id !== id) };
  const shortLines = [];
  if (using.length) {
    changes['lines.json'] = lines.map((l) => {
      if (!l.stops.includes(id)) return l;
      const kept = l.stops.filter((s) => s !== id).filter((s, k, arr) => !k || arr[k - 1] !== s);
      if (kept.length < 2) shortLines.push(l.id);
      return { ...l, stops: kept };
    });
    if (shortLines.length) throw httpError(409, `Removing this stop would leave fewer than 2 stops on: ${shortLines.join(', ')}. Edit or delete those lines first.`);
  }
  commitData(changes);
  return { stop, removedFromLines: using.map((l) => l.id) };
}

// ---------- platforms ----------

function withStop(stopId, fn) {
  const { stops, lines } = load();
  const i = stops.findIndex((s) => s.id === stopId);
  if (i < 0) throw notFound('Stop');
  const lineIdsAtStop = new Set(lines.filter((l) => l.stops.includes(stopId)).map((l) => l.id));
  const platforms = [...(stops[i].platforms ?? [])];
  const result = fn(platforms, lineIdsAtStop);
  const next = [...stops];
  next[i] = { ...stops[i], platforms };
  if (!platforms.length) delete next[i].platforms;
  commitData({ 'stops.json': next });
  return result;
}

export function listPlatforms(stopId) {
  return getStop(stopId).platforms;
}

export function createPlatform(stopId, body) {
  return withStop(stopId, (platforms, lineIds) => {
    const taken = new Set(platforms.map((p) => p.id));
    const id = body.id ? String(body.id) : uniqueId(`p${platforms.length + 1}`, taken);
    if (taken.has(id)) throw httpError(409, `Platform ${id} already exists`);
    const p = checkPlatform({ ...body, id }, lineIds);
    platforms.push(p);
    return p;
  });
}

export function updatePlatform(stopId, pid, body) {
  return withStop(stopId, (platforms, lineIds) => {
    const i = platforms.findIndex((p) => p.id === pid);
    if (i < 0) throw notFound('Platform');
    platforms[i] = checkPlatform({ ...platforms[i], ...body, id: pid }, lineIds);
    return platforms[i];
  });
}

export function deletePlatform(stopId, pid) {
  return withStop(stopId, (platforms) => {
    const i = platforms.findIndex((p) => p.id === pid);
    if (i < 0) throw notFound('Platform');
    return platforms.splice(i, 1)[0];
  });
}

/** Drops platform references to a line at stops it no longer serves. */
function prunePlatforms(stops, lines) {
  const serving = new Map();
  for (const l of lines) for (const id of l.stops) serving.set(id, (serving.get(id) ?? new Set()).add(l.id));
  let changed = false;
  const next = stops.map((s) => {
    if (!s.platforms?.length) return s;
    const ok = serving.get(s.id) ?? new Set();
    const platforms = s.platforms.map((p) => {
      const lineIds = p.lineIds.filter((id) => ok.has(id));
      if (lineIds.length !== p.lineIds.length) changed = true;
      return { ...p, lineIds };
    });
    return { ...s, platforms };
  });
  return changed ? next : null;
}

// ---------- lines ----------

export function listLines({ mode, q, status } = {}) {
  const { stops, lines } = load();
  const stopById = new Map(stops.map((s) => [s.id, s]));
  let list = lines;
  if (mode) list = list.filter((l) => l.mode === mode);
  if (status === 'active') list = list.filter((l) => l.active !== false);
  if (status === 'suspended') list = list.filter((l) => l.active === false);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((l) => [l.id, l.name, l.shortName].some((v) => v?.toLowerCase().includes(needle)));
  }
  return list.map((l) => ({
    ...l,
    shortName: l.shortName ?? l.name,
    operator: l.operator ?? MODES[l.mode]?.operator,
    color: l.color ?? MODES[l.mode]?.color,
    avgSpeedKmph: l.avgSpeedKmph ?? MODES[l.mode]?.defaultSpeedKmph,
    headwayMin: l.headwayMin ?? MODES[l.mode]?.defaultHeadwayMin,
    active: l.active !== false,
    stopCount: l.stops.length,
    lengthKm: lineLengthKm(l, stopById),
    from: stopById.get(l.stops[0])?.name,
    to: stopById.get(l.stops[l.stops.length - 1])?.name,
  }));
}

export function getLine(id) {
  const { stops } = load();
  const line = listLines().find((l) => l.id === id);
  if (!line) throw notFound('Line');
  const stopById = new Map(stops.map((s) => [s.id, s]));
  return {
    ...line,
    stops: line.stops.map((sid) => {
      const s = stopById.get(sid);
      return s ? { id: s.id, name: s.name, mode: s.mode, lat: s.lat, lng: s.lng } : { id: sid, name: `${sid} (missing)`, missing: true };
    }),
  };
}

export function createLine(body) {
  const { stops, lines } = load();
  const taken = new Set(lines.map((l) => l.id));
  checkMode(body.mode);
  const id = body.id ? String(body.id) : uniqueId(`${body.mode}-${slugify(body.shortName || body.name || '')}`, taken);
  if (taken.has(id)) throw httpError(409, `Line id ${id} already exists`);
  const line = checkLine({ ...body, id }, new Set(stops.map((s) => s.id)));
  commitData({ 'lines.json': [...lines, line] });
  return { ...line, active: line.active !== false };
}

export function updateLine(id, body) {
  const { stops, lines } = load();
  const i = lines.findIndex((l) => l.id === id);
  if (i < 0) throw notFound('Line');
  const merged = { ...lines[i], ...body, id };
  if (body.active === true) {
    delete merged.suspendedReason;
    delete merged.suspendedAt;
  }
  if (body.active === false && lines[i].active !== false) delete merged.suspendedAt;
  const line = checkLine(merged, new Set(stops.map((s) => s.id)));
  const next = [...lines];
  next[i] = line;
  const changes = { 'lines.json': next };
  const pruned = prunePlatforms(stops, next);
  if (pruned) changes['stops.json'] = pruned;
  commitData(changes);
  return { before: lines[i], after: { ...line, active: line.active !== false } };
}

export function setLineActive(id, active, reason) {
  return updateLine(id, { active: Boolean(active), suspendedReason: active ? undefined : reason });
}

export function deleteLine(id) {
  const { stops, lines } = load();
  const line = lines.find((l) => l.id === id);
  if (!line) throw notFound('Line');
  const next = lines.filter((l) => l.id !== id);
  const changes = { 'lines.json': next };
  const pruned = prunePlatforms(stops, next);
  if (pruned) changes['stops.json'] = pruned;
  commitData(changes);
  return line;
}

// ---------- fares ----------

export function getFares() {
  const fares = readData('fares.json');
  return Object.fromEntries(
    Object.entries(MODES).map(([key, m]) => [
      key,
      { label: m.label, operator: m.operator, color: m.color, currency: fares[key]?.currency ?? 'INR', slabs: fares[key]?.slabs ?? [], source: fares[key]?.source ?? null, configured: Boolean(fares[key]) },
    ]),
  );
}

export function updateFares(mode, body) {
  checkMode(mode);
  const fares = readData('fares.json');
  const before = fares[mode] ?? null;
  const after = {
    ...(before ?? {}),
    currency: body.currency ?? before?.currency ?? 'INR',
    slabs: checkSlabs(body.slabs),
  };
  if (body.source !== undefined) after.source = body.source;
  commitData({ 'fares.json': { ...fares, [mode]: after } });
  return { before, after };
}
