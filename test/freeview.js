// free-view (trade1 B): the locked free view shows the basic result (score, every business named, exact Q+A text); the email unlock adds
// the 3-fix plan, sources and an opt-in weekly re-check request (stored as queued; nothing runs it yet). Mock engines only.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('freeview');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES', 'DAILY_SPEND_CAP_USD', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY', 'DATABASE_URL']) delete process.env[k];
process.env.SCAN_RATE_MAX = '1000'; process.env.UNLOCK_RATE_MAX = '1000'; process.env.DISABLE_IP_LIMIT = '1';
const realFetch = globalThis.fetch;
const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js'); const { buildFunnel } = await import('../src/funnel.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
const outbound = []; globalThis.fetch = async (u, o) => { u = String(u); if (u.startsWith(B)) return realFetch(u, o); outbound.push(u); throw new Error('outbound fetch blocked in tests'); };
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const post = (p, body) => realFetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = p => realFetch(B + p).then(r => r.json());
try {
  const j = await (await post('/api/scan', { name: 'Sample Pipes', trade: 'plumber', city: 'חיפה', lang: 'he' })).json(); const db = getDb(); const s = db.scans[j.reportId];
  const p = await get(`/api/report/${j.reportId}`); assert.equal(p.locked, true);
  assert.equal(p.scan.answers.length, s.results.filter(r => !r.error).length); assert.ok(p.scan.answers.length > 0);
  p.scan.answers.forEach((a, i) => { const r = s.results.filter(x => !x.error)[i]; assert.equal(a.text, r.answer); assert.equal(a.question, r.question); assert.equal(a.engine, r.engine); assert.equal(a.mentioned, !!r.mentioned); assert.deepEqual(Object.keys(a).sort(), ['engine', 'mentioned', 'question', 'text']); });
  ok('locked view: every successful answer, verbatim, with question/engine/mentioned only');
  assert.deepEqual(p.scan.summary.topCompetitors, s.summary.topCompetitors.map(c => ({ name: c.name, count: c.count }))); assert.equal(p.hiddenCompetitors, 0); ok('locked view: the same named-business list as the full report (nothing hidden)');
  const raw = JSON.stringify(p); for (const k of ['fixes', 'topCitedHosts', 'citations', 'sentiment', 'facts', 'alerts', 'byEngine', 'rank', 'avgRank', 'mentionRate', 'website', 'estCostUsd', 'history', 'usage']) assert.ok(!raw.includes(`"${k}"`), `leaks ${k}`);
  assert.equal(p.fixCount, s.fixes.length); assert.ok(s.fixes.length >= 1); ok('still withheld until unlock: fix plan text, sources, rank, sentiment, cost, history (only the fix count is sent)');
  const u = await (await post(`/api/report/${j.reportId}/unlock`, { email: 'fv@example.test', lang: 'he', weeklyRecheck: 'on' })).json(); assert.equal(u.recheck, 'queued');
  const acc = Object.values(db.accounts).find(a => a.email === 'fv@example.test'); assert.equal(acc.recheck.optIn, true); assert.equal(acc.recheck.status, 'queued'); assert.equal(acc.recheck.businessId, s.businessId);
  assert.ok(db.events.some(e => e.type === 'recheck.optin' && e.account === acc.id)); assert.equal(buildFunnel(db).total.emailUnlocked, 1);
  const full = await get(`/api/report/${j.reportId}`); assert.ok(!full.locked); assert.equal(full.scan.fixes.length, s.fixes.length); ok('unlock with weeklyRecheck: opt-in stored as queued + recheck.optin event; full report has the fix plan; emailUnlocked counted');
  const j2 = await (await post('/api/scan', { name: 'Sample Two', trade: 'gym', city: 'Haifa', lang: 'en' })).json(); const u2 = await (await post(`/api/report/${j2.reportId}/unlock`, { email: 'fv2@example.test' })).json();
  assert.equal(u2.recheck, undefined); assert.equal(Object.values(db.accounts).find(a => a.email === 'fv2@example.test').recheck, undefined); ok('no checkbox -> no re-check request stored (consent is explicit)');
  assert.equal(outbound.length, 0);
  const g = fs.readFileSync('web/lib/gate.ts', 'utf8'); assert.match(g, /עוד לא פועלת/); assert.match(g, /not running yet/); assert.ok(!/dent|שיניים|perplexity|claude|copilot/i.test(g));
  const lr = fs.readFileSync('web/components/LockedReport.tsx', 'utf8'); assert.match(lr, /data-free-answers/); assert.match(lr, /name="weeklyRecheck"/); assert.match(lr, /defaultChecked=\{false\}/);
  ok('UI: answers block + unticked weekly opt-in; copy says the free weekly re-check is not running yet');
  console.log(`freeview: ${n} checks passed`);
} finally { srv.close(); TD.done(); }
