import { Router } from 'express';
import { getState } from '../state.js';
import { parseLatLng } from '../utils/geo.js';
import { httpError } from '../services/planner.js';
import { simulateSettlement } from '../services/settlement.js';

const router = Router();

/** An endpoint is a stop id ("metro-paldi") or a coordinate ("23.02,72.57"). */
function parseEndpoint(value, name, label) {
  if (!value) throw httpError(400, `${label} is required (stop id or "lat,lng")`);
  const p = parseLatLng(String(value));
  return p ? { point: p, name } : { stopId: String(value) };
}

router.get('/plan', (req, res) => {
  const { planner } = getState();
  const from = parseEndpoint(req.query.from, req.query.fromName, 'from');
  const to = parseEndpoint(req.query.to, req.query.toName, 'to');
  const result = planner.plan(from, to);
  const sort = req.query.sort;
  if (sort && ['totalMin', 'fare', 'walkM', 'transfers'].includes(sort)) {
    result.options.sort((a, b) => a[sort] - b[sort] || a.totalMin - b.totalMin);
  }
  res.json(result);
});

router.get('/settlement', (req, res) => {
  const state = getState();
  const trips = Math.min(Math.max(Number(req.query.trips) || 300, 10), 2000);
  const seed = Number(req.query.seed) || 42;
  const key = `${trips}:${seed}`;
  if (!state.settlementCache.has(key)) {
    state.settlementCache.set(key, simulateSettlement(state.network, state.planner, { trips, seed }));
  }
  res.json(state.settlementCache.get(key));
});

export default router;
