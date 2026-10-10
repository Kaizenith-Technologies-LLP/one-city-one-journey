import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { MODES } from '../../config.js';
import { getState } from '../../state.js';
import { parseLatLng } from '../../utils/geo.js';
import { round } from '../network.js';
import { httpError } from '../planner.js';
import { readStorage, writeStorage } from './store.js';

const FILE = 'tickets.json';
const VALID_HOURS = 3;
// QR signing key. Without TICKET_SECRET a per-process key is used, so QR codes stop verifying after a restart.
const SECRET = process.env.TICKET_SECRET || randomBytes(32).toString('hex');
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

const readAll = () => readStorage(FILE, []);
const writeAll = (list) => writeStorage(FILE, list);

function newId(taken) {
  for (;;) {
    let s = '';
    for (let i = 0; i < 6; i++) s += ID_CHARS[randomInt(ID_CHARS.length)];
    if (!taken.has(`OJ-${s}`)) return `OJ-${s}`;
  }
}

const sign = (text) => createHmac('sha256', SECRET).update(text).digest('base64url').slice(0, 16);

/** Compact, signed string a QR code can carry; validators check the signature offline. */
function qrPayload(t) {
  const body = ['OJ1', t.id, t.from.stopId ?? `${t.from.lat},${t.from.lng}`, t.to.stopId ?? `${t.to.lat},${t.to.lng}`, t.fare, Math.floor(Date.parse(t.validUntil) / 1000)].join('|');
  return `${body}|${sign(body)}`;
}

export function verifyQr(payload) {
  const parts = String(payload ?? '').trim().split('|');
  if (parts.length !== 7 || parts[0] !== 'OJ1') throw httpError(400, 'Not a One Journey ticket QR');
  const body = parts.slice(0, 6).join('|');
  if (sign(body) !== parts[6]) throw httpError(400, 'QR signature is invalid');
  return parts[1];
}

/** Active tickets past validUntil read as expired; storage keeps the raw status. */
function view(t, now = Date.now()) {
  return t.status === 'active' && Date.parse(t.validUntil) < now ? { ...t, status: 'expired' } : t;
}

function endpoint(value, name, label) {
  if (!value) throw httpError(400, `${label} is required (stop id or "lat,lng")`);
  const p = parseLatLng(String(value));
  return p ? { point: p, name } : { stopId: String(value) };
}

/**
 * Re-plans on the server so the fare cannot be tampered with, picks the
 * requested option (by signature, then id, else fastest), and issues a ticket.
 */
export function issueTicket(body, { now = new Date(), channel = 'app' } = {}) {
  const { planner } = getState();
  const from = endpoint(body.from, body.fromName, 'from');
  const to = endpoint(body.to, body.toName, 'to');
  const { options, from: fromPoint, to: toPoint } = planner.plan(from, to);
  if (!options.length) throw httpError(404, 'No transit option found for this trip');
  const opt =
    (body.signature && options.find((o) => o.signature === body.signature)) ||
    (body.optionId && options.find((o) => o.id === body.optionId)) ||
    options.find((o) => o.tags.includes('fastest')) ||
    options[0];
  if (body.optionId && !body.signature && opt.id !== body.optionId) throw httpError(404, `Option ${body.optionId} not found`);

  const list = readAll();
  const createdAt = now.toISOString();
  const ticket = {
    id: newId(new Set(list.map((t) => t.id))),
    status: 'active',
    channel,
    from: fromPoint,
    to: toPoint,
    optionId: opt.id,
    signature: opt.signature,
    tags: opt.tags,
    fare: opt.fare,
    standaloneFare: opt.standaloneFare,
    savings: opt.fareSplit.savings,
    discountPct: opt.fareSplit.discountPct,
    currency: 'INR',
    totalMin: opt.totalMin,
    distanceKm: opt.distanceKm,
    transfers: opt.transfers,
    modes: opt.modes,
    operators: opt.operators,
    split: opt.fareSplit.shares.map(({ operator, operatorName, mode, km, sharePct, amount }) => ({ operator, operatorName, mode, km, sharePct, amount })),
    splitMethod: opt.fareSplit.method,
    legs: opt.legs
      .filter((l) => l.type === 'ride')
      .map((l) => ({ mode: l.mode, operator: l.operator, lineId: l.lineId, line: l.lineShortName, lineName: l.lineName, color: l.color, from: l.from.name, fromStopId: l.from.stopId, to: l.to.name, toStopId: l.to.stopId, stops: l.stopCount, distanceKm: l.distanceKm })),
    createdAt,
    validUntil: new Date(now.getTime() + VALID_HOURS * 3600e3).toISOString(),
    usedAt: null,
    cancelledAt: null,
    refundAmount: null,
  };
  ticket.qr = qrPayload(ticket);
  list.push(ticket);
  writeAll(list);
  return ticket;
}

