// UTM attribution: utm_source + utm_campaign (sanitized) on scans, accounts (first touch) and waitlist entries, JSON and Postgres store modes,
// never in public API output. Mock engines, no network.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { newDb } from 'pg-mem'; import { useTempData } from './helpers.js'; const TD = useTempData('utm');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES', 'SUMIT_API_KEY']) delete process.env[k];
process.env.DISABLE_IP_LIMIT = '1'; process.env.SCAN_RATE_MAX = '1000'; process.env.PRELAUNCH = '0'; process.env.UNSUBSCRIBE_SECRET = 'test-unsub-secret-0123456789';
const { cleanUtm, utmFrom, applyUtm } = await import('../src/utm.js'); let n = 0; const ok = m => { n++; console.log('  ✓', m); };
// 1. sanitizing
assert.equal(cleanUtm('x_post.day1-IL'), 'x_post.day1-IL'); assert.equal(cleanUtm('a'.repeat(64)), 'a'.repeat(64)); assert.equal(cleanUtm('a'.repeat(65)), null);
for (const bad of ['', 'has space', 'a/b', 'a@b.com', '<script>', 'שלום', 'x;y', 'a%20b', null, undefined, 5, ['x'], { a: 1 }, '4111111111111111', '123456789012']) assert.equal(cleanUtm(bad), null, JSON.stringify(bad));
assert.equal(cleanUtm('2026-10-24'), '2026-10-24'); assert.deepEqual(utmFrom({ utm_source: 'x', utm_campaign: 'bad value' }), { source: 'x', campaign: null }); assert.equal(utmFrom({ utm_source: '!', utm_campaign: '?' }), null); assert.equal(utmFrom(undefined), null);
const acc = {}; assert.equal(applyUtm(acc, { utm_source: 'a' }), true); assert.equal(applyUtm(acc, { utm_source: 'b', utm_campaign: 'c' }), false); assert.deepEqual(acc.utm, { source: 'a', campaign: null }, 'first touch is never overwritten'); ok('sanitizer: max 64 chars of [A-Za-z0-9_.-], otherwise dropped (not truncated); first touch only');
// 2. server, JSON store
const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
const post = (p, body) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const form = (p, body) => fetch(B + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
try {
  const A = { name: 'Utm Plumbing', category: 'Plumber', city: 'Haifa', email: 'u1@t.test', lang: 'en', utm_source: 'x_post', utm_campaign: 'day1-us' };
  const r = await post('/api/scan', A); assert.equal(r.status, 200); const { reportId } = await r.json(); const db = getDb();
  assert.deepEqual(db.scans[reportId].utm, { source: 'x_post', campaign: 'day1-us' }); const a1 = Object.values(db.accounts).find(a => a.email === 'u1@t.test'); assert.deepEqual(a1.utm, { source: 'x_post', campaign: 'day1-us' });
  // no utm / invalid utm -> no field at all; another scan of the same account keeps the first touch
  const r2 = await post('/api/scan', { ...A, email: 'u2@t.test', utm_source: 'bad value!', utm_campaign: 'c'.repeat(65) }); assert.equal(r2.status, 200); const id2 = (await r2.json()).reportId; assert.ok(!('utm' in db.scans[id2])); assert.ok(!('utm' in Object.values(db.accounts).find(a => a.email === 'u2@t.test')));
  const r3 = await post('/api/scan', { name: 'Other', category: 'x', city: 'y', email: 'u3@t.test' }); assert.equal(r3.status, 200); assert.ok(!('utm' in db.scans[(await r3.json()).reportId]));
  const h = await form('/scan', { name: 'Form Biz', category: 'Plumber', city: 'Haifa', email: 'u4@t.test', utm_source: 'fb', utm_campaign: 'grp' }); assert.equal(h.status, 302); const sid = /\/r\/(.+)$/.exec(h.headers.get('location'))[1]; assert.deepEqual(db.scans[sid].utm, { source: 'fb', campaign: 'grp' });
  // waitlist and checkout (account first touch; payment logic otherwise untouched)
  assert.equal((await post('/api/waitlist', { email: 'w1@t.test', lang: 'he', plan: 'starter', utm_source: 'li', utm_campaign: 'post1' })).status, 200); assert.deepEqual(db.waitlist.find(w => w.email === 'w1@t.test').utm, { source: 'li', campaign: 'post1' });
  assert.equal((await post('/api/waitlist', { email: 'w2@t.test' })).status, 200); assert.ok(!('utm' in db.waitlist.find(w => w.email === 'w2@t.test')));
  const c = await post('/api/checkout', { plan: 'starter', email: 'c1@t.test', utm_source: 'ph', utm_campaign: 'launch' }); assert.equal(c.status, 200, await c.text()); assert.deepEqual(Object.values(db.accounts).find(a => a.email === 'c1@t.test').utm, { source: 'ph', campaign: 'launch' });
  const c2 = await post('/api/checkout', { plan: 'starter', email: 'u1@t.test', utm_source: 'other' }); assert.equal(c2.status, 200); assert.deepEqual(a1.utm, { source: 'x_post', campaign: 'day1-us' });
  const cc = await post('/api/checkout', { plan: 'starter', email: 'c2@t.test', utm_source: '4111111111111111' }); assert.equal(cc.status, 400, 'the existing card-data guard still rejects a card-looking value (the web client never sends one: it drops 12+ digit values)'); assert.ok(!Object.values(db.accounts).some(a => a.email === 'c2@t.test'));
  // never public: report API, dashboard API, pages
  const rep = await (await fetch(`${B}/api/report/${reportId}`)).json(); assert.ok(!JSON.stringify(rep).includes('x_post') && !('utm' in rep.scan)); assert.equal(rep.scan.summary.checks > 0, true);
  const dash = await fetch(`${B}/api/dashboard/${a1.id}`, { headers: { 'x-dashboard-key': a1.key } }); assert.equal(dash.status, 200); assert.ok(!JSON.stringify(await dash.json()).includes('x_post'));
  assert.ok(!(await (await fetch(`${B}/api/config`)).text()).includes('utm')); ok('scan (JSON + form), account (first touch), waitlist and checkout store sanitized utm; invalid dropped; never in the public report/dashboard/config output');
} finally { srv.close(); }
// 3. Postgres mode: utm lives inside the JSON documents, so no schema change; survives save -> reload
{
  const S = await import('../src/store-pg.js'); const mem = newDb(); const { Pool } = mem.adapters.createPg(); const URL = 'postgres://u@h/db?sslmode=disable';
  const a = await S.createPgStore(URL, { Pool }); const d = a.db(); d.accounts.x = { id: 'x', email: 'a@b.test', plan: 'free', utm: { source: 's', campaign: 'c' } }; d.scans.s = { id: 's', utm: { source: 's', campaign: null }, summary: {} }; d.waitlist.push({ email: 'w@t.test', utm: { source: 'w', campaign: null } }); await a.save();
  const b = await S.createPgStore(URL, { Pool }); assert.deepEqual(b.db().accounts.x.utm, { source: 's', campaign: 'c' }); assert.deepEqual(b.db().scans.s.utm, { source: 's', campaign: null }); assert.deepEqual(b.db().waitlist[0].utm, { source: 'w', campaign: null });
  assert.equal(S.MIGRATIONS.some(m => /utm/i.test(m)), false); ok('Postgres store: utm round-trips inside the jsonb documents (nullable by construction, no migration needed)');
}
// 4. client wiring (static)
{
  const u = fs.readFileSync('web/lib/utm.ts', 'utf8'); assert.match(u, /sessionStorage/); assert.match(u, /\[A-Za-z0-9_\.-\]\{1,64\}/); assert.doesNotMatch(u, /document\.cookie|localStorage|fetch\(|navigator|referrer/);
  assert.match(fs.readFileSync('web/components/SiteChrome.tsx', 'utf8'), /captureUtm\(\)/); assert.match(fs.readFileSync('web/components/ScanProgress.tsx', 'utf8'), /\.\.\.getUtm\(\)/); const co = fs.readFileSync('web/components/Checkout.tsx', 'utf8'); assert.equal((co.match(/\.\.\.getUtm\(\)/g) || []).length, 2);
  for (const f of ['cookies', 'cookies.he']) assert.ok(fs.readFileSync(`legal/${f}.md`, 'utf8').includes('ranky-utm'), f); for (const f of ['privacy', 'privacy.he']) assert.ok(fs.readFileSync(`legal/${f}.md`, 'utf8').includes('utm_source'), f);
  assert.ok(!/CardForm/.test(u)); assert.doesNotMatch(fs.readFileSync('web/components/CardForm.tsx', 'utf8'), /utm_|getUtm|captureUtm/); ok('client captures utm from the landing URL into sessionStorage and sends it with /api/scan, /api/waitlist, /api/checkout (not the card step); cookie + privacy docs list it');
}
TD.done(); console.log(`ALL UTM TESTS PASSED (${n})`); process.exit(0);
