import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { STORAGE_DIR } from '../../config.js';
import { pool, migrate, tx } from '../../db.js';
import { initState } from '../../state.js';
import { httpError } from '../planner.js';

/**
 * PostgreSQL-backed store with an in-memory copy for reads.
 *
 * - Network data (stops, lines, fares, schedules) lives in `network_docs`.
 *   It is seeded from data/*.json, and re-seeded whenever a repository file
 *   changes, so committed data updates win over earlier admin edits.
 * - Tickets, closures and the audit log are rows; settings is one row.
 * Every write goes to the database first; the memory copy is updated only
 * after the write succeeds.
 */

// Seed files shipped with the code.
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data');

const NETWORK = ['stops.json', 'lines.json', 'fares.json', 'schedules.json'];

const COLLECTIONS = {
  'tickets.json': { table: 'tickets', order: 'created_at', cols: (t) => ({ status: t.status, created_at: t.createdAt, valid_until: t.validUntil }) },
  'closures.json': { table: 'closures', order: 'starts_at', cols: (c) => ({ starts_at: c.startsAt, ends_at: c.endsAt }) },
  'audit.json': { table: 'audit_log', order: 'at', cols: (e) => ({ at: e.at, entity: e.entity, action: e.action, entity_id: e.entityId }) },
};

const cache = new Map();

const readSeed = (dir, name) => {
  const file = path.join(dir, name);
  return existsSync(file) ? readFileSync(file, 'utf8').replace(/^﻿/, '') : null;
};

export function networkDocs() {
  return {
    stops: cache.get('stops.json'),
    lines: cache.get('lines.json'),
    fares: cache.get('fares.json'),
    schedules: cache.get('schedules.json') ?? {},
  };
}

/** Creates tables, seeds or refreshes network data, imports legacy JSON storage once, and loads everything into memory. */
export async function initStorage() {
  await migrate();

  for (const name of NETWORK) {
    const text = readSeed(DATA_DIR, name);
    if (text == null) continue;
    const hash = createHash('sha256').update(text).digest('hex');
    const { rows } = await pool.query('select seed_hash from network_docs where name = $1', [name]);
    if (rows[0]?.seed_hash !== hash) {
      await pool.query(
        `insert into network_docs (name, data, seed_hash, updated_at) values ($1, $2, $3, now())
         on conflict (name) do update set data = excluded.data, seed_hash = excluded.seed_hash, updated_at = now()`,
        [name, text, hash],
      );
      console.log(`Seeded ${name} from repository data`);
    }
  }
  for (const r of (await pool.query('select name, data from network_docs')).rows) cache.set(r.name, r.data);

  for (const [name, c] of Object.entries(COLLECTIONS)) {
    const { rows } = await pool.query(`select count(*)::int as n from ${c.table}`);
    const legacy = rows[0].n === 0 ? readSeed(STORAGE_DIR, name) : null;
    if (legacy) {
      const items = JSON.parse(legacy);
      await tx(async (client) => {
        for (const item of items) await upsert(client, c, item);
      });
      console.log(`Imported ${items.length} records from ${name}`);
    }
    cache.set(name, (await pool.query(`select data from ${c.table} order by ${c.order}`)).rows.map((r) => r.data));
  }

  const settings = await pool.query(`select data from settings where key = 'fare-sharing'`);
  if (!settings.rows.length) {
    const legacy = readSeed(STORAGE_DIR, 'settings.json');
    if (legacy) {
      await pool.query(`insert into settings (key, data) values ('fare-sharing', $1)`, [legacy]);
      console.log('Imported fare-sharing settings');
    }
  }
  cache.set('settings.json', (await pool.query(`select data from settings where key = 'fare-sharing'`)).rows[0]?.data ?? {});
}

function upsert(client, c, item) {
  const cols = c.cols(item);
  const names = ['id', 'data', ...Object.keys(cols)];
  const values = [item.id, JSON.stringify(item), ...Object.values(cols)];
  const set = names.slice(1).map((n) => `${n} = excluded.${n}`).join(', ');
  return client.query(
    `insert into ${c.table} (${names.join(', ')}) values (${names.map((_, i) => `$${i + 1}`).join(', ')}) on conflict (id) do update set ${set}`,
    values,
  );
}

export function readData(name) {
  if (!cache.has(name)) throw httpError(503, `Network data ${name} is not loaded`);
  return cache.get(name);
}

export const readStorage = (name, fallback) => (cache.has(name) ? cache.get(name) : fallback);

/**
 * Persists `value` for a storage name. For collections, records that are new
 * or changed (by id) are upserted; nothing is deleted (see deleteStorage).
 */
export async function writeStorage(name, value) {
  if (name === 'settings.json') {
    await pool.query(
      `insert into settings (key, data, updated_at) values ('fare-sharing', $1, now())
       on conflict (key) do update set data = excluded.data, updated_at = now()`,
      [JSON.stringify(value)],
    );
    cache.set(name, value);
    return;
  }
  const c = COLLECTIONS[name];
  if (!c) throw new Error(`Unknown storage ${name}`);
  const current = new Map((cache.get(name) ?? []).map((x) => [x.id, x]));
  const changed = value.filter((x) => JSON.stringify(current.get(x.id)) !== JSON.stringify(x));
  if (!changed.length) return;
  await tx(async (client) => {
    for (const item of changed) await upsert(client, c, item);
  });
  // Merge into the latest cache, so a concurrent write is never dropped.
  const merged = new Map((cache.get(name) ?? []).map((x) => [x.id, x]));
  for (const item of changed) merged.set(item.id, item);
  cache.set(name, [...merged.values()]);
}

export async function deleteStorage(name, id) {
  const c = COLLECTIONS[name];
  await pool.query(`delete from ${c.table} where id = $1`, [id]);
  cache.set(name, (cache.get(name) ?? []).filter((x) => x.id !== id));
}

/**
 * Applies network changes: rebuilds the live state with them, saves them in
 * one transaction, and rolls the memory copy back if either step fails.
 */
export async function commitData(changes) {
  const previous = new Map(Object.keys(changes).map((name) => [name, cache.get(name)]));
  const restore = () => {
    for (const [name, value] of previous) cache.set(name, value);
    initState(networkDocs());
  };
  for (const [name, value] of Object.entries(changes)) cache.set(name, value);
  const { loadError } = initState(networkDocs());
  if (loadError) {
    restore();
    throw httpError(400, `Rejected: data would not load (${loadError.message})`);
  }
  try {
    await tx(async (client) => {
      for (const [name, value] of Object.entries(changes)) {
        await client.query(
          `insert into network_docs (name, data, updated_at) values ($1, $2, now())
           on conflict (name) do update set data = excluded.data, updated_at = now()`,
          [name, JSON.stringify(value)],
        );
      }
    });
  } catch (err) {
    restore();
    throw err;
  }
}
