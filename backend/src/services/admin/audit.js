import { randomUUID } from 'node:crypto';
import { readStorage, writeStorage } from './store.js';

const FILE = 'audit.json';
const MAX_ENTRIES = 5000;

/** Appends one admin write to storage/audit.json (newest last, capped). */
export function audit(req, action, entity, entityId, details = {}) {
  const log = readStorage(FILE, []);
  log.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    action,
    entity,
    entityId: entityId ?? null,
    details,
    ip: req?.ip ?? null,
  });
  writeStorage(FILE, log.slice(-MAX_ENTRIES));
}

export function listAudit({ entity, action, q, limit = 200, offset = 0 } = {}) {
  let log = readStorage(FILE, []).slice().reverse();
  if (entity) log = log.filter((e) => e.entity === entity);
  if (action) log = log.filter((e) => e.action === action);
  if (q) {
    const needle = q.toLowerCase();
    log = log.filter((e) => JSON.stringify(e).toLowerCase().includes(needle));
  }
  return { total: log.length, items: log.slice(offset, offset + limit) };
}
