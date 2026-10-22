// Read-only connectivity check against DATABASE_URL: SELECT 1 + server version + whether the schema exists. Never
// creates, migrates or writes anything, and never prints the URL.
import { poolClass, driverFor } from '../src/store-pg.js';
const url = process.env.DATABASE_URL; if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const Pool = await poolClass(url); const pool = new Pool({ connectionString: url });
try {
  const one = await pool.query('SELECT 1 AS ok'); const v = await pool.query('SELECT version() AS v');
  const t = await pool.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('schema_migrations','accounts','businesses','scans','events','waitlist','spend')");
  console.log(JSON.stringify({ ok: one.rows[0].ok === 1, driver: driverFor(url), server: String(v.rows[0].v).split(' on ')[0], rankyTablesPresent: t.rows[0].n }));
} catch (e) { console.error('DB check failed:', String(e.message).replaceAll(url, '[DATABASE_URL]')); process.exitCode = 2; } finally { await pool.end(); }
