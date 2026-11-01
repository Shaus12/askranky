// utm1: per-source funnel (src/sources.js) in GET /api/internal/status -> funnel.sources. First touch, sanitized, bounded, no PII.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('sources');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'FUNNEL_FLUSH_MS', 'OWNER_EMAILS']) delete process.env[k];
const TOKEN = 'status-token-0123456789-abcdefghij'; Object.assign(process.env, { DISABLE_IP_LIMIT: '1', STATUS_TOKEN: TOKEN, STATUS_FAIL_MAX: '1000', SCAN_RATE_MAX: '1000', LAND_RATE_MAX: '100000', OWNER_EMAILS: 'boss@t.test' });
const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js'); const { flushVisits, resetFunnelMemory } = await import('../src/funnel.js');
const { utmFrom, cleanRef, srcOf } = await import('../src/utm.js'); const { TOP } = await import('../src/sources.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const FB = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.0;FBSS/3;FBLC/he_IL;FBOP/5]';
const FBA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36';
const land = (body, ua = UA, h = {}) => fetch(B + '/api/v/land', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': ua, ...h }, body: JSON.stringify(body) });
const post = (p, body, ua = UA) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': ua }, body: JSON.stringify(body) });
const status = async () => (await (await fetch(B + '/api/internal/status', { headers: { 'x-status-token': TOKEN } })).json());
const row = (rows, s, c = '-') => rows.find(r => r.source === s && r.campaign === c);
try {
  // 1. sanitizing (shared by beacon, scans, accounts)
  assert.deepEqual(utmFrom({ utm_source: 'facebook', utm_campaign: 'x', utm_medium: 'social' }), { source: 'facebook', campaign: 'x', medium: 'social' });
  assert.deepEqual(utmFrom({ utm_ref: 'l.facebook.com' }), { source: null, campaign: null, ref: 'facebook.com' }); assert.equal(utmFrom({ utm_source: 's', utm_ref: 'x.com' }).ref, undefined, 'ref only without utm');
  for (const bad of ['<b>x</b>.com', 'a b.com', 'evil.com/path', 'user@x.com', '127.0.0.1', 'x', 'a'.repeat(70) + '.com', 'שלום.com', null, 5]) assert.equal(cleanRef(bad), null, String(bad));
  assert.deepEqual(srcOf({ source: 'FaceBook', campaign: 'Post_1' }), { source: 'facebook', campaign: 'post_1', medium: '-' }); assert.equal(srcOf(null).source, 'direct');
  ok('sanitizer: utm values [A-Za-z0-9_.-]{1,64}, referrer = host name only (link-shim prefixes folded), odd values dropped, keys lower-cased');
  // 2. landing beacons: FB in-app browsers count; bots, monitors, empty UA do not; odd / HTML values fold to direct
  resetFunnelMemory();
  for (const ua of [FB, FBA, FB]) assert.equal((await land({ utm_source: 'facebook', utm_campaign: 'x', utm_medium: 'social' }, ua)).status, 204);
  await land({ utm_ref: 'l.facebook.com' }, FBA); await land({}, UA); await land({ utm_source: '<script>alert(1)</script>', utm_campaign: '"><img src=x>' }, UA);
  await land({ utm_source: 'facebook' }, 'facebookexternalhit/1.1'); await land({ utm_source: 'facebook' }, 'Googlebot/2.1'); await land({ utm_source: 'facebook' }, ''); await land({ utm_source: 'facebook' }, UA, { 'x-ranky-monitor': '1' });
  assert.equal((await fetch(B + '/api/v/land', { method: 'POST', headers: { 'user-agent': UA } })).status, 204, 'empty body tolerated');
  let s = (await status()).funnel.sources; let fbx = row(s.last7Days, 'facebook', 'x');
  assert.equal(fbx.visits, 3); assert.equal(fbx.visitors, 2, 'same IP+UA twice = one visitor'); assert.equal(fbx.medium, 'social'); assert.equal(row(s.last7Days, 'ref:facebook.com').visits, 1); assert.equal(row(s.last7Days, 'direct').visits, 3);
  assert.equal(s.last7Days.reduce((a, r) => a + r.visits, 0), 7, 'bots / monitors / empty UA excluded');
  ok('landing beacon: FBAN/FBIOS and FB_IAB counted per source/campaign/medium; referrer fallback; bots, link previews, X-Ranky-Monitor excluded');
  // 3. carried to scans, email unlock, signup, paid (guest gated flow) — first touch kept
  const r1 = await post('/api/scan', { name: 'Utm Bakery', city: 'Haifa', lang: 'he', utm_source: 'facebook', utm_campaign: 'x', utm_medium: 'social' }, FB); assert.equal(r1.status, 200); const { reportId } = await r1.json();
  assert.equal((await post(`/api/report/${reportId}/unlock`, { email: 'src1@t.test', lang: 'he' }, FB)).status, 200);
  const db = getDb(); const acc = Object.values(db.accounts).find(a => a.email === 'src1@t.test'); assert.deepEqual(acc.utm, { source: 'facebook', campaign: 'x', medium: 'social' });
  db.events.push({ at: new Date().toISOString(), type: 'order.paid', account: acc.id });
  assert.equal((await post('/api/scan', { name: 'Second', city: 'Haifa', lang: 'he', utm_ref: 'linkedin.com' })).status, 200);
  // owner scans stay out
  const ro = await post('/api/scan', { name: 'Own', city: 'Haifa', lang: 'he', utm_source: 'facebook', utm_campaign: 'x' }); const oid = (await ro.json()).reportId; await post(`/api/report/${oid}/unlock`, { email: 'boss@t.test', lang: 'he' });
  assert.equal(flushVisits() >= 0, true); s = (await status()).funnel.sources; fbx = row(s.last7Days, 'facebook', 'x');
  assert.deepEqual([fbx.visits, fbx.scanStarted, fbx.scanDone, fbx.emailUnlocked, fbx.signup, fbx.paid], [3, 1, 1, 1, 1, 1], JSON.stringify(fbx));
  assert.equal(row(s.last7Days, 'ref:linkedin.com').scanStarted, 1); assert.deepEqual(row(s.sinceTracking, 'facebook', 'x').visits, 3, 'persisted after flush');
  assert.ok(db.events.some(e => e.type === 'funnel.src_visits'), 'aggregate events'); for (const e of db.events.filter(e => e.type === 'funnel.src_visits')) assert.deepEqual(Object.keys(e).sort(), ['at', 'c', 'day', 'm', 'n', 's', 'type', 'u']);
  ok('first-touch source travels: scan_started, scanDone, emailUnlocked, signup, paid; owner (OWNER_EMAILS) scans excluded; flushed as aggregate {day,s,c,m,n,u} only');
  // 4. cardinality cap
  for (let i = 0; i < 40; i++) await land({ utm_source: 'spam' + i, utm_campaign: 'c' + i });
  s = (await status()).funnel.sources; assert.equal(s.last7Days.length, TOP + 1); const other = s.last7Days.at(-1); assert.equal(other.source, 'other'); assert.ok(other.groupedRows > 0); assert.equal(s.top, 20);
  assert.equal(s.last7Days.reduce((a, r) => a + r.visits, 0), 47, 'nothing lost in the bucket');
  ok('cardinality: top 20 rows per window, the rest summed into "other"');
  // 5. no leakage
  const txt = JSON.stringify(s); assert.ok(!/src1@|boss@|Utm Bakery|Mozilla|FBAN|127\.0\.0\.1|script|img/i.test(txt), 'no PII / HTML'); assert.ok(!/[<>]/.test(txt));
  const pub = await (await fetch(`${B}/api/report/${reportId}`)).text(); assert.ok(!pub.includes('social') && !pub.includes('"utm'), 'never public');
  assert.equal((await fetch(B + '/api/internal/status')).status, 404, 'status still token-protected');
  ok('no emails, names, UAs, IPs or HTML in the sources block; report API never returns utm; status stays token-only');
  // 6. client: first touch in sessionStorage + single beacon per tab; capture in SiteChrome on every page
  const w = fs.readFileSync('web/lib/utm.ts', 'utf8'); assert.match(w, /sessionStorage\.getItem\(KEY\) === null/); assert.match(w, /\/api\/v\/land/); assert.ok(!/document\.cookie|localStorage/.test(w)); assert.match(fs.readFileSync('web/components/SiteChrome.tsx', 'utf8'), /captureUtm\(\)/);
  // language / legacy redirects keep the query string (audit1), so the landing page still sees the utm
  for (const p of ['/', '/pricing', '/blog']) { const r = await fetch(B + p + '?utm_source=facebook&utm_campaign=x', { redirect: 'manual', headers: { 'user-agent': FB } }); assert.match(r.headers.get('location'), /\?utm_source=facebook&utm_campaign=x$/, p); }
  ok('client keeps first touch per tab in sessionStorage (no cookie / localStorage); redirects keep ?utm_ for the Facebook in-app browser');
} finally { srv.close(); }
console.log(`sources: ${n} passed`);
