import { randomInt } from 'node:crypto';
import { MODES } from '../config.js';
import { readData, readStorage, writeStorage } from './admin/store.js';
import { httpError } from './planner.js';

/**
 * Planned closures (diversions): a whole line, a section of a line, or a
 * stop, for a time window. The planner routes around active closures and
 * each closure carries ready-to-send advisories in English, Gujarati and Hindi.
 */

const FILE = 'closures.json';
const TYPES = ['line', 'section', 'stop'];
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const readAll = () => readStorage(FILE, []);

function newId(taken) {
  for (;;) {
    let s = '';
    for (let i = 0; i < 5; i++) s += ID_CHARS[randomInt(ID_CHARS.length)];
    if (!taken.has(`CL-${s}`)) return `CL-${s}`;
  }
}

function check(body) {
  const type = body.type;
  if (!TYPES.includes(type)) throw httpError(400, `type must be one of ${TYPES.join(', ')}`);
  const title = String(body.title ?? '').trim();
  if (!title) throw httpError(400, 'title is required');
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw httpError(400, 'startsAt and endsAt must be ISO date-times');
  if (endsAt <= startsAt) throw httpError(400, 'endsAt must be after startsAt');

  const lines = readData('lines.json');
  const stops = new Set(readData('stops.json').map((s) => s.id));
  const out = { type, title, reason: String(body.reason ?? '').trim(), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };

  if (type === 'stop') {
    if (!stops.has(body.stopId)) throw httpError(400, `Unknown stop: ${body.stopId}`);
    out.stopId = body.stopId;
    return out;
  }
  const line = lines.find((l) => l.id === body.lineId);
  if (!line) throw httpError(400, `Unknown line: ${body.lineId}`);
  out.lineId = line.id;
  if (type === 'section') {
    const a = line.stops.indexOf(body.fromStopId);
    const b = line.stops.indexOf(body.toStopId);
    if (a < 0 || b < 0) throw httpError(400, 'fromStopId and toStopId must both be stops on the line');
    if (a === b) throw httpError(400, 'A section needs two different stops');
    out.fromStopId = body.fromStopId;
    out.toStopId = body.toStopId;
  }
  return out;
}

/** Closures in force at `at`. */
export function activeClosures(at = new Date()) {
  const t = at.getTime();
  return readAll().filter((c) => Date.parse(c.startsAt) <= t && t < Date.parse(c.endsAt));
}

export function listClosures({ status, at = new Date() } = {}) {
  const t = at.getTime();
  const state = (c) => (t < Date.parse(c.startsAt) ? 'upcoming' : t >= Date.parse(c.endsAt) ? 'ended' : 'active');
  return readAll()
    .map((c) => ({ ...c, status: state(c) }))
    .filter((c) => !status || c.status === status)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function createClosure(body) {
  const list = readAll();
  const now = new Date().toISOString();
  const closure = { id: newId(new Set(list.map((c) => c.id))), ...check(body), createdAt: now, updatedAt: now };
  list.push(closure);
  writeStorage(FILE, list);
  return closure;
}

export function updateClosure(id, body) {
  const list = readAll();
  const i = list.findIndex((c) => c.id === id);
  if (i < 0) throw httpError(404, 'Closure not found');
  const before = list[i];
  list[i] = { id, ...check({ ...before, ...body }), createdAt: before.createdAt, updatedAt: new Date().toISOString() };
  writeStorage(FILE, list);
  return { before, after: list[i] };
}

export function deleteClosure(id) {
  const list = readAll();
  const c = list.find((x) => x.id === id);
  if (!c) throw httpError(404, 'Closure not found');
  writeStorage(FILE, list.filter((x) => x.id !== id));
  return c;
}

/** Line ids whose service a closure touches, from the full line list (routable or not). */
export function affectedLineIds(c, lines = readData('lines.json')) {
  if (c.type === 'stop') return lines.filter((l) => l.stops.includes(c.stopId)).map((l) => l.id);
  return [c.lineId];
}

const LABELS = {
  en: { alert: 'Service alert', reason: 'Reason', services: 'Affected services' },
  gu: { alert: 'સેવા સૂચના', reason: 'કારણ', services: 'અસરગ્રસ્ત સેવાઓ' },
  hi: { alert: 'सेवा सूचना', reason: 'कारण', services: 'प्रभावित सेवाएँ' },
};
const LOCALES = { en: 'en-IN', gu: 'gu-IN', hi: 'hi-IN' };

function when(iso, lang) {
  return new Intl.DateTimeFormat(LOCALES[lang], { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

/** Advisory text in English, Gujarati and Hindi, plus one WhatsApp-ready message. */
export function advisory(c) {
  const lines = readData('lines.json');
  const stops = new Map(readData('stops.json').map((s) => [s.id, s]));
  const lineName = (id) => {
    const l = lines.find((x) => x.id === id);
    return l ? `${MODES[l.mode]?.label ?? l.mode} ${l.shortName ?? l.name}` : id;
  };
  const affected = affectedLineIds(c, lines).map(lineName).join(', ');

  const body = (lang) => {
    const s = when(c.startsAt, lang);
    const e = when(c.endsAt, lang);
    const L = LABELS[lang];
    let text;
    if (c.type === 'line') {
      text = {
        en: `${lineName(c.lineId)} will not run from ${s} to ${e}.`,
        gu: `${lineName(c.lineId)} ${s} થી ${e} સુધી બંધ રહેશે.`,
        hi: `${lineName(c.lineId)} ${s} से ${e} तक बंद रहेगी।`,
      }[lang];
    } else if (c.type === 'section') {
      const a = stops.get(c.fromStopId)?.name;
      const b = stops.get(c.toStopId)?.name;
      text = {
        en: `${lineName(c.lineId)} will not run between ${a} and ${b} from ${s} to ${e}.`,
        gu: `${lineName(c.lineId)} ${a} અને ${b} વચ્ચે ${s} થી ${e} સુધી નહીં ચાલે.`,
        hi: `${lineName(c.lineId)} ${a} और ${b} के बीच ${s} से ${e} तक नहीं चलेगी।`,
      }[lang];
    } else {
      const name = stops.get(c.stopId)?.name;
      text = {
        en: `${name} will be closed from ${s} to ${e}. ${L.services}: ${affected}.`,
        gu: `${name} ${s} થી ${e} સુધી બંધ રહેશે. ${L.services}: ${affected}.`,
        hi: `${name} ${s} से ${e} तक बंद रहेगा। ${L.services}: ${affected}।`,
      }[lang];
    }
    return `${L.alert}: ${text}${c.reason ? ` ${L.reason}: ${c.reason}` : ''}`;
  };

  const en = body('en');
  const gu = body('gu');
  const hi = body('hi');
  return { en, gu, hi, whatsapp: `*${c.title}*\n\n${en}\n\n${gu}\n\n${hi}`, affectedLines: affectedLineIds(c, lines) };
}

/** Public summary for clients: active and upcoming closures with advisories. */
export function publicClosures(at = new Date()) {
  return listClosures({ at })
    .filter((c) => c.status !== 'ended')
    .map((c) => ({ id: c.id, type: c.type, title: c.title, status: c.status, startsAt: c.startsAt, endsAt: c.endsAt, ...advisory(c) }));
}
