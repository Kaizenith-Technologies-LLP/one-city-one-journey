import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MODES } from '../config.js';
import { haversine } from '../utils/geo.js';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');

function readJson(name) {
  const file = path.join(DATA_DIR, name);
  if (!existsSync(file)) throw new Error(`Missing data file: ${file}`);
  return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
}

/**
 * Loads stops, lines and fares, and derives the per-stop line index and
 * per-segment distances used everywhere else.
 */
export function loadNetwork() {
  const stopList = readJson('stops.json');
  const lineList = readJson('lines.json');
  const fares = readJson('fares.json');

  const stops = new Map(stopList.map((s) => [s.id, { ...s, lines: [] }]));
  const lines = new Map();

  for (const raw of lineList) {
    if (raw.active === false) continue; // suspended by an admin: not routable
    const mode = MODES[raw.mode];
    if (!mode) throw new Error(`Line ${raw.id} has unknown mode ${raw.mode}`);
    const stopIds = raw.stops.filter((id) => stops.has(id));
    // Cumulative distance along the line, so any ride's km is a subtraction.
    const cumKm = [0];
    for (let i = 1; i < stopIds.length; i++) {
      const d = haversine(stops.get(stopIds[i - 1]), stops.get(stopIds[i])) / 1000;
      cumKm.push(cumKm[i - 1] + d);
    }
    const line = {
      ...raw,
      stops: stopIds,
      cumKm,
      lengthKm: cumKm[cumKm.length - 1],
      operator: raw.operator ?? mode.operator,
      color: raw.color ?? mode.color,
      avgSpeedKmph: raw.avgSpeedKmph ?? mode.defaultSpeedKmph,
      headwayMin: raw.headwayMin ?? mode.defaultHeadwayMin,
    };
    lines.set(line.id, line);
    stopIds.forEach((id, idx) => stops.get(id).lines.push({ lineId: line.id, idx }));
  }

  return { stops, lines, fares };
}

export function stopSummary(stop) {
  return {
    id: stop.id,
    name: stop.name,
    mode: stop.mode,
    lat: stop.lat,
    lng: stop.lng,
    approx: Boolean(stop.approx),
    lines: stop.lines.map((l) => l.lineId),
  };
}

export function lineSummary(line, stops, withGeometry = false) {
  const out = {
    id: line.id,
    name: line.name,
    shortName: line.shortName ?? line.name,
    mode: line.mode,
    operator: line.operator,
    color: line.color,
    headwayMin: line.headwayMin,
    avgSpeedKmph: line.avgSpeedKmph,
    lengthKm: round(line.lengthKm, 2),
    stopCount: line.stops.length,
    from: stops.get(line.stops[0])?.name,
    to: stops.get(line.stops[line.stops.length - 1])?.name,
  };
  if (withGeometry) {
    out.stops = line.stops.map((id) => {
      const s = stops.get(id);
      return { id, name: s.name, lat: s.lat, lng: s.lng };
    });
  }
  return out;
}

export const round = (n, dp = 0) => Math.round(n * 10 ** dp) / 10 ** dp;
