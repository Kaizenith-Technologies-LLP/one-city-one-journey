import { Router } from 'express';
import { getState } from '../state.js';
import { httpError } from '../services/planner.js';

const router = Router();

/** Overlapping stations: stops of different modes grouped into interchange hubs. */
router.get('/hubs', (req, res) => {
  const { hubs } = getState();
  const minModes = Number(req.query.minModes) || 2;
  const mode = req.query.mode;
  res.json(hubs.filter((h) => h.modes.length >= minModes && (!mode || h.modes.includes(mode))));
});

router.get('/hubs/:id', (req, res) => {
  const { hubById, overlaps } = getState();
  const hub = hubById.get(req.params.id);
  if (!hub) throw httpError(404, 'Hub not found');
  res.json({ ...hub, corridorOverlaps: overlaps.filter((o) => o.hubs.includes(hub.id)).map((o) => o.id) });
});

/** Corridor overlaps: line pairs from different operators running through the same consecutive hubs. */
router.get('/overlaps', (_req, res) => {
  const { overlaps, hubById, network } = getState();
  res.json(
    overlaps.map((o) => ({
      ...o,
      lineAName: network.lines.get(o.lineA).name,
      lineBName: network.lines.get(o.lineB).name,
      hubNames: o.hubs.map((id) => hubById.get(id).name),
    })),
  );
});

export default router;
