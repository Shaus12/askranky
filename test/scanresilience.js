// Scan resilience: per-call timeout, parallel engines with stable ordering, one engine down -> partial scan, both down -> NO_ENGINE
// logged + counted in status (sanitized), Gemini model fallback on 404. Fake fetch only: no real provider calls.
import assert from 'node:assert/strict'; import { useTempData } from './helpers.js'; const TD = useTempData('resil');
for (const k of ['SCAN_MODE', 'LIVE_ENGINES', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'PERPLEXITY_API_KEY', 'DAILY_SPEND_CAP_USD', 'GEMINI_MODEL', 'GEMINI_MODEL_FALLBACK', 'OPENAI_MODEL_FALLBACK', 'SCAN_CONCURRENCY']) delete process.env[k];
process.env.SCAN_MODE = 'live'; process.env.OPENAI_API_KEY = 'sk-SECRETKEY1234567890abcdef'; process.env.GEMINI_API_KEY = 'AIzaSECRETKEY1234567890'; process.env.SCAN_CALL_TIMEOUT_MS = '200';
const { runScan } = await import('../src/scan.js'); const { getDb } = await import('../src/store.js'); const { buildFunnel } = await import('../src/funnel.js'); const { buildStatus } = await import('../src/status.js');
const keep = setInterval(() => {}, 1000); let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const TEXT = '1. **Acme Plumbing** – fast\n2. **Other Plumber** – ok';
const good = () => ({ ok: true, json: async () => ({ output: [{ type: 'message', content: [{ text: TEXT, annotations: [] }] }], candidates: [{ content: { parts: [{ text: TEXT }] } }], usage: {} }) });
const hang = signal => new Promise((_, rej) => signal.addEventListener('abort', () => rej(signal.reason)));
let mode = {}; let inflight = 0, peak = 0; const models = [];
globalThis.fetch = async (u, o) => { u = String(u); const eng = u.includes('openai') ? 'chatgpt' : 'gemini'; if (eng === 'gemini') models.push(u.split('/models/')[1].split(':')[0]);
  inflight++; peak = Math.max(peak, inflight);
  try { const m = mode[eng];
    if (m === 'hang') return await hang(o.signal);
    if (m === 'fail') return { ok: false, status: 429, text: async () => `quota exceeded for key ${process.env.OPENAI_API_KEY} user shai@example.com` };
    if (m === '404' && u.includes('gemini-3')) return { ok: false, status: 404, text: async () => 'models/gemini-3 is not found' };
    await new Promise(r => setTimeout(r, mode.slow ? 100 : 20 + Math.random() * 30)); return good();
  } finally { inflight--; } };
const logs = []; const origErr = console.error, origWarn = console.warn; console.error = (...a) => logs.push(a.join(' ')); console.warn = (...a) => logs.push(a.join(' '));
const acct = () => ({ id: 'a' + Math.random(), plan: 'free', usage: {} }); const biz = () => ({ id: 'b' + Math.random(), name: 'Acme Plumbing', category: 'Plumber', city: 'Austin, TX', accountId: 'x' });
try {
  // parallel + ordering
  await runScan(acct(), biz()); mode = { slow: 1 }; peak = 0; let t = Date.now(); let s = await runScan(acct(), biz()); const dt = Date.now() - t; mode = {};
  assert.equal(s.results.length, 10); assert.ok(peak >= 2, 'calls overlap'); assert.ok(dt < 10 * 100 * 0.6, `parallel (${dt}ms)`);
  const qs = [...new Set(s.results.map(r => r.question))]; assert.deepEqual(s.results.map(r => r.engine), qs.flatMap(() => ['chatgpt', 'gemini'])); assert.deepEqual(s.results.map(r => r.question), qs.flatMap(q => [q, q]));
  ok(`engines/questions run in parallel (peak ${peak} in flight) and results keep question-then-engine order`);
  // timeout on one engine -> partial scan
  mode = { gemini: 'hang' }; t = Date.now(); logs.length = 0; s = await runScan(acct(), biz()); assert.ok(Date.now() - t < 2000);
  assert.deepEqual(s.summary.engines.ran, ['chatgpt']); assert.ok(s.summary.engines.skipped.some(x => x.engine === 'gemini' && x.reason === 'failed'));
  assert.ok(s.results.filter(r => r.engine === 'gemini').every(r => /timeout/.test(r.error))); assert.ok(logs.some(l => /engine=gemini q=0 status=timeout/.test(l)));
  ok('a hanging engine is aborted after SCAN_CALL_TIMEOUT_MS, logged, and the scan completes with the other engine (gemini skipped: failed)');
  // both fail -> NO_ENGINE, sanitized log + status
  mode = { chatgpt: 'fail', gemini: 'hang' }; logs.length = 0; const before = Object.keys(getDb().scans).length;
  await assert.rejects(() => runScan(acct(), biz()), e => e.code === 'NO_ENGINE'); assert.equal(Object.keys(getDb().scans).length, before);
  const line = logs.find(l => /NO_ENGINE/.test(l)); assert.match(line, /chatgpt=429/); assert.match(line, /gemini=timeout/);
  const all = logs.join('\n'); assert.ok(!all.includes('SECRETKEY') && !all.includes('shai@example.com'), 'no keys or emails in logs');
  const f = buildFunnel(getDb()); assert.equal(f.today.scanFailed, 1); assert.equal(f.scanFailedLast7DaysByReason.no_engine, 1); assert.equal(f.lastScanFailure.reason, 'no_engine');
  assert.deepEqual(f.lastScanFailure.engines.map(x => [x.engine, x.status]), [['chatgpt', 429], ['gemini', 'timeout']]);
  const st = JSON.stringify(buildStatus()); assert.ok(!st.includes('SECRETKEY') && !st.includes('shai@example.com')); assert.ok('scanStarted' in buildStatus().funnel.today);
  const errs = Object.values(getDb().events).filter(e => e.type === 'scan.failed'); assert.ok(errs.every(e => !('account' in e)));
  ok('both engines failing -> NO_ENGINE, one log line with each engine\'s status, scanFailed + lastScanFailure in status, no secrets/emails');
  // gemini model fallback
  mode = { gemini: '404' }; process.env.GEMINI_MODEL = 'gemini-3-flash-preview'; models.length = 0; s = await runScan(acct(), biz());
  assert.deepEqual(s.summary.engines.ran, ['chatgpt', 'gemini']); assert.ok(models.includes('gemini-2.5-flash'));
  process.env.GEMINI_MODEL_FALLBACK = ''; s = await runScan(acct(), biz()); assert.deepEqual(s.summary.engines.ran, ['chatgpt']);
  ok('Gemini 404 (model retired) falls back to GEMINI_MODEL_FALLBACK (default gemini-2.5-flash); empty disables it');
  // no engine configured counted too
  delete process.env.OPENAI_API_KEY; delete process.env.GEMINI_API_KEY; await assert.rejects(() => runScan(acct(), biz()), e => e.code === 'NO_ENGINE');
  assert.equal(buildFunnel(getDb()).scanFailedLast7DaysByReason.no_engine_configured, 1); ok('no configured engine -> scanFailed reason no_engine_configured');
} finally { console.error = origErr; console.warn = origWarn; }
console.log(`scanresilience: ${n} passed`); clearInterval(keep); TD.done(); process.exit(0);
