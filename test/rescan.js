// Scheduled re-scans (src/rescan.js), score history for the chart (/api/report historyAt, /api/dashboard nextScanAt) and the monthly
// digest (src/digest.js, src/email/digest.js) + their cron endpoints. Mock engines and an injected sender only: no AI spend, no email.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('rescan');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'CRON_SECRET', 'AUTO_RESCAN_ENABLED', 'MONTHLY_DIGEST_ENABLED', 'MOCK_SEED', 'LIVE_ENGINES']) delete process.env[k];
Object.assign(process.env, { DISABLE_IP_LIMIT: '1', UNSUBSCRIBE_SECRET: 'test-unsub-secret-0123456789', BASE_URL: 'https://askranky.com' });
const realFetch = globalThis.fetch; const { default: app, cronHooks } = await import('../server.js'); const { getDb, save, flush } = await import('../src/store.js');
const { runRescans, nextScanAt, autoScanEligible } = await import('../src/rescan.js'); const { runDigest, digestFor } = await import('../src/digest.js');
const { renderDigestEmail } = await import('../src/email/digest.js'); const { canSend, setConsent } = await import('../src/consent.js'); const { PLANS } = await import('../src/plans.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const post = (p, h = {}) => realFetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: '{}' });
const DAY = 864e5; const ago = d => new Date(Date.now() - d * DAY).toISOString();
try {
  assert.equal(PLANS.starter.cadence, 'monthly'); assert.equal(PLANS.starter.rescanDays, 30); assert.equal(PLANS.pro.rescanDays, 7); assert.equal(PLANS.agency.rescanDays, 7); ok('cadence: Starter monthly (30d), Pro + Agency weekly (7d)');
  const db = getDb(); const sub = { subscriptionRef: 'so-1', status: 'active' };
  const mk = (id, plan, extra = {}, lastDays = null) => { db.accounts[id] = { id, key: 'k'.repeat(40), email: id + '@t.test', plan, usage: {}, createdAt: ago(90), lang: 'he', ...extra };
    const b = db.businesses['b-' + id] = { id: 'b-' + id, accountId: id, name: 'Clinic <' + id + '>', category: 'Dentist', city: 'Holon', scanIds: [] };
    if (lastDays != null) { const sid = 's-' + id; db.scans[sid] = { id: sid, businessId: b.id, accountId: id, at: ago(lastDays), summary: { score: 40, topCompetitors: [{ name: 'Old Rival', count: 2 }] }, results: [] }; b.scanIds = [sid]; } return b; };
  mk('st-due', 'starter', sub, 31); mk('st-fresh', 'starter', sub, 10); mk('pro-due', 'pro', sub, 8); mk('pro-fresh', 'pro', sub, 3); mk('ended', 'starter', { subscriptionRef: 'so-2', status: 'cancelled_ended' }, 40);
  mk('comp', 'pro', { comp: true }, 40); mk('free', 'free', {}, 40); mk('pastdue', 'pro', { subscriptionRef: 'so-3', status: 'past_due' }, 40); mk('newpaid', 'starter', sub); save();
  assert.equal(autoScanEligible(db.accounts.comp), false); assert.equal(autoScanEligible(db.accounts.ended), false); assert.equal(autoScanEligible(db.accounts['st-due']), true);
  const calls = []; const fake = async (a, b) => { calls.push(b.id); const s = { id: 'n-' + b.id, businessId: b.id, at: new Date().toISOString(), summary: { score: 55 } }; db.scans[s.id] = s; b.scanIds = [...b.scanIds, s.id]; return s; };
  let out = await runRescans({ scan: fake }); assert.deepEqual(calls.sort(), ['b-newpaid', 'b-pro-due', 'b-st-due']); assert.equal(out.skipped.not_due, 2);
  ok('job: re-scans due businesses of ACTIVE paid subscriptions only (Starter after 30d, Pro after 7d, never-scanned now); fresh / ended / past_due / comp / free skipped');
  calls.length = 0; out = await runRescans({ scan: fake }); assert.equal(calls.length, 0); ok('job: a second trigger the same day scans nothing (idempotent by last-scan date)');
  const cap = async () => { throw Object.assign(new Error('cap'), { code: 'CAP' }); }; db.scans['n-b-st-due'].at = ago(31); out = await runRescans({ scan: cap }); assert.equal(out.skipped.cap, 1); ok('job: the plan / daily budget cap (runScan CAP) stops a scan, counted as skipped');
  db.scans['n-b-st-due'].at = ago(31); out = await runRescans({ scan: fake, maxScans: 0 }); assert.equal(out.skipped.run_limit, 1); ok('job: AUTO_RESCAN_MAX_PER_RUN bounds one run');
  const nx = Date.parse(nextScanAt(db.accounts['pro-fresh'], db.businesses['b-pro-fresh'], db)); assert.ok(Math.abs(nx - (Date.now() + 4 * DAY)) < 60e3); assert.equal(nextScanAt(db.accounts.comp, db.businesses['b-comp'], db), null); ok('nextScanAt: last scan + cadence; null for comp');
  // real runScan with mock engines
  const real = await runRescans(); assert.ok(real.scanned >= 1); assert.ok(db.events.some(e => e.type === 'scan.auto')); ok('job with the real runScan (mock engines): stores a scan and logs scan.auto');

  // ---- cron endpoints ----
  let r = await post('/api/internal/cron/rescan'); assert.equal(r.status, 404); process.env.CRON_SECRET = 'cron-secret-0123456789';
  r = await post('/api/internal/cron/rescan', { 'X-Cron-Secret': 'nope-nope-nope-nope' }); assert.equal(r.status, 401);
  const before = Object.keys(db.scans).length; r = await post('/api/internal/cron/rescan', { 'X-Cron-Secret': process.env.CRON_SECRET }); assert.equal((await r.json()).skipped, 'rescan_disabled'); assert.equal(Object.keys(db.scans).length, before);
  r = await post('/api/internal/cron/digest', { 'X-Cron-Secret': process.env.CRON_SECRET }); assert.equal((await r.json()).skipped, 'digest_disabled');
  const realR = cronHooks.rescan; let hit = 0; cronHooks.rescan = async () => { hit++; }; process.env.AUTO_RESCAN_ENABLED = '1'; r = await post('/api/internal/cron/rescan', { 'X-Cron-Secret': process.env.CRON_SECRET }); assert.equal(r.status, 200); assert.equal(hit, 1); cronHooks.rescan = realR;
  ok('cron: 404 without CRON_SECRET, 401 wrong secret, flag off → skipped and no scan (rescan_disabled / digest_disabled), flag on → runs');
  let pj = await (await realFetch(B + '/api/pricing?lang=he')).json(); assert.equal(pj.autoRescan, true); assert.equal(pj.digest, false); delete process.env.AUTO_RESCAN_ENABLED;
  pj = await (await realFetch(B + '/api/pricing?lang=he')).json(); assert.equal(pj.autoRescan, false); ok('/api/pricing reports autoRescan / digest so plan cards only claim what runs');

  // ---- history for the chart ----
  const b = db.businesses['b-pro-due']; const lastId = b.scanIds.at(-1); const rep = await (await realFetch(B + '/api/report/' + lastId)).json();
  assert.equal(rep.history.length, rep.historyAt.length); assert.ok(rep.history.length >= 2); assert.ok(rep.historyAt.every(x => !Number.isNaN(Date.parse(x)))); ok('/api/report: history + historyAt (real dates per stored scan)');
  process.env.AUTO_RESCAN_ENABLED = '1'; let dj = await (await realFetch(B + '/api/dashboard/pro-due', { headers: { 'x-dashboard-key': 'k'.repeat(40) } })).json(); assert.ok(dj.businesses[0].nextScanAt);
  delete process.env.AUTO_RESCAN_ENABLED; dj = await (await realFetch(B + '/api/dashboard/pro-due', { headers: { 'x-dashboard-key': 'k'.repeat(40) } })).json(); assert.equal(dj.businesses[0].nextScanAt, null); ok('/api/dashboard: nextScanAt only while AUTO_RESCAN_ENABLED=1');

  // ---- digest ----
  const bb = { id: 'bx', scanIds: ['d1', 'd2', 'd3'] }; const sc = { d1: { id: 'd1', at: ago(40), summary: { score: 30, topCompetitors: [{ name: 'Alpha' }] } }, d2: { id: 'd2', at: ago(20), summary: { score: 35, topCompetitors: [{ name: 'Alpha' }] } },
    d3: { id: 'd3', at: ago(0), summary: { score: 52, topCompetitors: [{ name: 'alpha' }, { name: 'Beta' }] }, fixes: [{ title: 'Add an FAQ', why: 'Own site never cited' }] } };
  const d = digestFor(bb, sc); assert.equal(d.prevScore, 30); assert.equal(d.score, 52); assert.deepEqual(d.newCompetitors, ['Beta']); assert.equal(d.topFix.title, 'Add an FAQ'); ok('digestFor: score vs a month ago, only NEW competitors (case-insensitive), top fix');
  const m = renderDigestEmail({ items: [{ ...d, business: { name: '<script>x</script>' } }], lang: 'he', base: 'https://askranky.com', accountId: 'a1', unsubscribeUrl: 'https://askranky.com/unsubscribe?t=z', month: '2026-10' });
  assert.match(m.html, /dir="rtl"/); assert.ok(m.html.includes('&lt;script&gt;') && !m.html.includes('<script>x')); assert.ok(m.html.includes('/unsubscribe?t=z') && m.html.includes('+22')); assert.match(m.subject, /סיכום חודשי/);
  const me = renderDigestEmail({ items: [d], lang: 'en', base: 'https://askranky.com', accountId: 'a1', unsubscribeUrl: 'https://askranky.com/u', month: '2026-10' }); assert.match(me.subject, /monthly summary/); assert.ok(me.html.includes('Beta'));
  ok('digest email: HE (RTL) / EN, escaped values, unsubscribe link');
  setConsent(db.accounts['pro-fresh'], 'digest', false, 't'); assert.equal(canSend(db.accounts['pro-fresh'], 'digest'), false); assert.equal(canSend(db.accounts['pro-fresh'], 'alerts'), true);
  const sent = []; const send = async x => { sent.push(x); return true; };
  out = await runDigest({ send }); const to = sent.map(x => x.to).sort();
  assert.ok(!to.some(x => /^(comp|ended|free|pastdue|pro-fresh)@/.test(x))); assert.ok(to.includes('st-due@t.test') && to.includes('pro-due@t.test')); assert.equal(out.skipped.opted_out, 1); assert.ok(sent.every(x => x.kind === 'digest' && x.headers['List-Unsubscribe']));
  ok('digest job: paying (active, non-comp) accounts only, opted-out skipped, List-Unsubscribe headers');
  const k = sent.length; out = await runDigest({ send }); assert.equal(sent.length, k); assert.ok(out.skipped.already_sent >= 2); const fail = async () => false; db.accounts['st-due'].digestMonth = '2026-01';
  out = await runDigest({ send: fail }); assert.equal(out.skipped.send_failed, 1); out = await runDigest({ send }); assert.equal(sent.length, k); ok('digest job: never twice in the same month, even after a failed send or a second trigger');
  out = await runDigest({ send, now: new Date(Date.now() + 40 * DAY) }); assert.ok(out.sent >= 1); ok('digest job: next month sends again');

  // ---- docs / flags ----
  const env = fs.readFileSync('.env.example', 'utf8'); for (const f of ['AUTO_RESCAN_ENABLED=', 'MONTHLY_DIGEST_ENABLED=', 'AUTO_RESCAN_MAX_PER_RUN=']) assert.ok(env.includes(f), f);
  const src = fs.readFileSync('server.js', 'utf8').replace(/\/\/.*$/gm, ''); assert.ok(!/setInterval\([^)]*(runRescans|runDigest)/.test(src)); ok('.env.example documents the flags; nothing in the app schedules the jobs');
  console.log(`ALL RESCAN TESTS PASSED (${n})`);
} finally { srv.close(); await flush(); TD.done(); }
process.exit(0);
