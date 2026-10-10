import { Router } from 'express';
import { MODES } from '../config.js';
import { getState } from '../state.js';
import { stopSummary, lineSummary } from '../services/network.js';
import { haversine, parseLatLng } from '../utils/geo.js';
import { normaliseName } from '../services/overlap.js';
import { httpError } from '../services/planner.js';

const router = Router();

router.get('/meta', (_req, res) => {
  const { network, hubs, overlaps } = getState();
  const stops = [...network.stops.values()];
  const lines = [...network.lines.values()];
  const modes = Object.entries(MODES)
    .filter(([key]) => stops.some((s) => s.mode === key))
    .map(([key, m]) => ({
      key,
      label: m.label,
      operator: m.operator,
      operatorName: m.operatorName,
      color: m.color,
      stops: stops.filter((s) => s.mode === key).length,
      lines: lines.filter((l) => l.mode === key).length,
    }));
  res.json({
    region: 'Ahmedabad + Gandhinagar',
    modes,
    counts: { stops: stops.length, lines: lines.length, hubs: hubs.length, corridorOverlaps: overlaps.length },
    unroutableLines: network.unroutable,
    bounds: {
      south: Math.min(...stops.map((s) => s.lat)),
      west: Math.min(...stops.map((s) => s.lng)),
      north: Math.max(...stops.map((s) => s.lat)),
      east: Math.max(...stops.map((s) => s.lng)),
    },
  });
});

router.get('/stops', (req, res) => {
  const { network, stopToHub } = getState();
  const q = normaliseName(String(req.query.q ?? ''));
  const mode = req.query.mode;
  const limit = Math.min(Number(req.query.limit) || 20, 1000);
  let list = [...network.stops.values()];
  if (mode) list = list.filter((s) => s.mode === mode);
  if (q) {
    list = list
      .map((s) => {
        const n = normaliseName(s.name);
        const score = n === q ? 0 : n.startsWith(q) ? 1 : n.split(' ').some((w) => w.startsWith(q)) ? 2 : n.includes(q) ? 3 : 9;
        return { s, score };
      })
      .filter((x) => x.score < 9)
      .sort((a, b) => a.score - b.score || a.s.name.localeCompare(b.s.name))
      .map((x) => x.s);
  } else {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  res.json(list.slice(0, limit).map((s) => ({ ...stopSummary(s), hubId: stopToHub.get(s.id) ?? null })));
});

router.get('/stops/nearest', (req, res) => {
  const { network, stopToHub } = getState();
  const p = parseLatLng(`${req.query.lat},${req.query.lng}`);
  if (!p) throw httpError(400, 'lat and lng are required');
  const limit = Math.min(Number(req.query.limit) || 5, 50);
  const list = [...network.stops.values()]
    .map((s) => ({ ...stopSummary(s), hubId: stopToHub.get(s.id) ?? null, distanceM: Math.round(haversine(p, s)) }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
  res.json(list);
});

router.get('/stops/:id', (req, res) => {
  const { network, stopToHub } = getState();
  const s = network.stops.get(req.params.id);
  if (!s) throw httpError(404, 'Stop not found');
  res.json({ ...stopSummary(s), hubId: stopToHub.get(s.id) ?? null });
});

router.get('/lines', (req, res) => {
  const { network } = getState();
  const withGeometry = req.query.geometry === '1' || req.query.geometry === 'true';
  res.json([...network.lines.values()].map((l) => lineSummary(l, network.stops, withGeometry)));
});

router.get('/lines/:id', (req, res) => {
  const { network } = getState();
  const line = network.lines.get(req.params.id);
  if (!line) throw httpError(404, 'Line not found');
  res.json(lineSummary(line, network.stops, true));
});

export default router;
