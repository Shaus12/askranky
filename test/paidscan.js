// Paid-account scan guard: POST /api/scan and the /scan form need the paid account's own signed-in session (dashboard key) when the
// typed email belongs to an account with a paid plan. Not signed in / signed in as someone else -> 401 login_required, with nothing
// created, scanned, spent or emailed (live mode with a key set: the engine must not be called). Free / unknown emails unchanged.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { useTempData } from './helpers.js'; const TD = useTempData('paidscan');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES']) delete process.env[k];
process.env.DISABLE_IP_LIMIT = '1'; process.env.SCAN_RATE_MAX = '1000'; process.env.UNSUBSCRIBE_SECRET = 'test-unsub-secret-0123456789';
const realFetch = globalThis.fetch; const outbound = [];
const { default: app, needsPaidLogin } = await import('../server.js'); const { getDb } = await import('../src/store.js');
const findOrCreateAccount = e => { const d = getDb(); let a = Object.values(d.accounts).find(x => x.email === e); if (!a) { a = { id: 'acc' + Object.keys(d.accounts).length + Math.random().toString(36).slice(2, 8), email: e, plan: 'free', usage: {} }; d.accounts[a.id] = a; } return a; };
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
globalThis.fetch = async (u, o) => { u = String(u); if (u.startsWith(B)) return realFetch(u, o); outbound.push(u); throw new Error('outbound blocked: ' + u); };
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const post = (p, body, h = {}) => realFetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) });
const form = (body) => realFetch(B + '/scan', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
const db = getDb(); const outbox = () => (fs.existsSync(TD.outbox) ? fs.readdirSync(TD.outbox).length : 0);
const snap = () => JSON.stringify({ s: Object.keys(db.scans).length, b: Object.keys(db.businesses).length, a: Object.keys(db.accounts).length, spend: db.spend, usage: Object.values(db.accounts).map(a => a.usage), ev: db.events.length, mail: outbox() });
const mk = (email, extra) => { const a = findOrCreateAccount(email); Object.assign(a, { key: 'K'.repeat(20) + email.replace(/\W/g, '').padEnd(20, 'x'), ...extra }); return a; };
const paid = mk('paid@t.test', { plan: 'starter', status: 'active', subscriptionRef: 'sr1' });
const other = mk('other@t.test', { plan: 'starter', status: 'active', subscriptionRef: 'sr2' });
const cancelled = mk('cx@t.test', { plan: 'pro', status: 'cancelled', subscriptionRef: 'sr3', paidThrough: new Date(Date.now() + 864e5).toISOString() });
const pastDue = mk('pd@t.test', { plan: 'starter', status: 'past_due', subscriptionRef: 'sr4' });
const tester = mk('admin@t.test', { plan: 'starter', status: 'active', adminTest: true, testSubscription: true });
const sess = a => ({ 'x-account-id': a.id, 'x-dashboard-key': a.key });
const biz = (email, lang) => ({ name: 'Paid Biz ' + Math.random().toString(36).slice(2, 6), category: 'Plumber', city: 'Haifa', email, ...(lang ? { lang } : {}) });
try {
  // 1) not signed in: 401 login_required for every flavour of paid account; nothing created/spent/emailed, no engine call even in live mode
  process.env.SCAN_MODE = 'live'; process.env.OPENAI_API_KEY = 'sk-test-not-real'; process.env.LIVE_ENGINES = 'chatgpt';
  const before = snap();
  for (const [a, lang] of [[paid, 'he'], [paid, 'en'], [cancelled, undefined], [pastDue, 'he']]) {
    const r = await post('/api/scan', biz(a.email.toUpperCase(), lang)); assert.equal(r.status, 401); const j = await r.json();
    assert.deepEqual(Object.keys(j).sort(), ['code', 'error', 'loginUrl', 'message', 'messageHe']); assert.equal(j.error, 'login_required'); assert.equal(j.code, 'login_required');
    assert.equal(j.loginUrl, `/${lang === 'he' ? 'he' : 'en'}/login`); assert.doesNotMatch(j.message + j.messageHe, /paid|plan|subscri|מנוי|תשלום/i, 'neutral wording'); assert.ok(j.messageHe.includes('להתחבר')); }
  assert.equal(snap(), before); assert.deepEqual(outbound, []);
  ok('paid (active / cancelled-in-period / past-due) email, not signed in: 401 {error,code:login_required,message,messageHe,loginUrl:/{lang}/login}; neutral text; nothing created/spent/emailed; no engine call (live mode)');

  // 2) wrong / other account's session, bad key, or session of the right id with a wrong key
  for (const h of [sess(other), { 'x-account-id': paid.id, 'x-dashboard-key': 'nope' }, { 'x-account-id': other.id, 'x-dashboard-key': paid.key }, { 'x-dashboard-key': paid.key }]) {
    const r = await post('/api/scan', biz(paid.email), h); assert.equal(r.status, 401); assert.equal((await r.json()).code, 'login_required'); }
  assert.equal(snap(), before); assert.deepEqual(outbound, []);
  delete process.env.SCAN_MODE; delete process.env.OPENAI_API_KEY; delete process.env.LIVE_ENGINES;
  ok('signed in as a different account (or wrong/missing key/id): login_required, nothing created');

  // 3) signed in as that account: proceeds; same business again -> existing as before (no free-plan limit)
  const b1 = biz(paid.email); const r1 = await post('/api/scan', b1, sess(paid)); assert.equal(r1.status, 200); const j1 = await r1.json(); assert.ok(j1.reportId && !j1.existing);
  const r2 = await post('/api/scan', biz(paid.email), sess(paid)); assert.equal(r2.status, 200); assert.ok(!(await r2.json()).existing, 'paid: 2nd business allowed');
  const cx = await post('/api/scan', biz(cancelled.email), sess(cancelled)); assert.equal(cx.status, 200);
  ok('signed in as the same paid account (incl. cancelled-in-period): scan runs as before, more than one business');

  // 4) free / unknown / admin-test emails unaffected (no session needed; free-scan-limit still applies)
  const u = await post('/api/scan', biz('new@t.test')); assert.equal(u.status, 200); const uj = await u.json();
  const again = await post('/api/scan', biz('new@t.test')); assert.equal(again.status, 409); assert.equal((await again.json()).code, 'free_scan_used');
  const t = await post('/api/scan', biz(tester.email)); assert.equal(t.status, 200);
  assert.equal(needsPaidLogin(Object.values(db.accounts).find(a => a.email === 'new@t.test')), false); assert.equal(needsPaidLogin(tester), false); assert.equal(needsPaidLogin(cancelled), true); assert.equal(needsPaidLogin(null), false); assert.ok(uj.reportId);
  ok('unknown/free email: no login needed, free_scan_used unchanged; admin test accounts exempt');

  // 5) legacy /scan form: paid email without session -> 401 page, nothing created; with session fields -> redirect to report
  const b5 = snap(); const f1 = await form(biz(paid.email)); assert.equal(f1.status, 401); assert.match(await f1.text(), /\/en\/login/); assert.equal(snap(), b5);
  const f2 = await form({ ...biz(paid.email), accountId: paid.id, dashboardKey: paid.key }); assert.equal(f2.status, 302); assert.match(f2.headers.get('location'), /^\/r\//);
  ok('legacy /scan form: 401 page with login link and nothing created; accountId+dashboardKey fields let the owner scan');

  // 6) frontend wiring + strings
  const sp = fs.readFileSync('web/components/ScanProgress.tsx', 'utf8'), ln = fs.readFileSync('web/components/LoginRequiredNotice.tsx', 'utf8'), st = fs.readFileSync('web/lib/i18n-free.ts', 'utf8'), dash = fs.readFileSync('web/components/Dashboard.tsx', 'utf8');
  assert.match(sp, /e\?\.code === "login_required"/); assert.match(sp, /<LoginRequiredNotice /); assert.match(sp, /"x-dashboard-key"/);
  assert.match(ln, /role="alert"/); assert.match(ln, /data-login-link/); assert.doesNotMatch(ln, /localStorage/); assert.match(st, /paidLoginText/); assert.match(st, /יש להתחבר כדי להמשיך/); assert.match(dash, /data-back-to-scan/);
  ok('client: ScanProgress sends the tab session, shows LoginRequiredNotice (he/en strings in i18n-free.ts); dashboard offers a way back to the scan form');
  console.log(`paidscan: ${n} checks passed`);
} finally { globalThis.fetch = realFetch; srv.close(); TD.done(); }
