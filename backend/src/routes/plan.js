import { Router } from 'express';
import { FARE_SHARE, MODES } from '../config.js';
import { getState } from '../state.js';
import { parseLatLng } from '../utils/geo.js';
import { round } from '../services/network.js';
import { httpError } from '../services/planner.js';
import { revenueReport } from '../services/admin/tickets.js';

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

/** Operator settlement from integrated tickets actually issued (net of refunds). */
router.get('/settlement', (req, res) => {
  const { totals, operators } = revenueReport({ from: req.query.from, to: req.query.to });
  const costWeights = Object.fromEntries(Object.entries(MODES).filter(([, m]) => m.costWeight > 0).map(([k, m]) => [k, m.costWeight]));
  res.json({
    trips: totals.tickets - totals.cancelled,
    multimodalTrips: totals.multiOperator,
    standaloneRevenue: round(operators.reduce((s, o) => s + o.standalone, 0), 2),
    integratedRevenue: totals.net,
    commuterSavings: totals.savings,
    passengerKm: round(operators.reduce((s, o) => s + o.passengerKm, 0), 1),
    rules: {
      integrationDiscountPct: Math.round(FARE_SHARE.integrationDiscount * 100),
      fareWeightPct: Math.round(FARE_SHARE.fareWeight * 100),
      costWeights,
    },
    operators: operators.map((o) => ({
      operator: o.operator,
      operatorName: o.operatorName,
      mode: o.mode,
      trips: o.tickets,
      passengerKm: o.passengerKm,
      standaloneRevenue: o.standalone,
      settledRevenue: o.net,
      revenueSharePct: o.sharePct,
      vsStandalone: round(o.net - o.standalone, 2),
    })),
  });
});

export default router;
