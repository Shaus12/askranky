// Alerts: detection between consecutive scans (src/alert-detect.js), the scheduled re-scan + email job (src/alerts.js), its cron endpoint
// (inert unless ALERTS_ENABLED=1, not scheduled), the 'alerts' unsubscribe channel and the HE/EN email. Mock engines and outbox only.
import assert from 'node:assert/strict'; import { useTempData } from './helpers.js'; useTempData('alerts');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'CRON_SECRET', 'ALERTS_ENABLED', 'ALERT_SCAN_DAYS', 'MOCK_SEED', 'LIVE_ENGINES']) delete process.env[k];
Object.assign(process.env, { DISABLE_IP_LIMIT: '1', UNSUBSCRIBE_SECRET: 'test-unsub-secret-0123456789', BASE_URL: 'https://askranky.com' });
const realFetch = globalThis.fetch; const { default: app } = await import('../server.js'); const { getDb, save } = await import('../src/store.js');
const { detectAlerts } = await import('../src/alert-detect.js'); const { runAlerts } = await import('../src/alerts.js');
const { renderAlertEmail } = await import('../src/email/alerts.js'); const { canSend, setConsent, verifyUnsubToken, unsubToken } = await import('../src/consent.js');
const { recentAlerts } = await import('../src/dashboard.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const post = (p, h = {}) => realFetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: '{}' });
const r = (engine, mentioned, extra = {}) => ({ engine, question: 'q-' + engine + (extra.q || ''), mentioned, competitors: extra.competitors || [], citations: [], ...extra });
const scanOf = (id, results, summary) => ({ id, businessId: 'b1', at: new Date().toISOString(), results, summary });
try {
  // ---- detection ----
  const prev = scanOf('p', [r('chatgpt', true, { competitors: ['Clinic A'] }), r('gemini', true, { q: '2' })],
    { score: 60, byEngine: { chatgpt: { checks: 1, mentions: 1 }, gemini: { checks: 1, mentions: 1 } }, sentiment: { net: 50 }, facts: { conflicts: [{ type: 'city', said: 'Bat Yam' }], checks: [], matches: 0 } });
  const cur = scanOf('c', [r('chatgpt', false, { competitors: ['Clinic A', 'Clinic B'] }), r('gemini', false, { q: '2', competitors: ['Clinic A'] }), r('chatgpt', true, { question: 'q-chatgpt', sentiment: { tone: 'negative', phrases: [{ text: 'Sample Dental has long wait times.', tone: 'negative', cues: ['long wait'] }] } })],
    { score: 35, byEngine: { chatgpt: { checks: 2, mentions: 1 }, gemini: { checks: 1, mentions: 0 } }, sentiment: { net: 10, examples: [] },
      facts: { conflicts: [{ type: 'city', said: 'bat yam', engines: ['chatgpt'] }, { type: 'status', said: 'permanently closed', quote: 'Sample Dental – permanently closed.', engines: ['gemini'], count: 1 }], checks: [], matches: 0 } });
  const al = detectAlerts(prev, cur); const t = al.map(a => a.type);
  assert.deepEqual(al.filter(a => a.type === 'wrong_fact').map(a => a.fact.said), ['permanently closed']); ok('wrong_fact: only NEW wrong facts (the same wrong city again is not re-alerted)');
  const many = detectAlerts(prev, { ...cur, summary: { ...cur.summary, facts: { conflicts: [{ type: 'city', said: 'Cedar Park', engines: ['chatgpt'] }, { type: 'city', said: 'Georgetown', engines: ['gemini'] }], checks: [], matches: 0 } } }).filter(a => a.type === 'wrong_fact');
  assert.equal(many.length, 1); assert.deepEqual(many[0].fact.saids, ['Cedar Park', 'Georgetown']); assert.deepEqual(many[0].fact.engines, ['chatgpt', 'gemini']); ok('wrong_fact: several new wrong cities = one alert listing all of them');
  assert.ok(al.find(a => a.type === 'score_drop' && a.from === 60 && a.to === 35 && a.severity === 'high')); ok('score_drop: 60 → 35 is high (≥ 20 points)');
  assert.ok(al.find(a => a.type === 'engine_lost' && a.engine === 'gemini')); assert.ok(!al.find(a => a.type === 'engine_lost' && a.engine === 'chatgpt')); ok('engine_lost: Gemini named you before and not now');
  assert.deepEqual(al.filter(a => a.type === 'competitor_overtook').map(a => a.name), ['Clinic A']); ok('competitor_overtook: Clinic A (2 vs your 1, was 1 vs 2); Clinic B (1) does not beat you');
  const tone = al.find(a => a.type === 'tone_drop'); assert.equal(tone.from - tone.to, 40); assert.equal(tone.example.text, 'Sample Dental has long wait times.'); ok('tone_drop: net fell 40 points, example = the new negative sentence');
  assert.equal(al[0].severity, 'high'); assert.ok(t.indexOf('competitor_overtook') > t.indexOf('engine_lost')); ok('alerts sorted: high first');
  assert.deepEqual(detectAlerts(null, cur), []); assert.deepEqual(detectAlerts(prev, prev), []); assert.deepEqual(detectAlerts({ ...prev, businessId: 'other' }, cur), []); ok('no previous scan / no change / another business → no alerts');
  const legacy = { ...prev, summary: { ...prev.summary, facts: undefined } };
  assert.equal(detectAlerts(legacy, cur).filter(a => a.type === 'wrong_fact').length, 0); assert.ok(detectAlerts(legacy, cur).some(a => a.type === 'score_drop')); ok('legacy previous scan (no facts) → no wrong_fact alerts, other alerts still work');
  const free5 = { ...prev, results: [...prev.results, r('chatgpt', true, { q: '9' })] };
  const qa = detectAlerts(free5, cur).map(a => a.type); assert.ok(!qa.includes('score_drop') && !qa.includes('competitor_overtook')); assert.ok(qa.includes('engine_lost')); ok('different question counts (free 5 vs paid 15) → no score_drop / competitor_overtook');
  assert.equal(recentAlerts([{ ...prev, alerts: [] }, { ...cur, alerts: al }]).length, al.length); assert.equal(recentAlerts([{ ...cur, alerts: al }])[0].scanId, 'c'); ok('dashboard: recent alerts carry their scan id and date');

  // ---- consent channel ----
  const acc = { id: 'acc1' }; assert.equal(canSend(acc, 'alerts'), true); setConsent(acc, 'alerts', false, 't'); assert.equal(canSend(acc, 'alerts'), false); assert.equal(canSend(acc, 'weekly'), true);
  const all = { id: 'acc2' }; setConsent(all, 'all', false, 't'); assert.equal(canSend(all, 'alerts'), false); assert.deepEqual(verifyUnsubToken(unsubToken('acc1', 'alerts')), { accountId: 'acc1', channel: 'alerts' });
  ok("'alerts' channel: on by default (part of the plan), separate opt-out, 'all' turns it off too, signed unsubscribe token");

  // ---- email ----
  const m = renderAlertEmail({ business: { name: '<b>Sample</b> Dental' }, scan: { id: 'c' }, alerts: al, lang: 'en', base: 'https://askranky.com', accountId: 'acc1', unsubscribeUrl: 'https://askranky.com/unsubscribe?t=x' });
  assert.match(m.subject, /alert: 5 things changed/); assert.ok(m.html.includes('&lt;b&gt;Sample&lt;/b&gt;') && !m.html.includes('<b>Sample</b>')); assert.ok(m.html.includes('permanently closed') && m.html.includes('/en/dashboard/acc1') && m.html.includes('Stop alert emails'));
  const mh = renderAlertEmail({ business: { name: 'שן לדוגמה' }, scan: { id: 'c' }, alerts: al.slice(0, 1), lang: 'he', base: 'https://askranky.com', accountId: 'acc1', unsubscribeUrl: 'https://askranky.com/u' });
  assert.match(mh.subject, /^התראה מ־Ranky: משהו השתנה/); assert.match(mh.html, /dir="rtl"/); ok('email: EN/HE subject + RTL, escaped business name, dashboard + report + unsubscribe links');

  // ---- job ----
  const db = getDb(); const day = 864e5; const mk = (id, plan, extra = {}) => { db.accounts[id] = { id, key: 'k', email: id + '@t.test', plan, usage: {}, createdAt: new Date().toISOString(), ...extra };
    db.businesses['b-' + id] = { id: 'b-' + id, accountId: id, name: 'Clinic ' + id, category: 'Dentist', city: 'Holon', scanIds: [] }; return db.businesses['b-' + id]; };
  const sub = { subscriptionRef: 'so-1', status: 'active' }; mk('paid', 'starter', sub); mk('ended', 'starter', { subscriptionRef: 'so-2', status: 'cancelled_ended' }); mk('nosub', 'starter'); mk('free1', 'free'); mk('comp1', 'pro', { comp: { plan: 'pro' } }); mk('out', 'starter', { emailPrefs: { alerts: false }, ...sub }); const fresh = mk('fresh', 'starter', sub);
  db.scans.fs = { id: 'fs', businessId: fresh.id, accountId: 'fresh', at: new Date(Date.now() - 2 * day).toISOString(), results: [], summary: {} }; fresh.scanIds = ['fs']; save();
  const sent = []; const send = async msg => { sent.push(msg); return true; };
  let out = await runAlerts({ send }); assert.equal(out.scanned, 1); assert.equal(out.alerted, 0); assert.equal(out.skipped.fresh, 1); assert.equal(out.skipped.opted_out, 1); assert.equal(sent.length, 0);
  assert.ok(!db.businesses['b-ended'].scanIds.length && !db.businesses['b-nosub'].scanIds.length && !db.businesses['b-comp1'].scanIds.length);
  ok('job: re-scans only paid (active subscription; ended / no subscription / comp skipped), non-comp, not-opted-out businesses whose last scan is older than ALERT_SCAN_DAYS; first scan has nothing to compare → no email');
  const b = db.businesses['b-paid']; const last = db.scans[b.scanIds.at(-1)]; last.at = new Date(Date.now() - 8 * day).toISOString(); last.summary.score = 99; save();
  out = await runAlerts({ send, now: new Date() }); assert.equal(out.alerted, 1); assert.equal(sent.length, 1); assert.equal(sent[0].kind, 'alerts'); assert.ok(sent[0].headers['List-Unsubscribe']);
  const newest = db.scans[b.scanIds.at(-1)]; assert.ok(newest.alerts.some(a => a.type === 'score_drop')); assert.ok(newest.alertsSentAt); assert.ok(db.events.some(e => e.type === 'email.alerts_sent' && e.account === 'paid'));
  ok('job: a week later the re-scan finds a drop → one alert email (List-Unsubscribe), scan marked alertsSentAt, event logged');
  out = await runAlerts({ send }); assert.equal(sent.length, 1); assert.equal(out.skipped.fresh, 2); ok('job: running again right away re-scans nothing and sends nothing');

  // ---- endpoint ----
  assert.equal((await post('/api/internal/cron/alerts', { 'X-Cron-Secret': 'x' })).status, 404); process.env.CRON_SECRET = 'cron-secret-0123456789abcdef-XYZ';
  assert.equal((await post('/api/internal/cron/alerts', { 'X-Cron-Secret': 'wrong-wrong-wrong-wrong' })).status, 401);
  let j = await (await post('/api/internal/cron/alerts', { 'X-Cron-Secret': process.env.CRON_SECRET })).json(); assert.deepEqual(j, { ok: true, skipped: 'alerts_disabled' });
  process.env.ALERTS_ENABLED = '1'; j = await (await post('/api/internal/cron/alerts', { 'X-Cron-Secret': process.env.CRON_SECRET })).json(); assert.equal(j.ok, true); assert.ok(j.ranAt);
  ok('cron endpoint: no secret → 404, wrong secret → 401, ALERTS_ENABLED unset → skipped, enabled → runs');
  const pk = JSON.stringify(JSON.parse((await import('node:fs')).readFileSync('package.json', 'utf8')).scripts); assert.ok(!/cron\/alerts/.test(pk)); ok('not scheduled by the app or npm scripts');
  const i18n = (await import('node:fs')).readFileSync('web/lib/i18n.ts', 'utf8'); assert.equal((i18n.match(/"Dashboard alerts when AI gets something wrong about you \(email alerts coming soon\)"/g) || []).length, 3); assert.equal((i18n.match(/"התראות בדשבורד כשה־AI טועה לגביך \(התראות במייל בקרוב\)"/g) || []).length, 3);
  assert.ok(!/"Alerts when AI[^"]*"[^\n]*id: "free"|id: "free"[^\n]*Alerts when AI/.test(i18n)); ok('pricing: every paid plan (he/en) lists alerts; the free plan does not');
  console.log(`ALL ALERTS TESTS PASSED (${n})`);
} finally { srv.close(); }
