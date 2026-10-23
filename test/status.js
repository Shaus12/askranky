// Ops status endpoint: GET /api/internal/status (X-Status-Token / STATUS_TOKEN). 404 indistinguishable from an unknown route when disabled or unauthenticated,
// 200 aggregate JSON (no PII, no-store), timing-safe compare, per-IP limiter, both store modes (JSON file and Postgres via pg-mem), never throws.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import crypto from 'node:crypto'; import { newDb } from 'pg-mem'; import { useTempData } from './helpers.js'; const TD = useTempData('status');
for (const k of ['STATUS_TOKEN', 'CRON_SECRET', 'ADMIN_TEST_TOKEN', 'PRELAUNCH', 'EMAIL_MODE', 'RESEND_API_KEY']) delete process.env[k]; process.env.STATUS_FAIL_MAX = '6'; process.env.DAILY_SPEND_CAP_USD = '10'; process.env.SCAN_MODE = 'live'; delete process.env.NODE_ENV;
const { default: app, statusFailLimiter, cronHooks } = await import('../server.js'); const { getDb } = await import('../src/store.js'); const S = await import('../src/status.js'); const { checkConfig } = await import('../src/config-check.js'); const { robotsTxt, sitemapXml } = await import('../src/seo.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; (typeof orig === 'undefined' ? console : orig).log('  ✓', m); };
const TOKEN = 'st-0123456789abcdef-0123456789-XYZ'; const URL_ = B + '/api/internal/status';
const get = (h = {}, p = '/api/internal/status') => fetch(B + p, { headers: h }); const hdrs = r => Object.fromEntries([...r.headers].filter(([k]) => ['content-type', 'cache-control', 'x-robots-tag', 'content-length', 'vary', 'x-content-type-options'].includes(k)));
const logs = []; const orig = { log: console.log, warn: console.warn, error: console.error }; const rawLog = orig.log;
const DAY = 864e5, nowD = Date.now(), iso = ms => new Date(nowD - ms).toISOString(), today = new Date().toISOString().slice(0, 10), day = ms => new Date(nowD - ms).toISOString().slice(0, 10);
// ---- seed (fake data with PII-looking values that must never appear in the response) ----
const PII = ['pii.owner@secret-mail.test', 'pii.second@secret-mail.test', 'Secret Bakery Tel Aviv', 'Hidden Dentist Haifa', 'Rivka Cohen', 'SCANID_SECRET_001', 'SCANID_SECRET_002', 'ACCID_SECRET_01', 'BIZID_SECRET_01', 'SUMIT-REF-98765', 'sumit-doc-4455667'];
const db = getDb();
const acc = (id, o) => { db.accounts[id] = { id, key: 'KEY_SECRET_' + id, email: `${id.toLowerCase()}@secret-mail.test`, name: 'Rivka Cohen', createdAt: iso(5 * DAY), usage: {}, ...o }; };
acc('ACCID_SECRET_01', { email: PII[0], plan: 'starter', status: 'active', subscriptionRef: 'SUMIT-REF-98765', billing: { currency: 'ILS', amount: 79 }, createdAt: iso(2 * 3600e3) });
acc('ACCID_SECRET_02', { email: PII[1], plan: 'pro', status: 'active', subscriptionRef: 'r2', billing: { currency: 'ILS', amount: 179 } });
acc('ACCID_SECRET_03', { plan: 'agency', subscriptionRef: 'r3' }); // no status/billing: counts as active at list price 549
acc('ACCID_SECRET_04', { plan: 'starter', status: 'past_due', subscriptionRef: 'r4', pastDueSince: iso(2 * DAY), failedNoticeAt: iso(2 * DAY) });
acc('ACCID_SECRET_05', { plan: 'starter', status: 'past_due', subscriptionRef: 'r5', pastDueSince: iso(9 * DAY) }); // past_due but beyond grace
acc('ACCID_SECRET_06', { plan: 'starter', status: 'cancelled', subscriptionRef: 'r6', paidThrough: iso(-5 * DAY) });
acc('ACCID_SECRET_07', { plan: 'free', createdAt: iso(40 * DAY) }); acc('ACCID_SECRET_08', { plan: 'free', createdAt: iso(60e3) });
acc('ACCID_SECRET_09', { plan: 'pro', status: 'active', subscriptionRef: 'r9', testSubscription: true, billing: { currency: 'ILS', amount: 1 } }); // test subscription: excluded everywhere
db.businesses.BIZID_SECRET_01 = { id: 'BIZID_SECRET_01', name: 'Secret Bakery Tel Aviv', accountId: 'ACCID_SECRET_01', city: 'Tel Aviv' };
db.scans.SCANID_SECRET_001 = { id: 'SCANID_SECRET_001', businessId: 'BIZID_SECRET_01', accountId: 'ACCID_SECRET_01', at: iso(3600e3), mock: false, summary: { engines: { ran: ['chatgpt', 'gemini'], skipped: [] }, errors: 1, clarifyingAnswers: 2, byEngine: {} }, results: [{ answer: 'Hidden Dentist Haifa' }] };
db.scans.SCANID_SECRET_002 = { id: 'SCANID_SECRET_002', businessId: 'BIZID_SECRET_01', accountId: 'ACCID_SECRET_02', at: iso(3 * DAY), mock: true, summary: { byEngine: { chatgpt: {} }, errors: 5 }, results: [] }; // old scan without engines.ran: falls back to byEngine keys
db.spend[today] = 8.5; db.spend[day(DAY)] = 3.25; db.spend[day(30 * DAY)] = 99;
db.events.push({ at: iso(3 * 3600e3), type: 'billing.payment_failed', account: 'ACCID_SECRET_04' }, { at: iso(5 * DAY), type: 'billing.payment_failed', account: 'ACCID_SECRET_05' }, { at: iso(20 * DAY), type: 'billing.payment_failed', account: 'x' },
  { at: iso(7200e3), type: 'spend.alert', pct: 0.85 }, { at: iso(3600e3), type: 'spend.alert', pct: 0.9 }, { at: iso(1800e3), type: 'spend.capped', cap: 10, spent: 9.99 }, { at: iso(40 * 3600e3), type: 'spend.capped' },
  { at: iso(4 * 3600e3), type: 'billing.sync', checked: 5, errors: 1 }, { at: iso(4 * 3600e3 - 1000), type: 'billing.sync_error', account: 'ACCID_SECRET_01', error: 'SUMIT 500 for pii.owner@secret-mail.test card 4111111111111111 token abcdefghijklmnopqrstuvwxyz0123456789 ' + 'x'.repeat(300) });
const noSecrets = (text, what) => { for (const p of [...PII, TOKEN, 'KEY_SECRET', 'secret-mail', '127.0.0.1', 'Secret Bakery', 'Rivka', '4111111111111111', 'abcdefghijklmnopqrstuvwxyz0123456789']) assert.ok(!text.includes(p), `${what} leaks ${p}`); };
const shapeKeys = j => { assert.deepEqual(Object.keys(j), ['ok', 'generatedAt', 'dayBasis', 'sync', 'scans', 'spend', 'signups', 'subscribers', 'payments', 'config']);
  assert.deepEqual(Object.keys(j.sync), ['lastRunAt', 'lastOk', 'lastError', 'running']); assert.deepEqual(Object.keys(j.scans), ['today', 'last24h', 'total', 'liveLast24h', 'byEngine', 'errorsLast24h', 'clarifyingAnswersLast24h']);
  assert.deepEqual(Object.keys(j.spend), ['todayUsd', 'capUsd', 'pctOfCap', 'last7Days', 'estimated', 'cappedEventsLast24h', 'alertState', 'resetsAt', 'resetsAtAsiaJerusalem', 'resetBasis']); assert.deepEqual(Object.keys(j.spend.alertState), ['threshold', 'reached', 'capReached', 'lastAlertLoggedAt']);
  assert.deepEqual(Object.keys(j.signups), ['today', 'last24h', 'total']); assert.deepEqual(Object.keys(j.subscribers), ['paying', 'byPlan', 'mrrIls', 'trialOrFree', 'cancelledInPeriod']); assert.deepEqual(Object.keys(j.payments), ['failuresLast24h', 'failuresLast7d', 'pastDue', 'graceActive']);
  assert.deepEqual(Object.keys(j.config), ['paymentsProvider', 'scanMode', 'emailMode', 'prelaunch']); };
const check = (j) => { // numbers derived from the seed above
  shapeKeys(j); assert.equal(j.ok, true); assert.ok(Math.abs(Date.parse(j.generatedAt) - Date.now()) < 5000); assert.equal(j.dayBasis, 'UTC');
  assert.equal(j.scans.total, 2); assert.equal(j.scans.last24h, 1); assert.equal(j.scans.liveLast24h, 1); assert.equal(j.scans.errorsLast24h, 1); assert.equal(j.scans.clarifyingAnswersLast24h, 2); assert.deepEqual(j.scans.byEngine, { chatgpt: { last24h: 1, total: 2 }, gemini: { last24h: 1, total: 1 } });
  assert.equal(j.spend.todayUsd, 8.5); assert.equal(j.spend.capUsd, 10); assert.equal(j.spend.pctOfCap, 85); assert.equal(j.spend.last7Days.length, 7); assert.equal(j.spend.last7Days[6].day, today); assert.equal(j.spend.last7Days[6].usd, 8.5); assert.equal(j.spend.last7Days[5].usd, 3.25); assert.ok(!j.spend.last7Days.some(d => d.usd === 99));
  assert.equal(j.spend.cappedEventsLast24h, 1); assert.deepEqual(j.spend.alertState, { threshold: 0.8, reached: true, capReached: false, lastAlertLoggedAt: iso(3600e3).slice(0, 16) + j.spend.alertState.lastAlertLoggedAt.slice(16) });
  assert.equal(j.spend.resetBasis, 'UTC midnight'); assert.match(j.spend.resetsAt, /T00:00:00\.000Z$/); assert.ok(Date.parse(j.spend.resetsAt) > Date.now() && Date.parse(j.spend.resetsAt) - Date.now() <= DAY); assert.match(j.spend.resetsAtAsiaJerusalem, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} Asia\/Jerusalem$/); assert.equal(j.spend.estimated, true);
  assert.deepEqual({ ...j.signups, today: 0 }, { today: 0, last24h: 2, total: 8 }); assert.ok(j.signups.today <= 2);
  assert.deepEqual(j.subscribers, { paying: 3, byPlan: { starter: 1, pro: 1, agency: 1 }, mrrIls: 79 + 179 + 549, trialOrFree: 2, cancelledInPeriod: 1 });
  assert.deepEqual(j.payments, { failuresLast24h: 1, failuresLast7d: 2, pastDue: 2, graceActive: 1 });
  assert.deepEqual(j.sync, { lastRunAt: iso(4 * 3600e3).slice(0, 16) + j.sync.lastRunAt.slice(16), lastOk: false, lastError: j.sync.lastError, running: false }); assert.ok(j.sync.lastError.length <= 80 && j.sync.lastError.includes('[email]') && !/\d{4}/.test(j.sync.lastError) && !j.sync.lastError.includes('abcdefghijklmnop'), j.sync.lastError);
  assert.deepEqual(j.config, { paymentsProvider: 'mock', scanMode: 'live', emailMode: 'mock', prelaunch: j.config.prelaunch }); };
