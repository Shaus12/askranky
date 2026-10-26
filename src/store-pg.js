// Postgres backend for the store (used when DATABASE_URL is set; Neon-compatible: SSL on unless PGSSLMODE=disable or
// the URL says sslmode=disable). Keeps the same in-memory interface as the JSON store: getDb() returns the whole
// document, save() persists it. Each collection is a table of (id text primary key, data jsonb); save() upserts only
// rows whose JSON changed since the last save and deletes removed ones, in one transaction, serialized like the JSON store.
import pg from 'pg';
// Driver: PG_DRIVER=neon|pg. Default: neon for *.neon.tech URLs (@neondatabase/serverless over WebSockets/443, which
// also works where TCP 5432 is blocked), node-postgres otherwise. Both expose the same Pool API.
export const driverFor = url => process.env.PG_DRIVER || (/\.neon\.tech/.test(url) ? 'neon' : 'pg');
export async function poolClass(url) {
  if (driverFor(url) !== 'neon') return pg.Pool;
  const { Pool, neonConfig } = await import('@neondatabase/serverless'); const { default: ws } = await import('ws'); neonConfig.webSocketConstructor = ws; return Pool;
}
export const COLLECTIONS = ['accounts', 'businesses', 'scans'];   // keyed objects
// Collections added after the first release get their table from a migration appended below (version numbers are array indexes).
export const LATE_COLLECTIONS = ['sessions'];
export const LISTS = ['events', 'waitlist'];                       // append-only arrays (row id = index)
export const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  ...COLLECTIONS.map(t => `CREATE TABLE IF NOT EXISTS ${t} (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`),
  ...LISTS.map(t => `CREATE TABLE IF NOT EXISTS ${t} (seq int PRIMARY KEY, data jsonb NOT NULL)`),
  `CREATE TABLE IF NOT EXISTS spend (day text PRIMARY KEY, usd numeric NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS businesses_account_idx ON businesses ((data->>'accountId'))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_idx ON accounts ((lower(data->>'email')))`,
  // 2026-10-26 v2-auth: server-side sessions (id = sha256 of the cookie value; data = { accountId, csrf, via, createdAt, exp }).
  `CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions ((data->>'accountId'))`,
];
const KEYED = [...COLLECTIONS, ...LATE_COLLECTIONS];
export const sslFor = url => /sslmode=disable/.test(url) || process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== '0' };
export async function migrate(client) {
  const has = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations'"); if (!has.rows.length) await client.query(MIGRATIONS[0]);
  const { rows } = await client.query('SELECT coalesce(max(version), 0) AS v FROM schema_migrations');
  for (let i = Number(rows[0].v) + 1; i < MIGRATIONS.length; i++) { await client.query(MIGRATIONS[i]); await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [i]); }
}
export async function createPgStore(url, { Pool, migrateOnStart = process.env.PG_AUTO_MIGRATE !== '0' } = {}) {
  Pool ||= await poolClass(url);
  const pool = new Pool({ connectionString: url, ssl: driverFor(url) === 'neon' ? undefined : sslFor(url), max: Number(process.env.PG_POOL_MAX || 5) });
  const c0 = await pool.connect(); let db; const missing = new Set();
  try {
    if (migrateOnStart) await migrate(c0); db = { accounts: {}, businesses: {}, scans: {}, spend: {}, events: [], waitlist: [], sessions: {} };
    for (const t of COLLECTIONS) for (const r of (await c0.query(`SELECT id, data FROM ${t}`)).rows) db[t][r.id] = r.data;
    // A late table missing (PG_AUTO_MIGRATE=0 and the migration not run yet) must not take the app down: keep it in memory only.
    for (const t of LATE_COLLECTIONS) { try { for (const r of (await c0.query(`SELECT id, data FROM ${t}`)).rows) db[t][r.id] = r.data; } catch { missing.add(t); console.error(`[store] table ${t} missing: run migrations (kept in memory only)`); } }
    for (const t of LISTS) db[t] = (await c0.query(`SELECT data FROM ${t} ORDER BY seq`)).rows.map(r => r.data);
    for (const r of (await c0.query('SELECT day, usd FROM spend')).rows) db.spend[r.day] = Number(r.usd);
  } finally { c0.release(); }
  const seen = {}; const snap = () => { for (const t of KEYED) { db[t] ||= {}; } for (const t of KEYED) { seen[t] = new Map(Object.entries(db[t]).map(([k, v]) => [k, JSON.stringify(v)])); } for (const t of LISTS) seen[t] = db[t].length; seen.spend = JSON.stringify(db.spend); };
  snap();
  async function write() {
    const ops = [];
    for (const t of KEYED) { if (missing.has(t)) continue; db[t] ||= {}; const prev = seen[t]; const cur = new Map(Object.entries(db[t]).map(([k, v]) => [k, JSON.stringify(v)]));
      for (const [k, j] of cur) if (prev.get(k) !== j) ops.push([`INSERT INTO ${t} (id, data, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [k, j]]);
      for (const k of prev.keys()) if (!cur.has(k)) ops.push([`DELETE FROM ${t} WHERE id = $1`, [k]]); }
    for (const t of LISTS) { db[t] ||= []; for (let i = seen[t] ?? 0; i < db[t].length; i++) ops.push([`INSERT INTO ${t} (seq, data) VALUES ($1, $2::jsonb) ON CONFLICT (seq) DO UPDATE SET data = EXCLUDED.data`, [i, JSON.stringify(db[t][i])]]); }
    if (JSON.stringify(db.spend) !== seen.spend) for (const [d, u] of Object.entries(db.spend)) ops.push(['INSERT INTO spend (day, usd) VALUES ($1, $2) ON CONFLICT (day) DO UPDATE SET usd = EXCLUDED.usd', [d, u]]);
    if (!ops.length) return; snap();
    const c = await pool.connect(); try { await c.query('BEGIN'); for (const [sql, p] of ops) await c.query(sql, p); await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }
  let writing = null, pending = false;
  const save = () => { if (writing) { pending = true; return writing; }
    writing = (async () => { try { do { pending = false; await write(); } while (pending); } catch (e) { console.error('[store] postgres save failed:', e.message); throw e; } finally { writing = null; } })(); return writing; };
  return { db: () => db, save, flush: () => writing || Promise.resolve(), reset: async () => { for (const t of [...KEYED.filter(x => !missing.has(x)), ...LISTS, 'spend']) await pool.query(`TRUNCATE ${t}`); db = { accounts: {}, businesses: {}, scans: {}, spend: {}, events: [], waitlist: [], sessions: {} }; snap(); }, close: () => pool.end() };
}
// Merge a JSON-store document into a (normally empty) Postgres store; used by scripts/import-json-to-pg.js.
export async function importJson(st, src, { force = false } = {}) {
  const db = st.db(); if (!force && (Object.keys(db.accounts).length || Object.keys(db.scans).length)) throw Object.assign(new Error('Target database is not empty; pass --force to merge.'), { code: 'NOT_EMPTY' });
  for (const k of ['accounts', 'businesses', 'scans', 'spend']) Object.assign(db[k], src[k] || {});
  for (const k of ['events', 'waitlist']) db[k].push(...(src[k] || []));
  await st.save(); return Object.fromEntries(['accounts', 'businesses', 'scans', 'events', 'waitlist'].map(k => [k, (Array.isArray(db[k]) ? db[k] : Object.keys(db[k])).length]));
}
