// owner1: OWNER_EMAILS allowlist (unlimited outreach scans, internal + out of the funnel, spend cap still on, no auth bypass) and the
// magic-link login CAPTCHA regression (the magic form must carry its own Turnstile widget). Mock engines only, outbound fetch blocked.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('owner');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES', 'DISABLE_IP_LIMIT', 'DAILY_SPEND_CAP_USD']) delete process.env[k];
process.env.SCAN_RATE_MAX = '1000'; process.env.OWNER_EMAILS = ' Owner@Example.test , second-owner@example.test,not-an-email';
const realFetch = globalThis.fetch; const outbound = [];
const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js'); const { buildFunnel } = await import('../src/funnel.js'); const { ownerEmails, isOwnerEmail } = await import('../src/owner.js'); const { buildStatus } = await import('../src/status.js').catch(() => ({}));
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
globalThis.fetch = async (u, o) => { u = String(u); if (u.startsWith(B)) return realFetch(u, o); outbound.push(u); throw new Error('outbound fetch blocked in tests'); };
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const post = (p, body, h = {}) => realFetch(B + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9', ...h }, body: JSON.stringify(body) });
const biz = i => ({ name: `Prospect ${i}`, category: 'Dentist', city: 'Tel Aviv', lang: 'he' });
const quiet = async f => { const w = console.warn, e = console.error; console.warn = () => {}; console.error = () => {}; try { return await f(); } finally { console.warn = w; console.error = e; } };
try {
  assert.deepEqual(ownerEmails(), ['owner@example.test', 'second-owner@example.test']); assert.ok(isOwnerEmail(' OWNER@example.TEST ')); assert.ok(!isOwnerEmail('owner@example.test.evil')); assert.ok(!isOwnerEmail(''));
  assert.deepEqual(ownerEmails({}), []); ok('OWNER_EMAILS parsing: comma-separated, trimmed, case-insensitive, invalid entries dropped, unset = empty');
  // owner: 6 different businesses, same email, same IP (> 3/day IP limit, > 1 free scan, > free monthly check budget) -> all 200, all internal
  const ids = []; for (let i = 0; i < 6; i++) { const r = await post('/api/scan', { ...biz(i), email: 'OWNER@example.test' }); assert.equal(r.status, 200, `owner scan ${i}`); const j = await r.json(); assert.ok(j.reportId); assert.ok(!j.existing); ids.push(j.reportId); }
  const db = getDb(); for (const id of ids) assert.equal(db.scans[id].internal, true);
  const hf = await post('/scan', { ...biz(9), email: 'owner@example.test' }, { 'Content-Type': 'application/json', Accept: 'text/html' }); assert.equal(hf.status, 302); assert.match(hf.headers.get('location'), /^\/r\//);
  ok('allowlisted email: 6 scans of different businesses from one email + one IP on /api/scan, plus HTML POST /scan, all accepted and stored internal:true');
  // the owner account exists now: the existing-account guard is skipped for the owner only; no session/key is handed out
  const r7 = await post('/api/scan', { ...biz(7), email: 'owner@example.test' }); const j7 = await r7.json(); assert.equal(r7.status, 200); assert.deepEqual(Object.keys(j7), ['reportId']);
  assert.equal(r7.headers.get('set-cookie'), null); ok('owner scan response carries only reportId: no session cookie, no dashboard key (no auth bypass)');
  // non-allowlisted: free rule and IP rule still apply
  const a1 = await post('/api/scan', { ...biz(1), email: 'visitor@example.test' }, { 'x-forwarded-for': '198.51.100.7' }); assert.equal(a1.status, 200);
  const a2 = await post('/api/scan', { ...biz(2), email: 'visitor@example.test' }, { 'x-forwarded-for': '198.51.100.7' }); assert.equal(a2.status, 409); assert.equal((await a2.json()).code, 'free_scan_used');
  for (const e of ['v2@example.test', 'v3@example.test']) assert.equal((await post('/api/scan', { ...biz(3), email: e }, { 'x-forwarded-for': '198.51.100.7' })).status, 200);
  const a4 = await post('/api/scan', { ...biz(4), email: 'v4@example.test' }, { 'x-forwarded-for': '198.51.100.7' }); assert.equal(a4.status, 429); assert.equal((await a4.json()).code, 'free_limit_reached');
  ok('non-allowlisted: second business for same email -> 409 free_scan_used; 4th free scan from one IP -> 429 free_limit_reached');
  // a paid account that is NOT on the list still needs its own sign-in (owner list does not weaken the guard for others)
  const paid = Object.values(db.accounts).find(a => a.email === 'v2@example.test'); paid.plan = 'pro'; paid.subscriptionStatus = 'active';
  process.env.DISABLE_IP_LIMIT = '1'; const lr = await post('/api/scan', { ...biz(5), email: 'v2@example.test' }, { 'x-forwarded-for': '192.0.2.44' }); assert.equal(lr.status, 401); assert.equal((await lr.json()).code, 'login_required'); delete process.env.DISABLE_IP_LIMIT; ok('non-owner paid account still gets 401 login_required');
  // funnel: owner scans/signups excluded, counted separately; recentScans marks internal
  const f = buildFunnel(db).total; assert.equal(f.internalScans, 8); assert.equal(f.internalScanStarted, 8); assert.equal(f.scanStarted, 3); assert.equal(f.scanDone, 3); assert.equal(f.signup, 3);
  ok('funnel: internalScans/internalScanStarted = 8, scanStarted/scanDone/signup count only the 3 real visitors');
  const st = await realFetch(B + '/api/internal/status', { headers: { 'x-status-token': process.env.STATUS_TOKEN || '' } });
  if (st.status === 200) { const s = await st.json(); const rs = s.recentScans.filter(x => ids.includes(x.reportId)); assert.ok(rs.length && rs.every(x => x.internal === true)); assert.ok(s.recentScans.some(x => x.internal === false)); ok('status recentScans: internal:true on owner scans'); }
  else { const src = fs.readFileSync(new URL('../src/status.js', import.meta.url), 'utf8'); assert.match(src, /internal: !!s\.internal/); ok('status recentScans maps internal (status token not configured in tests)'); }
  // spend cap still applies to the owner (live mode, fake key, cap 0): refused before any engine call
  process.env.SCAN_MODE = 'live'; process.env.OPENAI_API_KEY = 'sk-test-not-real'; process.env.LIVE_ENGINES = 'chatgpt'; process.env.DAILY_SPEND_CAP_USD = '0';
  const cap = await quiet(() => post('/api/scan', { ...biz(20), email: 'owner@example.test', lang: 'en' })); assert.equal(cap.status, 429); assert.match((await cap.json()).error, /spend|limit|cap/i); assert.equal(outbound.length, 0);
  delete process.env.SCAN_MODE; delete process.env.OPENAI_API_KEY; delete process.env.LIVE_ENGINES; delete process.env.DAILY_SPEND_CAP_USD;
  ok('DAILY_SPEND_CAP_USD still enforced for owner emails (429 with message, no engine call)');
  // captcha still required for the owner
  process.env.TURNSTILE_SECRET_KEY = 'sk'; process.env.TURNSTILE_SITE_KEY = 'pk'; const logs = []; const w = console.warn; console.warn = m => logs.push(String(m));
  try { const c = await post('/api/scan', { ...biz(30), email: 'owner@example.test' }); assert.equal(c.status, 403); assert.equal((await c.json()).code, 'captcha_required');
    const l = await post('/api/login', { email: 'owner@example.test' }); assert.equal(l.status, 403); assert.equal((await l.json()).code, 'captcha_required'); } finally { console.warn = w; delete process.env.TURNSTILE_SECRET_KEY; delete process.env.TURNSTILE_SITE_KEY; }
  assert.ok(logs.some(m => /\[turnstile\] token missing path=\/api\/scan/.test(m))); assert.ok(!logs.some(m => /example\.test/.test(m))); ok('owner still needs CAPTCHA; missing token logs a sanitized "[turnstile] token missing" line (no email)');
  // login captcha regression: the magic-link form has its own Turnstile widget and error slot
  const auth = fs.readFileSync(new URL('../web/components/Auth.tsx', import.meta.url), 'utf8'); const magicForm = auth.match(/<form onSubmit=\{sendMagic\}[^]*?<\/form>/)?.[0] || '';
  assert.match(magicForm, /<Turnstile /); assert.match(magicForm, /resetKey=\{mRk\}/); assert.match(magicForm, /<Err m=\{mErr\}/); assert.match(auth, /return setMErr\(t\.form\.captcha\)/);
  ok('login regression: magic-link form renders its own Turnstile (token is in its FormData) and shows its own error');
  for (const k of ['.env.example', 'docs/ANALYTICS.md']) assert.match(fs.readFileSync(new URL('../' + k, import.meta.url), 'utf8'), /OWNER_EMAILS=owner@example\.com|OWNER_EMAILS/); ok('.env.example and docs/ANALYTICS.md document OWNER_EMAILS');
  console.log(`owner: ${n} checks passed`);
} finally { srv.close(); TD.done(); }
