import pg from 'pg';

/**
 * PostgreSQL connection (Railway Postgres in production). DATABASE_URL is
 * required; add `?sslmode=no-verify` when connecting through a public proxy.
 */
export const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

const SCHEMA = `
create table if not exists network_docs (
  name        text primary key,
  data        jsonb not null,
  seed_hash   text,
  updated_at  timestamptz not null default now()
);
create table if not exists tickets (
  id           text primary key,
  status       text not null,
  created_at   timestamptz not null,
  valid_until  timestamptz,
  data         jsonb not null
);
create index if not exists tickets_created_at_idx on tickets (created_at);
create index if not exists tickets_status_idx on tickets (status);
create table if not exists closures (
  id         text primary key,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  data       jsonb not null
);
create table if not exists audit_log (
  id         text primary key,
  at         timestamptz not null,
  entity     text not null,
  action     text not null,
  entity_id  text,
  data       jsonb not null
);
create index if not exists audit_log_at_idx on audit_log (at);
create table if not exists settings (
  key         text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
`;

export async function migrate() {
  if (!pool) throw new Error('DATABASE_URL is not set');
  await pool.query(SCHEMA);
}

/** Runs `fn(client)` in a transaction. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
