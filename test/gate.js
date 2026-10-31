// gate1: email-gated free scan. Guest scan (name + city only) -> locked partial report (no locked fields leave the server) -> email unlock.
// Limits (CAPTCHA, per-IP, spend cap), the paid-account guard and the owner allowlist still hold. Mock engines only, outbound fetch blocked.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('gate');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES', 'DISABLE_IP_LIMIT', 'DAILY_SPEND_CAP_USD', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY']) delete process.env[k];
process.env.SCAN_RATE_MAX = '1000'; process.env.UNLOCK_RATE_MAX = '1000'; process.env.OWNER_EMAILS = 'owner@example.test';
const realFetch = globalThis.fetch;
const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js'); const { buildFunnel } = await import('../src/funnel.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
const outbound = []; globalThis.fetch = async (u, o) => { u = String(u); if (u.startsWith(B)) return realFetch(u, o); outbound.push(u); throw new Error('outbound fetch blocked in tests'); };
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const post = (p, body, ip = '203.0.113.20', h = {}) => realFetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip, ...h }, body: JSON.stringify(body) });
const get = p => realFetch(B + p).then(async r => ({ status: r.status, headers: r.headers, j: await r.json() }));
const LOCKED = ['results', 'fixes', 'alerts', 'topCitedHosts', 'byEngine', 'sentiment', 'facts', 'mentionRate', 'avgRank', 'answer', 'history', 'website', 'estCostUsd'];
const quiet = async f => { const w = console.warn, e = console.error; console.warn = () => {}; console.error = () => {}; try { return await f(); } finally { console.warn = w; console.error = e; } };
try {
  const r1 = await post('/api/scan', { name: 'Sample Studio', city: 'תל אביב-יפו', lang: 'he' }); assert.equal(r1.status, 200); const j1 = await r1.json(); assert.ok(j1.reportId); assert.equal(j1.locked, true);
  assert.equal(j1.reportId.length, 12); const db = getDb(); const s = db.scans[j1.reportId]; assert.equal(s.locked, true); const guest = db.accounts[s.accountId]; assert.equal(guest.guest, true); assert.equal(guest.email, null);
  ok('guest scan with only name + city: 200, locked:true, 12-char report id, stored on a guest account without email');
  const p = await get(`/api/report/${j1.reportId}`); assert.equal(p.status, 200); assert.equal(p.j.locked, true); const raw = JSON.stringify(p.j);
  for (const k of LOCKED) assert.ok(!raw.includes(`"${k}"`), `partial response leaks ${k}`);
  assert.equal(typeof p.j.scan.summary.score, 'number'); assert.ok(p.j.scan.summary.topCompetitors.length <= 3); assert.match(p.headers.get('x-robots-tag') || '', /noindex/); assert.equal(p.headers.get('cache-control'), 'no-store');
  ok('partial GET /api/report/:id: score + max 3 competitor names only; no answers, fixes, sources, per-engine data or history; noindex + no-store');
  // funnel: guest account is not a signup yet
  assert.equal(buildFunnel(db).total.signup, 0); assert.equal(buildFunnel(db).total.scanStarted, 1); assert.equal(buildFunnel(db).total.scanDone, 1); ok('funnel: guest scan counts scanStarted + scanDone, not signup');
  assert.equal((await post(`/api/report/${j1.reportId}/unlock`, { email: 'not-an-email' })).status, 400);
  const form = await realFetch(B + `/api/report/${j1.reportId}/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email=a%40example.test' }); assert.equal(form.status, 415);
  assert.equal((await post('/api/report/doesnotexist/unlock', { email: 'a@example.test' })).status, 404); ok('unlock: invalid email 400, non-JSON (cross-site form) 415, unknown id 404');
  const u = await post(`/api/report/${j1.reportId}/unlock`, { email: 'Visitor@Example.test', lang: 'he', marketingConsent: 'on' }); assert.equal(u.status, 200); assert.equal((await u.json()).ok, true); assert.equal(u.headers.get('set-cookie'), null);
  const full = await get(`/api/report/${j1.reportId}`); assert.ok(!full.j.locked); assert.ok(full.j.scan.results.length > 0); assert.ok(Array.isArray(full.j.scan.fixes));
  const acc = Object.values(db.accounts).find(a => a.email === 'visitor@example.test'); assert.ok(acc); assert.equal(db.scans[j1.reportId].accountId, acc.id); assert.equal(db.businesses[db.scans[j1.reportId].businessId].accountId, acc.id); assert.equal(acc.emailPrefs?.marketing, true);
  const f = buildFunnel(db).total; assert.equal(f.emailUnlocked, 1); assert.equal(f.signup, 1); ok('unlock: full report served, scan + business moved to the email account (consent recorded), funnel emailUnlocked=1 signup=1, no session cookie');
  assert.equal((await (await post(`/api/report/${j1.reportId}/unlock`, { email: 'other@example.test' })).json()).already, true); assert.equal(db.scans[j1.reportId].accountId, acc.id); ok('unlocking twice is a no-op (report cannot be re-assigned)');
  // dedupe: second guest scan unlocked with the same email reuses the account
  const j2 = await (await post('/api/scan', { name: 'Sample Cafe', city: 'Haifa', lang: 'en' })).json(); await post(`/api/report/${j2.reportId}/unlock`, { email: 'visitor@example.test' });
  assert.equal(Object.values(db.accounts).filter(a => a.email === 'visitor@example.test').length, 1); ok('same email unlocking a second report reuses one account (dedupe)');
  // per-IP free limit on the guest path (3/day: two used above from this IP)
  assert.equal((await post('/api/scan', { name: 'Sample 3', city: 'Haifa' })).status, 200); const lim = await post('/api/scan', { name: 'Sample 4', city: 'Haifa' }); assert.equal(lim.status, 429); assert.equal((await lim.json()).code, 'free_limit_reached'); ok('guest path keeps the per-IP limit: 4th scan from one IP -> 429');
  process.env.DISABLE_IP_LIMIT = '1';
  // paid account cannot take over a guest report without signing in
  const j5 = await (await post('/api/scan', { name: 'Sample 5', city: 'Eilat' }, '198.51.100.30')).json(); const pa = Object.values(db.accounts).find(a => a.email === 'visitor@example.test'); pa.plan = 'pro';
  const lr = await post(`/api/report/${j5.reportId}/unlock`, { email: 'visitor@example.test' }); assert.equal(lr.status, 401); assert.equal((await lr.json()).code, 'login_required'); assert.equal(db.scans[j5.reportId].locked, true); pa.plan = 'free'; ok('paid account email -> 401 login_required, report stays locked');
  // owner unlock: scan becomes internal and leaves the funnel
  const before = buildFunnel(db).total; const j6 = await (await post('/api/scan', { name: 'Sample 6', city: 'Eilat' }, '198.51.100.30')).json(); await post(`/api/report/${j6.reportId}/unlock`, { email: 'OWNER@example.test' });
  const after = buildFunnel(db).total; assert.equal(db.scans[j6.reportId].internal, true); assert.equal(after.scanStarted, before.scanStarted); assert.equal(after.scanDone, before.scanDone); assert.equal(after.emailUnlocked, before.emailUnlocked); assert.equal(after.internalEmailUnlocked, 1); assert.equal(after.internalScans, before.internalScans + 1);
  ok('owner email unlock: scan flagged internal; scanStarted/scanDone/emailUnlocked unchanged, counted as internal');
  delete process.env.DISABLE_IP_LIMIT;
  // owner with email up front still bypasses per-IP + per-email limits (old path intact)
  for (let i = 0; i < 5; i++) assert.equal((await post('/api/scan', { name: `Prospect ${i}`, category: 'Studio', city: 'Haifa', email: 'owner@example.test' })).status, 200); ok('owner email up front: 5 scans from a limited IP all accepted (allowlist path intact)');
  // CAPTCHA still required on the guest path
  process.env.TURNSTILE_SECRET_KEY = 'sk'; process.env.TURNSTILE_SITE_KEY = 'pk'; try { const c = await quiet(() => post('/api/scan', { name: 'Sample 7', city: 'Haifa' }, '192.0.2.70')); assert.equal(c.status, 403); assert.equal((await c.json()).code, 'captcha_required'); } finally { delete process.env.TURNSTILE_SECRET_KEY; delete process.env.TURNSTILE_SITE_KEY; } ok('guest path still requires CAPTCHA');
  // spend cap on the guest path
  process.env.SCAN_MODE = 'live'; process.env.OPENAI_API_KEY = 'sk-test-not-real'; process.env.LIVE_ENGINES = 'chatgpt'; process.env.DAILY_SPEND_CAP_USD = '0';
  const cap = await quiet(() => post('/api/scan', { name: 'Sample 8', city: 'Haifa', lang: 'en' }, '192.0.2.71')); assert.equal(cap.status, 429); assert.equal(outbound.length, 0);
  for (const k of ['SCAN_MODE', 'OPENAI_API_KEY', 'LIVE_ENGINES', 'DAILY_SPEND_CAP_USD']) delete process.env[k]; ok('DAILY_SPEND_CAP_USD enforced on the guest path before any engine call');
  const src = fs.readFileSync('web/components/ScanForm.tsx', 'utf8') + fs.readFileSync('web/lib/gate.ts', 'utf8') + fs.readFileSync('web/components/LockedReport.tsx', 'utf8');
  assert.match(src, /const fields = \["name", "city"\] as const/); assert.ok(!/dent|שיניים|perplexity|claude|copilot/i.test(fs.readFileSync('web/lib/gate.ts', 'utf8'))); ok('form asks for name + city only; gate copy has no dentist wording and no non-live engine claims');
  assert.match(fs.readFileSync('docs/ANALYTICS.md', 'utf8'), /emailUnlocked/); ok('docs/ANALYTICS.md documents emailUnlocked');
  console.log(`gate: ${n} checks passed`);
} finally { srv.close(); TD.done(); }
