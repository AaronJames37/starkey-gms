import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const collections = ['customers', 'vehicles', 'jobs', 'products', 'suppliers', 'reminders', 'invoices', 'activity'];
let localDb, pool, initialisation;
let queue = Promise.resolve();
export const hosted = Boolean(process.env.VERCEL || process.env.REQUIRE_AUTH === 'true' || process.env.DATABASE_URL);
export const designPreview = hosted && !process.env.DATABASE_URL;

export async function getPool() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('Hosted database is not configured.'), { status: 503 });
  if (!pool) {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, allowExitOnIdle: true });
    pool.on('error', () => console.error('A database connection closed unexpectedly.'));
  }
  return pool;
}

async function initialise() {
  if (process.env.DATABASE_URL) {
    const db = await getPool();
    await db.query('CREATE TABLE IF NOT EXISTS gms_workspace (id INTEGER PRIMARY KEY CHECK (id = 1), payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  } else {
    if (hosted) throw Object.assign(new Error('Hosted database is not configured.'), { status: 503 });
    const { DatabaseSync } = await import('node:sqlite');
    const directory = resolve(process.env.DATA_DIR || 'data');
    mkdirSync(directory, { recursive: true });
    localDb = new DatabaseSync(join(directory, 'workshop.sqlite'));
    localDb.exec('PRAGMA journal_mode=WAL;');
    for (const name of collections) localDb.exec(`CREATE TABLE IF NOT EXISTS ${name} (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)))`);
    localDb.exec('CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)))');
  }
}
async function ready() {
  initialisation ||= initialise().catch(e => { initialisation = undefined; throw e; });
  return initialisation;
}
function localRead() {
  const settings = localDb.prepare("SELECT data FROM settings WHERE id = 'main'").get();
  if (!settings) return null;
  const s = { settings: JSON.parse(settings.data) };
  for (const name of collections) s[name] = localDb.prepare(`SELECT data FROM ${name} ORDER BY rowid`).all().map(r => JSON.parse(r.data));
  return s;
}
function localWrite(s) {
  for (const name of collections) {
    localDb.exec(`DELETE FROM ${name}`);
    const insert = localDb.prepare(`INSERT INTO ${name}(id,data) VALUES (?,?)`);
    for (const row of s[name]) insert.run(row.id, JSON.stringify(row));
  }
  localDb.prepare("INSERT OR REPLACE INTO settings(id,data) VALUES ('main',?)").run(JSON.stringify(s.settings));
}
function serialise(work) {
  const pending = queue.then(work, work);
  queue = pending.catch(() => {});
  return pending;
}
export async function transaction(seed, change) {
  await ready();
  if (!process.env.DATABASE_URL) return serialise(async () => {
    localDb.exec('BEGIN IMMEDIATE');
    try {
      const state = localRead() || seed();
      const result = await change(state);
      localWrite(state); localDb.exec('COMMIT');
      return { result, state };
    } catch (e) { localDb.exec('ROLLBACK'); throw e; }
  });
  const client = await (await getPool()).connect();
  try {
    await client.query('BEGIN');
    // Also serialises first-time initialisation across separate function instances.
    await client.query('SELECT pg_advisory_xact_lock(734230119)');
    const row = await client.query('SELECT payload FROM gms_workspace WHERE id = 1 FOR UPDATE');
    const state = row.rows[0]?.payload || seed();
    const result = await change(state);
    await client.query('INSERT INTO gms_workspace(id,payload) VALUES (1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=NOW()', [JSON.stringify(state)]);
    await client.query('COMMIT');
    return { result, state };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
export async function read(seed) {
  await ready();
  if (!process.env.DATABASE_URL) return serialise(() => {
    const found = localRead();
    if (found) return found;
    const s = seed(); localDb.exec('BEGIN IMMEDIATE');
    try { localWrite(s); localDb.exec('COMMIT'); return s; } catch (e) { localDb.exec('ROLLBACK'); throw e; }
  });
  const found = await (await getPool()).query('SELECT payload FROM gms_workspace WHERE id = 1');
  return found.rows[0]?.payload || (await transaction(seed, () => undefined)).state;
}
export async function closeStorage() { if (localDb) localDb.close(); if (pool) await pool.end(); }

