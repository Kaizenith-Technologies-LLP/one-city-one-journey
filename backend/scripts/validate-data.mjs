import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const MODES = ["metro", "brts", "amts", "gsrtc", "gmcbus"];
const OPERATORS = { metro: "GMRC", brts: "AJL", amts: "AMTS", gsrtc: "GSRTC", gmcbus: "GMC" };
const BBOX = { minLat: 22.90, maxLat: 23.35, minLng: 72.40, maxLng: 72.80 };
const SPACING_KM = { default: [0.2, 4], gsrtc: [0.2, 8] };

const errors = [];
const warnings = [];

function load(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
  } catch (e) {
    errors.push(`${name}: ${e.message}`);
    return null;
  }
}

function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function checkUnique(items, label) {
  const seen = new Set();
  for (const { id } of items) {
    if (seen.has(id)) errors.push(`${label}: duplicate id ${id}`);
    seen.add(id);
  }
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** "HH:MM" (00:00-29:59, for after-midnight service) -> minutes, or null. */
function toMin(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(typeof hhmm === "string" ? hhmm : "");
  if (!m || Number(m[2]) > 59 || Number(m[1]) > 29) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Checks one direction of a schedule; `label` names it in messages. */
function validateDirection(dir, label) {
  const time = (field) => {
    if (dir[field] === undefined) return null;
    const v = toMin(dir[field]);
    if (v == null) errors.push(`${label}: ${field} "${dir[field]}" is not a valid HH:MM time`);
    return v;
  };
  const start = time("serviceStart");
  const end = time("serviceEnd");
  if (start != null && end != null && end < start) errors.push(`${label}: serviceEnd is before serviceStart`);
  if (dir.runTimeMin !== undefined && !(typeof dir.runTimeMin === "number" && dir.runTimeMin > 0)) {
    errors.push(`${label}: runTimeMin must be a positive number`);
  }
  if (dir.bands !== undefined && dir.departures !== undefined) errors.push(`${label}: give either bands or departures, not both`);

  if (dir.bands !== undefined) {
    if (!Array.isArray(dir.bands) || dir.bands.length === 0) errors.push(`${label}: bands must be a non-empty array`);
    const spans = [];
    for (const [i, b] of (Array.isArray(dir.bands) ? dir.bands : []).entries()) {
      const where = `${label}: bands[${i}]`;
      const from = toMin(b.from);
      const to = toMin(b.to);
      if (from == null) errors.push(`${where}: from "${b.from}" is not a valid HH:MM time`);
      if (to == null) errors.push(`${where}: to "${b.to}" is not a valid HH:MM time`);
      if (!(typeof b.headwayMin === "number" && b.headwayMin > 0)) errors.push(`${where}: headwayMin must be a positive number`);
      if (b.days !== undefined && (!Array.isArray(b.days) || b.days.length === 0 || b.days.some((d) => !DAYS.includes(d)))) {
        errors.push(`${where}: days must be a non-empty list of ${DAYS.join("/")}`);
      }
      if (from == null || to == null) continue;
      if (to <= from) errors.push(`${where}: to must be after from`);
      if (start != null && from < start) errors.push(`${where}: starts before serviceStart ${dir.serviceStart}`);
      if (end != null && to > end) errors.push(`${where}: ends after serviceEnd ${dir.serviceEnd}`);
      spans.push({ i, from, to, days: Array.isArray(b.days) ? b.days : DAYS });
    }
    // Bands are half-open [from, to): touching edges are fine, overlaps on a shared day are not.
    for (let a = 0; a < spans.length; a++) {
      for (let c = a + 1; c < spans.length; c++) {
        const x = spans[a];
        const y = spans[c];
        if (x.from < y.to && y.from < x.to && x.days.some((d) => y.days.includes(d))) {
          errors.push(`${label}: bands[${x.i}] and bands[${y.i}] overlap`);
        }
      }
    }
  }

  if (dir.departures !== undefined) {
    if (!Array.isArray(dir.departures) || dir.departures.length === 0) errors.push(`${label}: departures must be a non-empty array`);
    let prev = null;
    for (const t of Array.isArray(dir.departures) ? dir.departures : []) {
      const v = toMin(t);
      if (v == null) {
        errors.push(`${label}: departure "${t}" is not a valid HH:MM time`);
        continue;
      }
      if (prev != null && v <= prev) errors.push(`${label}: departures not in increasing order at ${t}`);
      if ((start != null && v < start) || (end != null && v > end)) errors.push(`${label}: departure ${t} outside service hours`);
      prev = v;
    }
    const first = toMin(dir.departures?.[0]);
    const last = toMin(dir.departures?.[dir.departures.length - 1]);
    if (start != null && first != null && first !== start) warnings.push(`${label}: first departure ${dir.departures[0]} differs from serviceStart`);
    if (end != null && last != null && last !== end) warnings.push(`${label}: last departure ${dir.departures.at(-1)} differs from serviceEnd`);
  }
}

function validateSchedules(schedules, lineIds) {
  if (typeof schedules !== "object" || Array.isArray(schedules)) {
    errors.push("schedules.json: must be an object keyed by line id");
    return;
  }
  for (const [id, s] of Object.entries(schedules)) {
    const label = `schedules.${id}`;
    if (!lineIds.has(id)) errors.push(`${label}: no line with this id in lines.json`);
    if (!s.source) errors.push(`${label}: missing source`);
    validateDirection(s, label);
    if (s.reverse !== undefined) validateDirection(s.reverse, `${label}.reverse`);
    const usable = s.serviceStart && s.serviceEnd && (s.bands || s.departures) && s.runTimeMin;
    if (!usable) warnings.push(`${label}: partial (needs service hours, bands or departures, and runTimeMin to be routable)`);
  }
  for (const id of lineIds) {
    if (!schedules[id]) warnings.push(`schedules.json: no schedule for line ${id}`);
  }
}

const stops = load("stops.json");
const lines = load("lines.json");
const fares = load("fares.json");
const schedules = fs.existsSync(path.join(DATA_DIR, "schedules.json")) ? load("schedules.json") : null;

if (stops && lines && fares) {
  checkUnique(stops, "stops.json");
  checkUnique(lines, "lines.json");

  const stopById = new Map(stops.map((s) => [s.id, s]));
  const usedStops = new Set();

  for (const s of stops) {
    if (!MODES.includes(s.mode)) errors.push(`stop ${s.id}: unknown mode ${s.mode}`);
    if (!s.id.startsWith(`${s.mode}-`)) errors.push(`stop ${s.id}: id does not start with "${s.mode}-"`);
    if (typeof s.approx !== "boolean") errors.push(`stop ${s.id}: approx must be boolean`);
    if (!(s.lat >= BBOX.minLat && s.lat <= BBOX.maxLat && s.lng >= BBOX.minLng && s.lng <= BBOX.maxLng)) {
      errors.push(`stop ${s.id}: (${s.lat}, ${s.lng}) outside bounding box`);
    }
  }

  for (const line of lines) {
    if (!MODES.includes(line.mode)) errors.push(`line ${line.id}: unknown mode ${line.mode}`);
    if (OPERATORS[line.mode] !== line.operator) errors.push(`line ${line.id}: operator ${line.operator} does not match mode ${line.mode}`);
    if (!line.id.startsWith(`${line.mode}-`)) errors.push(`line ${line.id}: id does not start with "${line.mode}-"`);
    if (!Array.isArray(line.stops) || line.stops.length < 2) errors.push(`line ${line.id}: needs at least 2 stops`);
    if (line.avgSpeedKmph !== undefined && !(line.avgSpeedKmph > 0)) errors.push(`line ${line.id}: avgSpeedKmph must be positive when present`);
    if (line.headwayMin !== undefined && !(line.headwayMin > 0)) errors.push(`line ${line.id}: headwayMin must be positive when present`);
    if (!line.source) errors.push(`line ${line.id}: missing source`);

    const [minKm, maxKm] = SPACING_KM[line.mode] ?? SPACING_KM.default;
    let prev = null;
    for (const id of line.stops ?? []) {
      const stop = stopById.get(id);
      if (!stop) {
        errors.push(`line ${line.id}: unknown stop ${id}`);
        prev = null;
        continue;
      }
      usedStops.add(id);
      if (stop.mode !== line.mode) errors.push(`line ${line.id}: stop ${id} has mode ${stop.mode}`);
      if (prev) {
        const km = haversineKm(prev, stop);
        if (km < minKm || km > maxKm) {
          warnings.push(`line ${line.id}: ${prev.id} -> ${id} is ${km.toFixed(2)} km (expected ${minKm}-${maxKm})`);
        }
      }
      prev = stop;
    }
  }

  for (const s of stops) {
    if (!usedStops.has(s.id)) errors.push(`stop ${s.id}: not used by any line`);
  }

  for (const [mode, fare] of Object.entries(fares)) {
    if (!MODES.includes(mode)) errors.push(`fares.${mode}: unknown mode`);
    if (!fare.source) errors.push(`fares.${mode}: missing source`);
    const slabs = fare.slabs ?? [];
    if (slabs.length === 0) errors.push(`fares.${mode}: no slabs`);
    for (let i = 1; i < slabs.length; i++) {
      if (!(slabs[i].uptoKm > slabs[i - 1].uptoKm)) errors.push(`fares.${mode}: slabs not in increasing uptoKm order`);
    }
    if (slabs.length && slabs[slabs.length - 1].uptoKm !== 999) errors.push(`fares.${mode}: last slab must have uptoKm 999`);
  }
  for (const mode of new Set(lines.map((l) => l.mode))) {
    if (!fares[mode]) warnings.push(`fares.json: no fare entry for mode ${mode}`);
  }

  if (schedules) validateSchedules(schedules, new Set(lines.map((l) => l.id)));

  const count = (arr) => MODES.map((m) => `${m}=${arr.filter((x) => x.mode === m).length}`).join(" ");
  console.log(`stops: ${stops.length} (${count(stops)})`);
  console.log(`lines: ${lines.length} (${count(lines)})`);
}

for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
