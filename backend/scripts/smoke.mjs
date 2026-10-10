// Exercises the whole pipeline without HTTP: load -> hubs -> overlaps -> plan -> settlement.
// Usage: node scripts/smoke.mjs [fromStopId] [toStopId]
import { initState } from '../src/state.js';
import { simulateSettlement } from '../src/services/settlement.js';

const { state, loadError } = initState();
if (!state) {
  console.error('Load failed:', loadError);
  process.exit(1);
}
const { network, hubs, overlaps, planner } = state;
console.log(`stops=${network.stops.size} lines=${network.lines.size} hubs=${hubs.length} overlaps=${overlaps.length}`);
for (const h of hubs.slice(0, 15)) {
  console.log(`  ${h.id} ${h.name} [${h.modes.join('+')}] lines=${h.lineCount} maxWalk=${h.maxWalkM}m`);
}
for (const o of overlaps.slice(0, 8)) console.log(`  ${o.id} ${o.lineA} x ${o.lineB}: ${o.sharedHubCount} hubs, ${o.lengthKm} km`);

const stopIds = [...network.stops.keys()];
const from = process.argv[2] ?? stopIds[0];
const to = process.argv[3] ?? stopIds[stopIds.length - 1];
const t0 = performance.now();
const result = planner.plan({ stopId: from }, { stopId: to });
console.log(`\nplan ${from} -> ${to}: ${result.options.length} options in ${(performance.now() - t0).toFixed(0)} ms`);
for (const o of result.options) {
  console.log(`  ${o.id} [${o.tags.join(',')}] ${o.totalMin} min, Rs ${o.fare} (standalone ${o.standaloneFare}), walk ${o.walkM} m, transfers ${o.transfers}`);
  for (const l of o.legs) console.log(`     - ${l.instruction}`);
  console.log(`     split: ${o.fareSplit.shares.map((s) => `${s.operator} Rs ${s.amount}`).join(', ')}`);
}

const t1 = performance.now();
const st = simulateSettlement(network, planner, { trips: 100 });
console.log(`\nsettlement (100 trips, ${(performance.now() - t1).toFixed(0)} ms): revenue Rs ${st.integratedRevenue}, savings Rs ${st.commuterSavings}`);
for (const o of st.operators) console.log(`  ${o.operator}: Rs ${o.settledRevenue} (${o.revenueSharePct}%), vs standalone ${o.vsStandalone}`);