export function getTicket(id) {
  const t = readAll().find((x) => x.id === String(id).toUpperCase());
  if (!t) throw httpError(404, 'Ticket not found');
  return view(t);
}

function dayKey(iso) {
  // Calendar day in IST, which is what operators settle on.
  return new Date(Date.parse(iso) + 330 * 60e3).toISOString().slice(0, 10);
}

export function todayKey() {
  return dayKey(new Date().toISOString());
}

export function listTickets({ status, operator, mode, date, from, to, q, limit = 100, offset = 0 } = {}) {
  let list = readAll().map((t) => view(t)).reverse();
  if (status) list = list.filter((t) => t.status === status);
  if (operator) list = list.filter((t) => t.operators.includes(operator));
  if (mode) list = list.filter((t) => t.modes.includes(mode));
  if (date) list = list.filter((t) => dayKey(t.createdAt) === date);
  if (from) list = list.filter((t) => dayKey(t.createdAt) >= from);
  if (to) list = list.filter((t) => dayKey(t.createdAt) <= to);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((t) => t.id.toLowerCase().includes(needle) || t.from.name?.toLowerCase().includes(needle) || t.to.name?.toLowerCase().includes(needle));
  }
  return { total: list.length, items: list.slice(offset, offset + limit) };
}

function transition(id, fn) {
  const list = readAll();
  const i = list.findIndex((x) => x.id === String(id).toUpperCase());
  if (i < 0) throw httpError(404, 'Ticket not found');
  const before = view(list[i]);
  list[i] = { ...list[i], ...fn(before) };
  writeAll(list);
  return { before, after: view(list[i]) };
}

/** Marks a ticket used (inspector scan / gate). Only active, unexpired tickets. */
export function validateTicket(id, { by = 'admin' } = {}) {
  return transition(id, (t) => {
    if (t.status !== 'active') throw httpError(409, `Ticket is ${t.status}, cannot validate`);
    return { status: 'used', usedAt: new Date().toISOString(), validatedBy: by };
  });
}

/** Cancels an unused ticket with a full refund (simulated). */
export function cancelTicket(id, { reason = '', refundAmount } = {}) {
  return transition(id, (t) => {
    if (t.status === 'used') throw httpError(409, 'Ticket already used, cannot cancel');
    if (t.status === 'cancelled') throw httpError(409, 'Ticket already cancelled');
    const refund = refundAmount == null ? t.fare : Math.min(t.fare, Math.max(0, Number(refundAmount) || 0));
    return { status: 'cancelled', cancelledAt: new Date().toISOString(), refundAmount: refund, cancelReason: String(reason) };
  });
}

/**
 * Revenue per operator from issued tickets' fare splits. Cancelled tickets
 * count only for the part not refunded, spread over operators pro rata.
 */
export function revenueReport({ from, to } = {}) {
  const list = readAll()
    .map((t) => view(t))
    .filter((t) => (!from || dayKey(t.createdAt) >= from) && (!to || dayKey(t.createdAt) <= to));
  const ops = new Map();
  const days = new Map();
  const totals = { tickets: list.length, active: 0, used: 0, cancelled: 0, expired: 0, gross: 0, refunds: 0, net: 0, savings: 0, multiOperator: 0 };

  for (const t of list) {
    totals[t.status]++;
    totals.gross += t.fare;
    totals.savings += t.savings ?? 0;
    if (t.operators.length >= 2) totals.multiOperator++;
    const refund = t.status === 'cancelled' ? t.refundAmount ?? t.fare : 0;
    totals.refunds += refund;
    const keep = t.fare ? (t.fare - refund) / t.fare : 0;
    const day = dayKey(t.createdAt);
    const d = days.get(day) ?? { date: day, tickets: 0, revenue: 0 };
    d.tickets++;
    d.revenue += t.fare - refund;
    days.set(day, d);
    for (const s of t.split) {
      const o = ops.get(s.operator) ?? { operator: s.operator, operatorName: s.operatorName, mode: s.mode, color: MODES[s.mode]?.color, tickets: 0, passengerKm: 0, gross: 0, net: 0 };
      o.tickets++;
      o.passengerKm += s.km;
      o.gross += s.amount;
      o.net += s.amount * keep;
      ops.set(s.operator, o);
    }
  }
  totals.net = totals.gross - totals.refunds;
  const net = totals.net || 1;
  return {
    from: from ?? null,
    to: to ?? null,
    totals: { ...totals, gross: round(totals.gross, 2), refunds: round(totals.refunds, 2), net: round(totals.net, 2) },
    operators: [...ops.values()]
      .map((o) => ({ ...o, passengerKm: round(o.passengerKm, 1), gross: round(o.gross, 2), net: round(o.net, 2), sharePct: round((o.net / net) * 100, 1) }))
      .sort((a, b) => b.net - a.net),
    daily: [...days.values()].map((d) => ({ ...d, revenue: round(d.revenue, 2) })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
