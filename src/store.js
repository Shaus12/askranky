// Tiny JSON-file store (swap for Postgres in production).
// Writes are atomic (write temp file in same dir, fsync, rename over target) and serialized
// (one write at a time; saves requested during a write coalesce into one follow-up write).
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { dataPath } from './paths.js';
const FILE = process.env.DB_FILE || dataPath('db.json');
const empty = () => ({ accounts: {}, businesses: {}, scans: {}, spend: {}, events: [] });
let db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : empty();
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
  if (writing) { pending = true; return writing; }
  writing = (async () => { try { do { pending = false; writeAtomic(); await null; } while (pending); } finally { writing = null; } })();
  return writing;
};
export const flush = () => writing || Promise.resolve();
export const id = (n = 10) => crypto.randomBytes(n).toString('base64url').slice(0, n);
export const getDb = () => db;
export const reset = () => { db = empty(); return save(); };
export const DB_FILE = FILE;
