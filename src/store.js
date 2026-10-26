// Store: Postgres when DATABASE_URL is set in production (src/store-pg.js), else a JSON file (local dev + tests; tests use a temp DATA_DIR).
// Writes are atomic (write temp file in same dir, fsync, rename over target) and serialized
// (one write at a time; saves requested during a write coalesce into one follow-up write).
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { dataPath } from './paths.js';
const FILE = process.env.DB_FILE || dataPath('db.json');
const empty = () => ({ accounts: {}, businesses: {}, scans: {}, spend: {}, events: [], sessions: {} });
// Postgres needs DATABASE_URL plus NODE_ENV=production or STORE=postgres, so a dev box that merely has DATABASE_URL in its
// env keeps using the JSON file (and never migrates the real DB). STORE=json / FORCE_JSON_STORE=1 always force JSON.
export const wantsPostgres = (env = process.env) => !!env.DATABASE_URL && !env.FORCE_JSON_STORE && env.STORE !== 'json' && (env.STORE === 'postgres' || env.NODE_ENV === 'production');
const PG = wantsPostgres() ? await (await import('./store-pg.js')).createPgStore(process.env.DATABASE_URL) : null;
export const BACKEND = PG ? 'postgres' : 'json';
let db = PG ? PG.db() : fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : empty();
let writing = null, pending = false;
function writeAtomic() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, JSON.stringify(db, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { fs.renameSync(tmp, FILE); } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
}
// Synchronous snapshot is taken at call time; returns a promise that resolves when it is on disk.
export const save = () => {
  if (PG) return PG.save();
  if (writing) { pending = true; return writing; }
  writing = (async () => { try { do { pending = false; writeAtomic(); await null; } while (pending); } finally { writing = null; } })();
  return writing;
};
export const flush = () => PG ? PG.flush() : writing || Promise.resolve();
export const id = (n = 10) => crypto.randomBytes(n).toString('base64url').slice(0, n);
export const getDb = () => { const d = PG ? PG.db() : db; d.sessions ||= {}; return d; };
export const reset = () => { if (PG) return PG.reset(); db = empty(); return save(); };
export const close = () => PG?.close();
export const DB_FILE = FILE;
