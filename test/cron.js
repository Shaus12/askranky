// External cron trigger: POST /api/internal/cron/sync (X-Cron-Secret / CRON_SECRET), GET /healthz, docs example workflow, idempotent sync.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('cron');
for (const k of ['CRON_SECRET', 'ADMIN_TEST_TOKEN', 'PRELAUNCH']) delete process.env[k]; process.env.CRON_FAIL_MAX = '12';
const { default: app, cronHooks } = await import('../server.js'); const { syncAll } = await import('../src/jobs/billing-sync.js'); const { getDb } = await import('../src/store.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; (typeof orig === 'undefined' ? console : orig).log('  ✓', m); };
const URL_ = B + '/api/internal/cron/sync'; const SECRET = 'cron-secret-0123456789abcdef-XYZ'; const SUMIT_DATA = 'SUMIT-PRIVATE-DATA-777';
const post = (h = {}) => fetch(URL_, { method: 'POST', headers: h }); const logs = []; const orig = { log: console.log, warn: console.warn, error: console.error };
for (const k of Object.keys(orig)) console[k] = (...a) => { logs.push(a.join(' ')); };
const real = cronHooks.sync; let calls = 0;
try {
  // disabled when CRON_SECRET is unset or too short
  cronHooks.sync = async () => { calls++; return {}; };
  assert.equal((await post({ 'X-Cron-Secret': SECRET })).status, 404); process.env.CRON_SECRET = 'short'; assert.equal((await post({ 'X-Cron-Secret': 'short' })).status, 404); assert.equal(calls, 0); ok('CRON_SECRET unset or < 16 chars -> endpoint disabled (404), sync never runs');
  // auth
  process.env.CRON_SECRET = SECRET;
  for (const h of [{}, { 'X-Cron-Secret': '' }, { 'X-Cron-Secret': 'wrong' }, { 'X-Cron-Secret': SECRET + 'x' }, { 'X-Cron-Secret': SECRET.slice(0, -1) }, { 'X-Admin-Test-Token': SECRET }]) assert.equal((await post(h)).status, 401);
  assert.equal(calls, 0); assert.equal((await fetch(URL_)).status === 404, true); ok('missing/wrong/short/long secret -> 401, other headers (admin token) rejected, GET -> 404, sync never runs');
  process.env.ADMIN_TEST_TOKEN = 'adm-0123456789abcdef'; assert.equal((await post({ 'X-Cron-Secret': 'adm-0123456789abcdef' })).status, 401); delete process.env.ADMIN_TEST_TOKEN; ok('ADMIN_TEST_TOKEN is not accepted');
  // success: minimal JSON
  let r = await post({ 'X-Cron-Secret': SECRET }); assert.equal(r.status, 200); let j = await r.json(); assert.deepEqual(Object.keys(j).sort(), ['ok', 'ranAt']); assert.equal(j.ok, true); assert.ok(!Number.isNaN(Date.parse(j.ranAt))); assert.equal(calls, 1);
  assert.equal(r.headers.get('cache-control'), 'no-store'); ok('right secret -> 200 {ok:true, ranAt} only (sync stubbed)');
  // works with Turnstile enforcement on (not behind the CAPTCHA)
  process.env.TURNSTILE_SECRET_KEY = 'ts-sk'; process.env.TURNSTILE_SITE_KEY = 'ts-pk'; assert.equal((await post({ 'X-Cron-Secret': SECRET })).status, 200); delete process.env.TURNSTILE_SECRET_KEY; delete process.env.TURNSTILE_SITE_KEY; ok('not behind CAPTCHA (works with Turnstile keys set, no token)');
  // concurrency lock
  let release; const gate = new Promise(res => { release = res; }); calls = 0; cronHooks.sync = async () => { calls++; await gate; return {}; };
  const first = post({ 'X-Cron-Secret': SECRET }); await new Promise(res => setTimeout(res, 100)); const second = await post({ 'X-Cron-Secret': SECRET }); assert.equal(second.status, 202); assert.deepEqual(await second.json(), { ok: true, running: true }); assert.equal(calls, 1);
  release(); assert.equal((await first).status, 200); assert.equal((await post({ 'X-Cron-Secret': SECRET })).status, 200); assert.equal(calls, 2); ok('concurrent run is collapsed (202 running:true, sync called once); lock is released afterwards');
  // failure: 500 {ok:false}, nothing leaked, lock released
  cronHooks.sync = async () => { throw new Error(`SUMIT said ${SUMIT_DATA} ${SECRET}`); }; r = await post({ 'X-Cron-Secret': SECRET }); assert.equal(r.status, 500); const body = await r.text(); assert.deepEqual(JSON.parse(body), { ok: false });
  cronHooks.sync = async () => ({ secretish: SUMIT_DATA }); r = await post({ 'X-Cron-Secret': SECRET }); assert.equal(r.status, 200); assert.ok(!(await r.text()).includes(SUMIT_DATA)); ok('failure -> 500 {ok:false}; sync result data is never returned; lock released after failure');
  // wrong-secret rate limit
  let st = []; for (let i = 0; i < 15; i++) st.push((await post({ 'X-Cron-Secret': 'bad' + i })).status); assert.ok(st.includes(429)); assert.deepEqual(st.slice(0, 2), [401, 401]); ok('repeated wrong secrets get rate limited (429)');
  // no secrets in logs
  const all = logs.join('\n'); assert.ok(!all.includes(SECRET)); assert.ok(!all.includes(SUMIT_DATA)); assert.ok(all.includes('[cron] billing sync done')); assert.ok(all.includes('[cron] billing sync failed')); ok('logs contain neither the secret nor sync/SUMIT data');
  // /healthz
  r = await fetch(B + '/healthz'); assert.equal(r.status, 200); assert.equal(await r.text(), '{"ok":true}'); assert.equal(r.headers.get('cache-control'), 'no-store'); ok('/healthz -> {"ok":true}');
  // real syncAll is idempotent (renewal, failed-payment email, downgrade)
  cronHooks.sync = real; const db = getDb(); const now = new Date('2026-11-10T04:00:00Z'); const past = '2026-11-05T00:00:00.000Z';
  db.accounts.A1 = { id: 'A1', email: 'a1@t.test', plan: 'starter', status: 'active', subscriptionRef: 's1', paidThrough: past, billing: { amount: 79, currency: 'ILS' }, lang: 'en' };
  db.accounts.A2 = { id: 'A2', email: 'a2@t.test', plan: 'starter', status: 'active', subscriptionRef: 's2', paidThrough: past, billing: { amount: 79, currency: 'ILS' }, lang: 'en' };
  const pay = { sync: async a => ({ active: a.id === 'A1' }) }; const mails = () => fs.existsSync(TD.outbox) ? fs.readdirSync(TD.outbox).length : 0;
  const r1 = await syncAll({ payments: pay, now }); const m1 = mails(); const pt1 = db.accounts.A1.paidThrough; const r2 = await syncAll({ payments: pay, now: new Date(now.getTime() + 3600e3) }); const m2 = mails();
  assert.equal(r1.renewed, 1); assert.equal(r2.renewed, 0); assert.equal(db.accounts.A1.paidThrough, pt1); assert.equal(r1.pastDue, 1); assert.equal(r2.pastDue, 1); assert.equal(m2, m1, 'second run sends no extra emails'); assert.equal(db.accounts.A2.status, 'past_due');
  const later = await syncAll({ payments: pay, now: new Date('2026-11-20T04:00:00Z') }); assert.equal(db.accounts.A2.plan, 'free'); const again = await syncAll({ payments: pay, now: new Date('2026-11-21T04:00:00Z') }); assert.equal(again.downgraded, 0); assert.equal(later.downgraded, 1);
  ok('syncAll is idempotent: repeat run does not renew twice, re-send the failed-payment email, or re-downgrade; a later run catches up (7-day grace from first detection)');
  // workflow + docs
  assert.ok(!fs.existsSync('.github/workflows/cron.yml'), 'no workflow file (PAT lacks workflow scope)'); const wf = fs.readFileSync('docs/cron.yml.example', 'utf8'); for (const s of ["cron: '7 4 * * *'", "cron: '*/10 * * * *'", 'workflow_dispatch', '--fail', '--max-time 90', '--retry 3', '--retry-delay 20', 'X-Cron-Secret: $CRON_SECRET', 'secrets.CRON_SECRET', '/api/internal/cron/sync', '/healthz', 'https://askranky.com', '-X POST']) assert.ok(wf.includes(s), s);
  assert.ok(!/echo[^\n]*CRON_SECRET/.test(wf.replace(/echo "::error::Repository secret CRON_SECRET is not set"/, '')), 'workflow must not echo the secret'); assert.ok(!/set -x|--verbose|\s-v\s/.test(wf));
  const go = fs.readFileSync('GO-LIVE.md', 'utf8'), rd = fs.readFileSync('README.md', 'utf8'); for (const s of ['openssl rand -hex 32', 'Settings → Secrets and variables → Actions → New repository secret', 'cron-job.org', '60 days', 'docs/cron.yml.example', 'X-Cron-Secret', 'Retry on failure', 'idempotent', 'catches up', 'CRON_SECRET', '/healthz', 'timeout 60 s']) assert.ok(go.includes(s), s); assert.match(rd, /External cron/);
  ok('cron-job.org docs + example workflow in docs/ only (daily sync + */10 keep-warm, curl --fail --max-time 90 --retry 3 --retry-delay 20, secret from repo secrets, never echoed) and docs present');
  Object.assign(console, orig); console.log(`ALL CRON TESTS PASSED (${n})`);
} finally { Object.assign(console, orig); cronHooks.sync = real; srv.close(); TD.done(); }
process.exit(0);
