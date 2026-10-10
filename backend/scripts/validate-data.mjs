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

const stops = load("stops.json");
const lines = load("lines.json");
const fares = load("fares.json");

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
    if (!(line.avgSpeedKmph > 0)) errors.push(`line ${line.id}: avgSpeedKmph must be positive`);
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

  const count = (arr) => MODES.map((m) => `${m}=${arr.filter((x) => x.mode === m).length}`).join(" ");
  console.log(`stops: ${stops.length} (${count(stops)})`);
  console.log(`lines: ${lines.length} (${count(lines)})`);
}

for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
