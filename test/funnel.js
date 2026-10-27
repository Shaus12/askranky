// Analytics funnel (src/funnel.js) in GET /api/internal/status: first-party, aggregate, no cookies / client storage / third parties / PII.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('funnel');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'FUNNEL_FLUSH_MS']) delete process.env[k];
const TOKEN = 'status-token-0123456789-abcdefghij'; Object.assign(process.env, { DISABLE_IP_LIMIT: '1', STATUS_TOKEN: TOKEN, STATUS_FAIL_MAX: '1000' });
const { default: app } = await import('../server.js'); const { getDb, save, flush } = await import('../src/store.js'); const { flushVisits, resetFunnelMemory, countVisit } = await import('../src/funnel.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36' }; const get = (p, h = UA) => fetch(B + p, { headers: h, redirect: 'manual' });
const status = async () => (await (await fetch(B + '/api/internal/status', { headers: { 'x-status-token': TOKEN } })).json());
try {
  resetFunnelMemory();
  for (const p of ['/he', '/en', '/he/pricing', '/en/scan', '/he/blog']) { const r = await get(p); assert.equal(r.status, 200, p); assert.equal(r.headers.get('set-cookie'), null, p); }
  await get('/he', { 'user-agent': 'Googlebot/2.1' }); await get('/he', {}); await get('/he', { ...UA, 'sec-purpose': 'prefetch' }); await get('/en/nosuch'); await get('/api/config', UA); await get('/he/dashboard', UA);
  await new Promise(r => setTimeout(r, 50)); let s = await status(); assert.equal(s.funnel.today.visit, 5); assert.equal(s.funnel.total.visit, 5);
  ok('visit: counts 200 public page views only (bots, empty UA, prefetch, 404s, API and private pages excluded); no Set-Cookie');
  assert.equal(flushVisits(), 1); const ev = getDb().events.filter(e => e.type === 'funnel.visits'); assert.equal(ev.length, 1); assert.deepEqual(Object.keys(ev[0]).sort(), ['at', 'day', 'n', 'type']); assert.equal(ev[0].n, 5);
  s = await status(); assert.equal(s.funnel.today.visit, 5); ok('visits persist as aggregate {day, n} events only (no IP / UA / path / id); totals unchanged after flush');
  process.env.FUNNEL_FLUSH_MS = '0'; countVisit({ method: 'GET', path: '/he', get: k => (k === 'user-agent' ? UA['user-agent'] : '') }); assert.equal(getDb().events.filter(e => e.type === 'funnel.visits').length, 2); delete process.env.FUNNEL_FLUSH_MS; ok('flush interval FUNNEL_FLUSH_MS');
  // scan + checkout + paid (mock)
  let r = await fetch(B + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Funnel Cafe', category: 'Cafe', city: 'Haifa', email: 'f@t.test', lang: 'en' }) }); assert.equal(r.status, 200);
  r = await fetch(B + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'starter', email: 'f@t.test', lang: 'en' }) }); const j = await r.json(); assert.ok(j.redirectUrl);
  const ident = new URL(j.redirectUrl, B).searchParams.get('account'); r = await fetch(B + `/billing/return?Valid=1&Token=tok_test&Identifier=${encodeURIComponent(ident)}`); assert.equal(r.status, 200);
  getDb().accounts.t1 = { id: 't1', email: 'adm@t.test', plan: 'starter', adminTest: true, createdAt: new Date().toISOString() }; getDb().events.push({ at: new Date().toISOString(), type: 'subscription.activated', account: 't1' }); save();
  s = await status(); const f = s.funnel.today; assert.deepEqual([f.scanStarted, f.scanDone, f.signup, f.checkoutStarted, f.paid], [1, 1, 1, 1, 1]); assert.equal(s.funnel.last30Days.paid, 1);
  assert.equal(s.funnel.conversionLast30DaysPct.checkoutToPaid, 100); assert.ok(typeof s.funnel.conversionLast30DaysPct.visitToScan === 'number');
  ok('scan started → scan done → signup → checkout started → paid counted (today / 7d / 30d / total + conversion %); admin/test activity excluded');
  assert.ok(s.funnel.trackingSince && Date.parse(s.funnel.trackingSince) <= Date.now()); ok('trackingSince marks when visit/scanStarted counting began (older scans count as done but never as started)');
  assert.match(fs.readFileSync('server.js', 'utf8'), /process\.once\(sig[\s\S]{0,80}flushVisits\(\)/); ok('visits flushed on SIGTERM (deploy/restart)');
  const txt = JSON.stringify(s.funnel); assert.ok(!/f@t\.test|Funnel Cafe|t1|Mozilla|127\.0\.0\.1/.test(txt)); ok('funnel output has no personal data');
  const web = ['web/components', 'web/lib', 'web/app'].flatMap(d => fs.readdirSync(d, { recursive: true }).map(f => d + '/' + f)).filter(f => /\.(tsx?|css)$/.test(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
  assert.ok(!/googletagmanager|google-analytics|gtag\(|plausible|posthog|mixpanel|segment\.com|hotjar|clarity\.ms|facebook\.net\/.*fbevents/i.test(web)); ok('no third-party analytics / trackers in the web app');
  console.log(`ALL FUNNEL TESTS PASSED (${n})`);
} finally { srv.close(); await flush(); TD.done(); }
process.exit(0);
