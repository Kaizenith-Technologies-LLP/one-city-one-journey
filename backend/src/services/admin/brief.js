import { MODES } from '../../config.js';
import { getState } from '../../state.js';
import { round } from '../network.js';
import { listAudit } from './audit.js';
import { revenueReport, todayKey } from './tickets.js';
import { listClosures, affectedLineIds } from '../closures.js';
import { readData } from './store.js';
import { weatherOnDay } from '../weather.js';

/**
 * One-page management brief for a day: per-operator tickets, revenue and
 * passenger-km against the previous 7 days, the exceptions worth a look,
 * and the recorded events (closures, suspensions, fare changes, weather)
 * that may explain them. Built only from issued tickets, the audit log,
 * closures and observed weather.
 */

const CHANGE_FLAG = 0.25; // a ±25% move against the 7-day average is flagged
const MIN_BASELINE_TICKETS = 5; // ignore swings on tiny volumes
const RAIN_MM = 7.5; // IMD "moderate rain" lower bound (daily)
const HEAT_C = 40; // IMD heatwave threshold over the plains

const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const istDay = (iso) => new Date(Date.parse(iso) + 330 * 60e3).toISOString().slice(0, 10);
const pct = (now, base) => (base ? round(((now - base) / base) * 100, 1) : null);

export async function morningBrief(date = addDays(todayKey(), -1)) {
  const day = revenueReport({ from: date, to: date });
  const prior = [];
  for (let i = 1; i <= 7; i++) prior.push(revenueReport({ from: addDays(date, -i), to: addDays(date, -i) }));

  const lines = readData('lines.json');
  const operatorOf = new Map(lines.map((l) => [l.id, l.operator ?? MODES[l.mode]?.operator]));
  const operators = new Set([...day.operators, ...prior.flatMap((p) => p.operators)].map((o) => o.operator));

  const perOperator = [...operators].map((op) => {
    const today = day.operators.find((o) => o.operator === op);
    const avg = (key) => prior.reduce((s, p) => s + (p.operators.find((o) => o.operator === op)?.[key] ?? 0), 0) / 7;
    const meta = today ?? prior.flatMap((p) => p.operators).find((o) => o.operator === op);
    return {
      operator: op,
      operatorName: meta.operatorName,
      mode: meta.mode,
      tickets: today?.tickets ?? 0,
      revenue: today?.net ?? 0,
      passengerKm: today?.passengerKm ?? 0,
      avgTickets: round(avg('tickets'), 1),
      avgRevenue: round(avg('net'), 2),
      ticketsChangePct: pct(today?.tickets ?? 0, avg('tickets')),
      revenueChangePct: pct(today?.net ?? 0, avg('net')),
    };
  });

  // Recorded events on the day that can explain a change.
  const audit = listAudit({ limit: 5000 }).items.filter((e) => istDay(e.at) === date);
  const closures = listClosures().filter((c) => istDay(c.startsAt) <= date && date <= istDay(c.endsAt));
  const weather = await weatherOnDay(date);

  const causesFor = (op) => {
    const causes = [];
    for (const c of closures) {
      if (affectedLineIds(c, lines).some((id) => operatorOf.get(id) === op)) causes.push(`Closure: ${c.title}`);
    }
    for (const e of audit) {
      if (e.entity === 'line' && e.action === 'suspend' && operatorOf.get(e.entityId) === op) causes.push(`Line ${e.entityId} suspended${e.details?.reason ? ` (${e.details.reason})` : ''}`);
      if (e.entity === 'fares' && MODES[e.entityId]?.operator === op) causes.push(`${MODES[e.entityId].label} fares changed`);
    }
    if (weather?.precipMm >= RAIN_MM) causes.push(`Rain: ${weather.precipMm} mm`);
    if (weather?.maxFeelsLikeC >= HEAT_C) causes.push(`Heat: feels-like up to ${weather.maxFeelsLikeC} °C`);
    return causes;
  };

  const exceptions = [];
  for (const o of perOperator) {
    if (o.avgTickets < MIN_BASELINE_TICKETS || o.revenueChangePct == null) continue;
    if (Math.abs(o.revenueChangePct) >= CHANGE_FLAG * 100) {
      const drop = o.revenueChangePct < 0;
      exceptions.push({
        severity: drop ? 'high' : 'info',
        title: `${o.operatorName} revenue ${drop ? 'down' : 'up'} ${Math.abs(o.revenueChangePct)}% vs 7-day average`,
        detail: `₹${o.revenue} from ${o.tickets} tickets, against an average of ₹${o.avgRevenue} from ${o.avgTickets}.`,
        possibleCauses: causesFor(o.operator),
      });
    }
  }
  const avgCancelled = prior.reduce((s, p) => s + p.totals.cancelled, 0) / 7;
  if (day.totals.cancelled >= 3 && day.totals.cancelled > 2 * avgCancelled) {
    exceptions.push({
      severity: 'medium',
      title: `${day.totals.cancelled} tickets cancelled (7-day average ${round(avgCancelled, 1)})`,
      detail: `₹${day.totals.refunds} refunded.`,
      possibleCauses: closures.map((c) => `Closure: ${c.title}`),
    });
  }
  for (const c of closures) {
    exceptions.push({ severity: 'medium', title: `Service disruption: ${c.title}`, detail: c.reason || 'No reason recorded.', possibleCauses: [] });
  }
  for (const e of audit.filter((x) => x.entity === 'line' && x.action === 'suspend')) {
    exceptions.push({ severity: 'medium', title: `Line ${e.entityId} suspended`, detail: e.details?.reason ?? 'No reason recorded.', possibleCauses: [] });
  }
  const { network } = getState();
  if (network.unroutable.length) {
    exceptions.push({
      severity: 'info',
      title: `${network.unroutable.length} lines not in journey planning`,
      detail: 'Missing sourced schedule or fare data; add it in the admin portal to include them.',
      possibleCauses: [],
    });
  }

  const order = { high: 0, medium: 1, info: 2 };
  exceptions.sort((a, b) => order[a.severity] - order[b.severity]);

  const prevTickets = prior.reduce((s, p) => s + p.totals.tickets, 0) / 7;
  const prevNet = prior.reduce((s, p) => s + p.totals.net, 0) / 7;
  return {
    date,
    generatedAt: new Date().toISOString(),
    headline:
      day.totals.tickets === 0
        ? 'No tickets were issued on this day.'
        : `${day.totals.tickets} integrated tickets, ₹${day.totals.net} net revenue (${pct(day.totals.net, prevNet) ?? 'no'}% vs 7-day average), ${day.totals.multiOperator} journeys across operators.`,
    totals: { ...day.totals, avgTickets: round(prevTickets, 1), avgNet: round(prevNet, 2) },
    operators: perOperator.sort((a, b) => b.revenue - a.revenue),
    exceptions,
    weather,
    events: {
      closures: closures.map((c) => ({ id: c.id, title: c.title, type: c.type, startsAt: c.startsAt, endsAt: c.endsAt })),
      adminChanges: audit.filter((e) => ['line', 'fares', 'settings', 'stop'].includes(e.entity)).map((e) => ({ at: e.at, action: e.action, entity: e.entity, entityId: e.entityId })),
    },
  };
}
