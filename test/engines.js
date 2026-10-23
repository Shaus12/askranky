// Live-scan honesty: engines that can't run live (not in LIVE_ENGINES / key missing / every call failed) are SKIPPED and reported,
// never faked with mock data; no runnable engine -> refuse (no spend, no mock); mock mode is unchanged; mock flags are accurate.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('eng');
for (const k of ['SCAN_MODE', 'LIVE_ENGINES', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'PERPLEXITY_API_KEY', 'DAILY_SPEND_CAP_USD']) delete process.env[k];
process.env.DISABLE_IP_LIMIT = '1'; process.env.SCAN_RATE_MAX = '100';
const { default: app } = await import('../server.js'); const { runScan } = await import('../src/scan.js'); const { engineStatus, getProvider } = await import('../src/providers/index.js');
const { engineNote } = await import('../src/engine-note.js'); const { renderWeeklyEmail } = await import('../src/email/report.js'); const V = await import('../src/views.js'); const { getDb } = await import('../src/store.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const realFetch = globalThis.fetch; let calls = []; let gemini402 = false;
const TEXT = '1. **Acme Plumbing** – fast\n2. **Other Plumber** – ok\n3. **Third Co** – fine';
globalThis.fetch = async (u, o) => { u = String(u);
  if (u.includes('api.openai.com')) { calls.push('chatgpt'); return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ text: TEXT, annotations: [] }] }], usage: {} }) }; }
  if (u.includes('generativelanguage.googleapis.com')) { calls.push('gemini'); return gemini402 ? { ok: false, status: 402, text: async () => 'no credit' } : { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: TEXT }] } }] }) }; }
  if (u.includes('perplexity.ai')) { calls.push('perplexity'); throw new Error('perplexity must not be called'); }
  return realFetch(u, o); };