Object.keys(orig).forEach(k => { console[k] = (...a) => logs.push(a.join(' ')); });
const keepTimingSafe = crypto.timingSafeEqual; let tsCalls = 0, tsLens = [];
try {
  // ---- disabled: unset / too short -> 404 identical to an unknown route ----
  const unk = await get({}, '/api/internal/does-not-exist'); const unkBody = await unk.text(); assert.equal(unk.status, 404); assert.equal(unkBody, '{"error":"not found"}');
  const same = async (r, why) => { assert.equal(r.status, 404, why); assert.equal(await r.text(), unkBody, why); assert.deepEqual(hdrs(r), hdrs(unk), why); assert.equal(r.headers.get('retry-after'), null, why); };
  await same(await get({ 'X-Status-Token': TOKEN }), 'unset'); process.env.STATUS_TOKEN = TOKEN.slice(0, 23); await same(await get({ 'X-Status-Token': TOKEN.slice(0, 23) }), '23 chars'); ok('STATUS_TOKEN unset or < 24 chars -> disabled: even the right header gets the plain unknown-route 404 (same body and headers)');
  // ---- enabled: wrong/missing -> same 404 ----
  process.env.STATUS_TOKEN = TOKEN; statusFailLimiter.reset();
  for (const h of [{}, { 'X-Status-Token': '' }, { 'X-Status-Token': 'wrong' }, { 'X-Status-Token': TOKEN + 'x' }, { 'X-Status-Token': TOKEN.slice(0, -1) }, { 'X-Cron-Secret': TOKEN }, { Authorization: 'Bearer ' + TOKEN }]) await same(await get(h), JSON.stringify(h));
  await same(await get({}, '/api/internal/status?token=' + TOKEN + '&x-status-token=' + TOKEN), 'token in URL is ignored'); statusFailLimiter.reset();
  assert.equal((await fetch(URL_, { method: 'POST', headers: { 'X-Status-Token': TOKEN } })).status, 404); assert.equal((await fetch(URL_, { method: 'DELETE', headers: { 'X-Status-Token': TOKEN } })).status, 404);
  ok('missing / empty / wrong / longer / shorter token, other headers, token in the URL, wrong methods -> 404, same body and headers as an unknown route (no 401/403, no Retry-After)');
  // ---- authorized ----
  statusFailLimiter.reset(); const t0 = Date.now(); const r = await get({ 'X-Status-Token': TOKEN }); const ms = Date.now() - t0; assert.equal(r.status, 200); const text = await r.text(); const j = JSON.parse(text);
  assert.equal(r.headers.get('cache-control'), 'no-store'); assert.match(r.headers.get('content-type'), /application\/json/); assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow'); assert.ok(ms < 500, `took ${ms} ms`);
  check(j); noSecrets(text, 'response'); ok(`200 with the token: exact field shape, numbers match the seeded data (test subscription excluded, past_due/cancelled not paying, grace window, 24h/7d windows), ${ms} ms, Cache-Control no-store`);
  ok('no PII: none of the seeded emails, names, business names, scan/account/report ids, SUMIT refs, card number, tokens or the caller IP appear in the JSON; sync.lastError is scrubbed (email/url/number/token) and <= 80 chars');
  // valid token never exhausts the limiter
  for (let i = 0; i < 20; i++) assert.equal((await get({ 'X-Status-Token': TOKEN })).status, 200); ok('valid requests are not rate limited (hit refunded)');
  // ---- store modes: JSON store (above, FORCE_JSON_STORE) and Postgres (pg-mem) give the same numbers ----
  const P = await import('../src/store-pg.js'); const mem = newDb(); const { Pool } = mem.adapters.createPg(); const URLPG = 'postgres://u@h/db?sslmode=disable';
  const a = await P.createPgStore(URLPG, { Pool }); const pdb = a.db(); for (const k of ['accounts', 'businesses', 'scans', 'spend']) Object.assign(pdb[k], JSON.parse(JSON.stringify(db[k]))); pdb.events.push(...JSON.parse(JSON.stringify(db.events))); await a.save();
  const b = await P.createPgStore(URLPG, { Pool }); const jp = S.buildStatus({ db: b.db() }); check(JSON.parse(JSON.stringify(jp))); noSecrets(JSON.stringify(jp), 'postgres response'); assert.deepEqual({ ...jp, generatedAt: 0 }, { ...S.buildStatus({ db }), generatedAt: 0 }); await a.close(); await b.close();
  ok('works on both stores: the Postgres store (pg-mem, reloaded from tables) yields the identical result as the JSON store');
  // ---- tolerant of missing tables / fields (null), never throws ----
  const empty = S.buildStatus({ db: {} }); shapeKeys(empty); assert.equal(empty.scans.total, 0); assert.equal(empty.spend.todayUsd, 0); assert.equal(empty.sync.lastRunAt, null); assert.equal(empty.sync.lastOk, null);
  const weird = S.buildStatus({ db: { accounts: { a: null, b: { plan: 'nonsense' }, c: { plan: 'pro', subscriptionRef: 'x', status: 'past_due' } }, scans: { s: { at: 'garbage' }, t: null }, events: [null, { type: 'billing.payment_failed' }, 7], spend: { [today]: 'abc' } } }); shapeKeys(weird); assert.equal(weird.spend.todayUsd, 0);
  const broken = S.buildStatus({ db: { accounts: 5, scans: { get s() { throw new Error('boom'); } }, events: 'x', spend: null } }); assert.equal(broken.ok, true); assert.equal(broken.scans, null); assert.ok(broken.signups); ok('missing/garbage collections and fields never throw: sections degrade to zeros or null');
  // ---- 500 {ok:false}, no details ----
  const dbRef = getDb(); const savedAccounts = db.accounts; Object.defineProperty(dbRef, 'accounts', { get() { throw new Error('SECRET-DETAIL ' + TOKEN); }, configurable: true });
  try { statusFailLimiter.reset(); const e = await get({ 'X-Status-Token': TOKEN }); // sections are individually safe, so the response is still 200 with nulls; force a hard failure through the route:
    assert.equal(e.status, 500); assert.deepEqual(await e.json(), { ok: false }); } finally { Object.defineProperty(dbRef, 'accounts', { value: savedAccounts, writable: true, configurable: true, enumerable: true }); }
  ok('internal failure -> 500 {"ok":false}, no details');
  // ---- timing-safe compare path ----
  const src = fs.readFileSync('server.js', 'utf8'); assert.match(src, /x-status-token[^\n]*\n?[^\n]*/); assert.ok(/safeEqual\(String\(q\.get\('x-status-token'\)[^)]*\)\s*,\s*secret\)/.test(src), 'route uses safeEqual'); assert.ok(!/q\.(?:query|body)[^\n]*STATUS_TOKEN|STATUS_TOKEN[^\n]*q\.(?:query|body)/.test(src));
  crypto.timingSafeEqual = (x, y) => { tsCalls++; tsLens.push([x.length, y.length]); return keepTimingSafe(x, y); }; statusFailLimiter.reset();
  for (const t of ['x', TOKEN + 'long-long-long-long', TOKEN.replace(/.$/, 'Q'), TOKEN]) await get({ 'X-Status-Token': t }); crypto.timingSafeEqual = keepTimingSafe;
  assert.equal(tsCalls, 4); assert.ok(tsLens.every(([x, y]) => x === 64 && y === 64), JSON.stringify(tsLens)); ok('token compared via crypto.timingSafeEqual on equal-length (64-byte hex sha256) digests for every attempt, whatever the token length');
  // ---- rate limit on unauthenticated attempts: STATUS_FAIL_MAX=6, then silent 404 (even for the right token), no 429 / hints ----
  statusFailLimiter.reset(); const codes = []; for (let i = 0; i < 8; i++) { const x = await get({ 'X-Status-Token': 'bad' + i }); codes.push(x.status); await same(x, 'limited ' + i); }
  assert.deepEqual(codes, Array(8).fill(404)); assert.equal((await get({ 'X-Status-Token': TOKEN })).status, 404, 'limited IP is locked out (token not even checked)'); statusFailLimiter.reset(); assert.equal((await get({ 'X-Status-Token': TOKEN })).status, 200);
  ok('repeated wrong tokens: per-IP limit (STATUS_FAIL_MAX) then even the right token gets the plain 404 until the window passes; never 429/401, no Retry-After; reset restores access');
  // ---- logging ----
  const allLogs = logs.join('\n'); assert.ok(!allLogs.includes(TOKEN) && !allLogs.includes(TOKEN.slice(0, 20)) && !allLogs.includes('SECRET-DETAIL')); assert.ok(allLogs.includes('[status] failed')); assert.ok(!/x-status-token/i.test(src.replace(/^.*\/\/.*$/gm, '').split('\n').filter(l => /console\./.test(l)).join('\n')), 'no log line reads the header');
  ok('the token and the header never appear in logs (no request logger exists; only "[status] failed (ErrorName)" is logged)');
  // ---- robots / sitemap / llms ----
  assert.ok(robotsTxt().includes('Disallow: /api/')); assert.ok(!/status/i.test(sitemapXml())); assert.ok(!/internal/i.test(robotsTxt()) && !/internal\/status/.test(sitemapXml())); ok('robots.txt disallows /api/ (path not named anywhere), sitemap does not list it, the 200 carries X-Robots-Tag noindex');
  // ---- sync state: reflects the cron route (in-process) incl. running flag ----
  process.env.CRON_SECRET = 'cron-secret-0123456789abcdef-XYZ'; S.resetSyncState(); let release; const gate = new Promise(res => { release = res; }); const realSync = cronHooks.sync; cronHooks.sync = async () => { await gate; return {}; };
  const first = fetch(B + '/api/internal/cron/sync', { method: 'POST', headers: { 'X-Cron-Secret': process.env.CRON_SECRET } }); await new Promise(res => setTimeout(res, 100));
  assert.equal((await (await get({ 'X-Status-Token': TOKEN })).json()).sync.running, true); release(); assert.equal((await first).status, 200); let s2 = (await (await get({ 'X-Status-Token': TOKEN })).json()).sync; assert.equal(s2.running, false); assert.equal(s2.lastOk, true); assert.equal(s2.lastError, null); assert.ok(Date.now() - Date.parse(s2.lastRunAt) < 5000);
  cronHooks.sync = async () => { throw Object.assign(new Error('boom for pii.owner@secret-mail.test 1234567890'), { name: 'SumitError' }); }; await fetch(B + '/api/internal/cron/sync', { method: 'POST', headers: { 'X-Cron-Secret': process.env.CRON_SECRET } });
  s2 = (await (await get({ 'X-Status-Token': TOKEN })).json()).sync; assert.equal(s2.lastOk, false); assert.match(s2.lastError, /^SumitError: boom for \[email\] \[num\]$/); cronHooks.sync = realSync; delete process.env.CRON_SECRET;
  ok('sync block follows the cron route: running flag, lastOk/lastRunAt on success, scrubbed short error on failure');
  // ---- config-check + scrub unit ----
  assert.ok(checkConfig({ STATUS_TOKEN: 'short' }).warnings.some(w => w.startsWith('STATUS_TOKEN'))); assert.ok(!checkConfig({ STATUS_TOKEN: TOKEN }).warnings.some(w => w.startsWith('STATUS_TOKEN'))); assert.ok(!JSON.stringify(checkConfig({ STATUS_TOKEN: TOKEN })).includes(TOKEN));
  assert.equal(S.scrub('a@b.co https://x.y/z?q=1 12345 AAAAAAAAAAAAAAAAAAAAAAAAAAAA ok'), '[email] [url] [num] [token] ok'); ok('config:check warns for a short STATUS_TOKEN (never prints it); scrub() unit');
  // ---- docs ----
  const env = fs.readFileSync('.env.example', 'utf8'), go = fs.readFileSync('GO-LIVE.md', 'utf8'), rd = fs.readFileSync('README.md', 'utf8'); assert.match(env, /^STATUS_TOKEN=$/m); for (const s of ['/api/internal/status', 'X-Status-Token', 'STATUS_TOKEN', '404']) assert.ok(go.includes(s) && (s === '404' || rd.includes(s) || s === 'X-Status-Token'), s); ok('.env.example (empty value), GO-LIVE.md and README document it');
  Object.assign(console, orig); rawLog(`ALL STATUS TESTS PASSED (${n})`);
} finally { crypto.timingSafeEqual = keepTimingSafe; Object.assign(console, orig); srv.close(); TD.done(); }
process.exit(0);
