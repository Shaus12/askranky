// One-time import of the JSON store into Postgres (run on Render after approval, not from the box):
//   node scripts/import-json-to-pg.js [data/db.json] [--force]     (needs DATABASE_URL; creates the schema first)
import fs from 'node:fs'; import { createPgStore, importJson } from '../src/store-pg.js';
const file = process.argv.slice(2).find(a => !a.startsWith('--')) || 'data/db.json';
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set'); process.exit(1); }
const st = await createPgStore(process.env.DATABASE_URL, { migrateOnStart: true });
try { console.log(`Imported ${file}:`, await importJson(st, JSON.parse(fs.readFileSync(file, 'utf8')), { force: process.argv.includes('--force') })); }
catch (e) { console.error(e.message); process.exitCode = 2; } finally { await st.close(); }