const acct = () => ({ id: 'a' + Math.random(), plan: 'free', usage: {} }); const biz = () => ({ id: 'b' + Math.random(), name: 'Acme Plumbing', category: 'Plumber', city: 'Austin, TX', accountId: 'x' });
try {
  // mock mode unchanged
  let s = await runScan(acct(), biz()); assert.equal(s.mock, true); assert.deepEqual(s.summary.engines, { ran: ['chatgpt', 'gemini', 'perplexity'], skipped: [] }); assert.equal(s.summary.checks, 15);
  assert.ok(Object.values(s.summary.byEngine).every(e => e.mock === true)); assert.ok(s.results.every(r => r.mock)); assert.equal(calls.length, 0); ok('mock mode: all 3 engines run, scan.mock and per-engine mock are true, no network');
  // live: key for chatgpt + gemini, perplexity not in LIVE_ENGINES
  process.env.SCAN_MODE = 'live'; process.env.OPENAI_API_KEY = 'k1'; process.env.GEMINI_API_KEY = 'k2'; process.env.PERPLEXITY_API_KEY = 'k3'; calls = [];
  assert.deepEqual(engineStatus('perplexity'), { engine: 'perplexity', live: false, skipped: true, reason: 'not_enabled' }); assert.equal(getProvider('perplexity'), null);
  s = await runScan(acct(), biz()); assert.equal(s.mock, false); assert.deepEqual(s.summary.engines, { ran: ['chatgpt', 'gemini'], skipped: [{ engine: 'perplexity', reason: 'not_enabled' }] });
  assert.deepEqual(Object.keys(s.summary.byEngine), ['chatgpt', 'gemini']); assert.ok(s.results.every(r => !r.mock && r.engine !== 'perplexity')); assert.equal(s.summary.checks, 10); assert.ok(!calls.includes('perplexity'));
  assert.ok(Object.values(s.summary.byEngine).every(e => e.mock === false)); ok('live: perplexity (not in LIVE_ENGINES) is skipped with reason, not scored, not mocked, never called');
  // live: gemini key missing
  delete process.env.GEMINI_API_KEY; calls = []; s = await runScan(acct(), biz()); assert.deepEqual(s.summary.engines.skipped, [{ engine: 'gemini', reason: 'missing_key' }, { engine: 'perplexity', reason: 'not_enabled' }]);
  assert.deepEqual(s.summary.engines.ran, ['chatgpt']); assert.equal(s.summary.checks, 5); assert.ok(!('gemini' in s.summary.byEngine)); assert.ok(!calls.includes('gemini')); assert.equal(s.mock, false);
  const rate = s.results.filter(r => r.mentioned).length / s.results.length; assert.equal(s.summary.mentionRate, +rate.toFixed(2)); ok('live: missing GEMINI_API_KEY -> gemini skipped (missing_key), excluded from score/stats, no call made');
  // live: engine fails every call -> reported as skipped(failed)
  process.env.GEMINI_API_KEY = 'k2'; gemini402 = true; calls = []; s = await runScan(acct(), biz()); assert.deepEqual(s.summary.engines.ran, ['chatgpt']); assert.ok(s.summary.engines.skipped.some(x => x.engine === 'gemini' && x.reason === 'failed')); assert.ok(!('gemini' in s.summary.byEngine)); assert.equal(s.summary.checks, 5); gemini402 = false;
  ok('live: an engine whose every call failed (e.g. 402) is reported as skipped (failed), not scored');
  // live: nothing runnable -> refuse, no spend, no mock
  delete process.env.OPENAI_API_KEY; delete process.env.GEMINI_API_KEY; calls = []; const db = getDb(); const spendBefore = JSON.stringify(db.spend); const scansBefore = Object.keys(db.scans).length;
  await assert.rejects(() => runScan(acct(), biz()), e => e.code === 'NO_ENGINE' && /unavailable/.test(e.message) && /לא זמינות/.test(e.he)); assert.equal(calls.length, 0); assert.equal(JSON.stringify(db.spend), spendBefore); assert.equal(Object.keys(db.scans).length, scansBefore);
  const r = await realFetch(B + '/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Z', category: 'c', city: 'x', email: 'noeng@t.test' }) }); assert.equal(r.status, 503); const j = await r.json(); assert.equal(j.error, 'scan_unavailable'); assert.match(j.message, /unavailable/);
  assert.equal(Object.keys(getDb().scans).length, scansBefore); ok('live: no usable engine -> refuses (NO_ENGINE / HTTP 503 scan_unavailable), no spend, no scan stored, no mock results');
  // reporting
  process.env.OPENAI_API_KEY = 'k1'; s = await runScan(acct(), biz()); const note = engineNote(s.summary); assert.match(note, /Engines that ran: ChatGPT\./); assert.match(note, /Gemini \(not configured\)/); assert.match(note, /Perplexity \(not enabled yet\)/);
  const html = renderWeeklyEmail({ business: biz(), scan: s, prev: null, reportUrl: 'https://x/r/1', unsubscribeUrl: 'https://x/u' }); assert.match(html, /Engines that ran: ChatGPT\./); assert.match(html, /not included in the score/);
  assert.match(V.reportPage(biz(), s), /Engines that ran: ChatGPT\./); assert.ok(!V.reportPage(biz(), s).includes('MOCK MODE'));
  const i18n = fs.readFileSync('web/lib/i18n.ts', 'utf8'), rv = fs.readFileSync('web/components/ReportView.tsx', 'utf8'), apiTs = fs.readFileSync('web/lib/api.ts', 'utf8');
  assert.equal((i18n.match(/^  enginesNote: \{/gm) || []).length, 2); assert.match(i18n, /enginesNote: \{ ran: "מנועים שרצו:"/); assert.match(rv, /data-engines-note/); assert.match(apiTs, /engines: s\.engines/); assert.match(apiTs, /scan_unavailable/); assert.ok((i18n.match(/unavailable: "/g) || []).length >= 2);
  ok('report page, email and web UI (HE+EN) state which engines ran and which were skipped');
  console.log(`ALL ENGINE TESTS PASSED (${n})`);
} finally { globalThis.fetch = realFetch; srv.close(); TD.done(); }
process.exit(0);
