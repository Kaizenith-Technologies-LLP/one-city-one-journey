import { randomUUID } from 'node:crypto';
import { readStorage, writeStorage } from './store.js';

const FILE = 'audit.json';

/** Records one admin write in the audit log. */
export async function audit(req, action, entity, entityId, details = {}) {
  await writeStorage(FILE, [
    {
      id: randomUUID(),
      at: new Date().toISOString(),
      action,
      entity,
      entityId: entityId ?? null,
      details,
      ip: req?.ip ?? null,
    },
  ]);
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
