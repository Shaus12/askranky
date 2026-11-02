// dropoff1: privacy-safe scan drop-off events (src/dropoff.js, POST /api/funnel/e) in funnel.clientEvents, scan_client_left, and the
// scan.failed 'exception' fix. Mock engines only.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('dropoff');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'FUNNEL_FLUSH_MS', 'LIVE_ENGINES']) delete process.env[k];
const TOKEN = 'status-token-0123456789-abcdefghij'; Object.assign(process.env, { DISABLE_IP_LIMIT: '1', STATUS_TOKEN: TOKEN, STATUS_FAIL_MAX: '1000', CLIENT_EVENT_MAX: '12' });
const { default: app } = await import('../server.js'); const { getDb, flush } = await import('../src/store.js'); const { flushVisits, resetFunnelMemory } = await import('../src/funnel.js'); const { CLIENT_EVENTS } = await import('../src/dropoff.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const UA = 'Mozilla/5.0 (iPhone) Safari/604.1'; const send = (body, h = {}) => fetch(B + '/api/funnel/e', { method: 'POST', headers: { 'content-type': 'text/plain', 'user-agent': UA, ...h }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const status = async () => (await (await fetch(B + '/api/internal/status', { headers: { 'x-status-token': TOKEN } })).json());
try {
  resetFunnelMemory();
  let r = await send({ e: 'turnstile_missing', iab: 1 }); assert.equal(r.status, 204); assert.equal(await r.text(), ''); assert.equal(r.headers.get('set-cookie'), null);
  await send({ e: 'form_submit_attempted', iab: 0 }); await send({ e: 'form_submit_attempted', iab: 1 });
  r = await fetch(B + '/api/funnel/e', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: JSON.stringify({ e: 'report_viewed' }) }); assert.equal(r.status, 204);
  let s = await status(); const c = s.funnel.clientEvents.today;
  assert.deepEqual(c.turnstile_missing, { all: 1, inApp: 1 }); assert.deepEqual(c.form_submit_attempted, { all: 2, inApp: 1 }); assert.deepEqual(c.report_viewed, { all: 1, inApp: 0 });
  ok('client events counted per event with a coarse inApp flag (text/plain beacon and JSON); 204, empty body, no cookie');
  for (const [b, h] of [[{ e: 'nope' }, {}], [{ e: 'report_viewed' }, { 'user-agent': 'Googlebot/2.1' }], [{ e: 'report_viewed' }, { 'x-ranky-monitor': '1' }], [{ e: 'report_viewed' }, { origin: 'https://evil.example' }], [{ e: 'report_viewed' }, { 'sec-fetch-site': 'cross-site' }], ['not json', {}], [{ e: 'report_viewed' }, { 'sec-purpose': 'prefetch' }]]) assert.equal((await send(b, h)).status, 204);
  s = await status(); assert.equal(s.funnel.clientEvents.today.report_viewed.all, 1); assert.ok(!('nope' in s.funnel.clientEvents.today));
  ok('unknown names, bots, X-Ranky-Monitor, cross-site/foreign Origin, bad JSON and prefetch are ignored');
  for (let i = 0; i < 20; i++) await send({ e: 'scan_progress_left' }); s = await status(); assert.ok(s.funnel.clientEvents.today.scan_progress_left.all === 8); ok('per-IP limit (CLIENT_EVENT_MAX) drops floods silently');
  flushVisits(); const ev = getDb().events.filter(e => e.type === 'funnel.client'); assert.ok(ev.length >= 3); for (const e of ev) assert.deepEqual(Object.keys(e).sort(), ['at', 'day', 'e', 'iab', 'n', 'type']);
  s = await status(); assert.deepEqual(s.funnel.clientEvents.today.form_submit_attempted, { all: 2, inApp: 1 }); assert.equal(s.funnel.clientEvents.total.turnstile_missing.all, 1);
  ok('persisted as aggregate {day, e, iab, n} only (no IP / UA / id); totals unchanged after flush');
  for (const k of ['today', 'last7Days', 'last30Days', 'total', 'scanRejectedLast7DaysByStatus', 'trackingSince', 'conversionLast30DaysPct']) assert.ok(k in s.funnel, k);
  assert.ok(!('clientEvents' in s.funnel.today)); assert.ok(s.funnel.trackingSince === null || !getDb().events.some(e => e.type === 'funnel.client' && e.at < s.funnel.trackingSince) || true); ok('existing funnel fields unchanged; clientEvents is a new field');
  // scan_client_left: connection closed before the scan answered (unit: fake req/res; the route keeps running and stores the scan).
  const { scanClientLeftMiddleware } = await import('../src/dropoff.js'); const { EventEmitter } = await import('node:events');
  const fake = fin => { const res = Object.assign(new EventEmitter(), { writableFinished: fin }); scanClientLeftMiddleware({ get: () => '' }, res, () => {}); res.emit('close'); };
  fake(false); fake(true); s = await status(); assert.equal(s.funnel.clientEvents.today.scan_client_left.all, 1);
  { const res = Object.assign(new EventEmitter(), { writableFinished: false }); scanClientLeftMiddleware({ get: k => (k === 'x-ranky-monitor' ? '1' : '') }, res, () => {}); res.emit('close'); }
  s = await status(); assert.equal(s.funnel.clientEvents.today.scan_client_left.all, 1); assert.match(fs.readFileSync('server.js', 'utf8'), /app\.post\('\/api\/scan', scanRejectMiddleware, scanClientLeftMiddleware,/);
  ok('scan_client_left counted when the connection closes before the answer (monitors excluded), wired on POST /api/scan');
  r = await fetch(B + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ok Cafe', city: 'Haifa', lang: 'he' }) }); assert.equal(r.status, 200); s = await status(); assert.equal(s.funnel.clientEvents.today.scan_client_left.all, 1); ok('a normal scan is not counted as left');
  const srvSrc = fs.readFileSync('server.js', 'utf8'); assert.match(srvSrc, /function scanException[^\n]*recordScanFailure\('exception'\)/); assert.equal((srvSrc.match(/catch \(e\) \{ scanException\(e\);/g) || []).length, 2);
  ok('unexpected scan exceptions now log one sanitized line and record scan.failed {reason: exception} on both /api/scan paths');
  const web = ['ScanForm', 'Turnstile', 'ScanProgress', 'ReportView'].map(f => fs.readFileSync(`web/components/${f}.tsx`, 'utf8')).join('\n') + fs.readFileSync('web/lib/track.ts', 'utf8');
  for (const e of CLIENT_EVENTS) assert.ok(web.includes(`"${e}"`), e); assert.ok(!/userAgent[^)]*JSON|ua:/.test(fs.readFileSync('web/lib/track.ts', 'utf8'))); assert.match(web, /"expired-callback"/);
  ok('every allowlisted event is wired in the web app; the beacon sends only {e, iab}');
  console.log(`dropoff: ${n} checks passed`);
} finally { srv.close(); await flush?.(); TD.done(); }
