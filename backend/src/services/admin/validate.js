import { MODES } from '../../config.js';
import { httpError } from '../planner.js';

// Ahmedabad + Gandhinagar service area.
export const BOUNDS = { minLat: 22.9, maxLat: 23.35, minLng: 72.4, maxLng: 72.8 };

const bad = (msg) => httpError(400, msg);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function slugify(text) {
  return String(text).toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

export function uniqueId(base, taken) {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function checkMode(mode) {
  if (!MODES[mode]) throw bad(`Unknown mode "${mode}". Expected one of: ${Object.keys(MODES).join(', ')}`);
}

export function checkId(id) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) throw bad('id must be letters, digits, "-" or "_"');
}

/** Normalises and validates a full stop record. */
export function checkStop(s) {
  checkId(s.id);
  if (typeof s.name !== 'string' || !s.name.trim()) throw bad('name is required');
  checkMode(s.mode);
  const lat = Number(s.lat);
  const lng = Number(s.lng);
  if (!isNum(lat) || !isNum(lng)) throw bad('lat and lng must be numbers');
  if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lng < BOUNDS.minLng || lng > BOUNDS.maxLng) {
    throw bad(`Location outside service area (lat ${BOUNDS.minLat}-${BOUNDS.maxLat}, lng ${BOUNDS.minLng}-${BOUNDS.maxLng})`);
  }
  const out = { id: s.id, name: s.name.trim(), mode: s.mode, lat, lng };
  if (s.approx) out.approx = true;
  if (Array.isArray(s.platforms) && s.platforms.length) out.platforms = s.platforms;
  // Keep any other source fields (e.g. code, source) untouched.
  for (const [k, v] of Object.entries(s)) if (!(k in out) && !['approx', 'platforms', 'lines', 'hubId'].includes(k)) out[k] = v;
  return out;
}

export function checkPlatform(p, lineIdsAtStop) {
  checkId(p.id);
  if (typeof p.name !== 'string' || !p.name.trim()) throw bad('Platform name is required');
  const lineIds = Array.isArray(p.lineIds) ? [...new Set(p.lineIds.map(String))] : [];
  const stray = lineIds.filter((id) => !lineIdsAtStop.has(id));
  if (stray.length) throw bad(`Lines do not serve this stop: ${stray.join(', ')}`);
  return {
    id: p.id,
    name: p.name.trim(),
    lineIds,
    direction: typeof p.direction === 'string' ? p.direction.trim() : '',
    accessible: Boolean(p.accessible),
  };
}

/** Normalises and validates a full line record against the current stop ids. */
export function checkLine(l, stopIds) {
  checkId(l.id);
  if (typeof l.name !== 'string' || !l.name.trim()) throw bad('name is required');
  checkMode(l.mode);
  if (!Array.isArray(l.stops) || l.stops.length < 2) throw bad('A line needs at least 2 stops');
  const missing = l.stops.filter((id) => !stopIds.has(id));
  if (missing.length) throw bad(`Unknown stops: ${missing.join(', ')}`);
  if (l.stops.some((id, i) => i && l.stops[i - 1] === id)) throw bad('The same stop appears twice in a row');
  if (l.color != null && !/^#[0-9a-f]{6}$/i.test(l.color)) throw bad('color must be a hex colour like #1E5BC6');
  const speed = l.avgSpeedKmph == null ? undefined : Number(l.avgSpeedKmph);
  const headway = l.headwayMin == null ? undefined : Number(l.headwayMin);
  if (speed !== undefined && !(speed >= 5 && speed <= 120)) throw bad('avgSpeedKmph must be 5-120');
  if (headway !== undefined && !(headway >= 1 && headway <= 240)) throw bad('headwayMin must be 1-240');

  const mode = MODES[l.mode];
  const out = {
    id: l.id,
    name: l.name.trim(),
    shortName: (l.shortName ?? '').toString().trim() || l.name.trim(),
    mode: l.mode,
    operator: l.operator || mode.operator,
    color: l.color || mode.color,
    stops: l.stops,
  };
  // Left unset when unknown; the line then stays out of routing until both are entered.
  if (speed !== undefined) out.avgSpeedKmph = speed;
  if (headway !== undefined) out.headwayMin = headway;
  if (l.source) out.source = l.source;
  if (l.active === false) {
    out.active = false;
    if (l.suspendedReason) out.suspendedReason = String(l.suspendedReason);
    out.suspendedAt = l.suspendedAt ?? new Date().toISOString();
  }
  return out;
}

/** Slabs must have rising uptoKm, non-negative fares, and end at 999 km. */
export function checkSlabs(slabs) {
  if (!Array.isArray(slabs) || !slabs.length) throw bad('At least one fare slab is required');
  const out = slabs.map((s, i) => {
    const uptoKm = Number(s.uptoKm);
    const fare = Number(s.fare);
    if (!isNum(uptoKm) || uptoKm <= 0) throw bad(`Slab ${i + 1}: uptoKm must be a positive number`);
    if (!isNum(fare) || fare < 0) throw bad(`Slab ${i + 1}: fare must be 0 or more`);
    return { uptoKm, fare };
  });
  out.forEach((s, i) => {
    if (i && s.uptoKm <= out[i - 1].uptoKm) throw bad(`Slab ${i + 1}: uptoKm must be greater than ${out[i - 1].uptoKm}`);
  });
  if (out[out.length - 1].uptoKm !== 999) throw bad('The last slab must have uptoKm 999 (catch-all)');
  return out;
}

export function checkSettings(s) {
  const out = {};
  if (s.integrationDiscount !== undefined) {
    const v = Number(s.integrationDiscount);
    if (!(v >= 0 && v <= 0.5)) throw bad('integrationDiscount must be between 0 and 0.5');
    out.integrationDiscount = v;
  }
  if (s.fareWeight !== undefined) {
    const v = Number(s.fareWeight);
    if (!(v >= 0 && v <= 1)) throw bad('fareWeight must be between 0 and 1');
    out.fareWeight = v;
  }
  if (s.costWeights !== undefined) {
    out.costWeights = {};
    for (const [mode, w] of Object.entries(s.costWeights ?? {})) {
      checkMode(mode);
      const v = Number(w);
      if (!(v > 0 && v <= 5)) throw bad(`costWeight for ${mode} must be > 0 and <= 5`);
      out.costWeights[mode] = v;
    }
  }
  return out;
}
