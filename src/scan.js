import { isOwnerEmail } from './owner.js';
import { ENGINES, getProvider, engineStatus, isMockMode } from './providers/index.js';
import { analyzeAnswer } from './extract.js';
import { summarizeResults } from './summary.js';
import { buildQuestions } from './questions.js';
import { checkBudget, recordSpend } from './costs.js';
import { COST_PER_CHECK, PLANS } from './plans.js';
import { buildFixes } from './fixes.js';
import { sentimentFor } from './sentiment.js';
import { factCheck } from './factcheck.js';
import { detectAlerts } from './alert-detect.js';
import { getDb, save, id } from './store.js'; import { sanitize } from './providers/http.js';
// Aggregate 'scan.failed' event (reason + sanitized per-engine last error; no account, email, prompt or key) for the status endpoint.
export function recordScanFailure(reason, engines = []) { try { getDb().events.push({ at: new Date().toISOString(), type: 'scan.failed', reason, engines }); save(); } catch {} }

export const NO_ENGINE_MESSAGE = { en: 'Live scans are temporarily unavailable (no AI engine is available right now). Please try again later.', he: 'הסריקות האמיתיות לא זמינות כרגע (אף מנוע AI לא זמין). נסו שוב מאוחר יותר.' };
// planOverride: a product (e.g. PRODUCTS.fixup) whose question count / competitors / check budget apply instead of the account's plan.
export async function runScan(account, business, { engines = ENGINES, maxQuestions, utm = null, planOverride = null, auto = false } = {}) {
  const plan = planOverride || PLANS[account.plan];
  const questions = buildQuestions(business, Math.min(plan.questionsPerBusiness, maxQuestions || Infinity));
  // Engines that cannot run live (not enabled / key missing) are skipped, never faked. No runnable engine: refuse before any spend.
  const skipped = engines.map(engineStatus).filter(st => st.skipped).map(st => ({ engine: st.engine, reason: st.reason }));
  const active = engines.filter(e => !skipped.some(x => x.engine === e));
  if (!active.length) { console.error(`[scan] NO_ENGINE: no live engine configured (${skipped.map(x => `${x.engine}=${x.reason}`).join(' ')})`); recordScanFailure('no_engine_configured', skipped.map(x => ({ engine: x.engine, status: x.reason }))); }
  if (!active.length) throw Object.assign(new Error(NO_ENGINE_MESSAGE.en), { code: 'NO_ENGINE', he: NO_ENGINE_MESSAGE.he, skipped });
  // owner1: OWNER_EMAILS accounts are internal (outreach scans): no per-account monthly check budget, but DAILY_SPEND_CAP_USD still applies.
  const internal = isOwnerEmail(account.email);
  const budget = checkBudget(account, active, questions.length, active.filter(e => !getProvider(e).mock), internal ? { ...plan, monthlyCheckBudget: Infinity } : plan);
  if (!budget.ok) throw Object.assign(new Error(budget.reason), { code: 'CAP', he: budget.reasonHe });
  // Funnel 'scan started': recorded HERE, the one place every scan path goes through (free form, /api/scan, dashboard re-scans, weekly,
  // alerts), so scanStarted >= scanDone. Automatic re-scans and Fix-up scans are excluded, matching scanDone in src/funnel.js.
    if (!auto && !planOverride) { try { getDb().events.push({ at: new Date().toISOString(), type: 'funnel.scan_started', account: account.id, ...(internal ? { internal: true } : {}) }); save(); } catch {} }

  // Every (question, engine) check runs through a small worker pool (SCAN_CONCURRENCY, default 4 = both engines x 2 questions) with a
  // per-call timeout in the providers, so a full live scan stays well under Cloudflare's ~100s. Results keep question-then-engine order.
  const tasks = questions.flatMap((q, qi) => active.map(e => ({ q, qi, e }))); const results = new Array(tasks.length); let cost = 0; const lastErr = {};
  const conc = Math.max(1, Math.min(tasks.length, Number(process.env.SCAN_CONCURRENCY) || 4)); let next = 0;
  const work = async () => { while (next < tasks.length) { const i = next++; const { q, qi, e } = tasks[i]; const p = getProvider(e);
    try {
      const ans = await p.ask(q, { business });
      const a = analyzeAnswer(ans, business); const sentiment = sentimentFor(ans.text, business, a.mentioned); const facts = factCheck(ans.text, business, a.mentioned);
      results[i] = { question: q, engine: e, engineLabel: p.label, mock: !!p.mock, answer: ans.text, usage: ans.usage, searches: ans.searches, ...(typeof ans.grounded === 'boolean' ? { grounded: ans.grounded } : {}), ...a, ...(sentiment ? { sentiment } : {}), ...(facts.length ? { facts } : {}) };
      if (!p.mock) cost += COST_PER_CHECK[e];
    } catch (err) {
      const msg = sanitize(err?.message, 300); const status = err?.status ?? (err?.kind === 'timeout' ? 'timeout' : err?.kind || 'error');
      lastErr[e] = { status, message: sanitize(err?.message, 120) };
      console.error(`[scan] provider error engine=${e} q=${qi} status=${status} msg="${sanitize(err?.message, 160)}"`);
      results[i] = { question: q, engine: e, error: msg };
    } } };
  await Promise.all(Array.from({ length: conc }, work));
  recordSpend(account, results.filter(r => !r.error).length, cost);
  // An engine whose every call failed (e.g. no credit, outage) counts as skipped too, so the report says it did not run.
  for (const e of active) if (!results.some(r => r.engine === e && !r.error)) skipped.push({ engine: e, reason: 'failed' });
  engines = active.filter(e => !skipped.some(x => x.engine === e));
  if (!engines.length) {
    const why = active.map(e => `${e}=${lastErr[e]?.status ?? 'none'}`).join(' ');
    console.error(`[scan] NO_ENGINE: every live engine failed (${why})`);
    recordScanFailure('no_engine', active.map(e => ({ engine: e, ...(lastErr[e] || { status: null }) })));
    throw Object.assign(new Error(NO_ENGINE_MESSAGE.en), { code: 'NO_ENGINE', he: NO_ENGINE_MESSAGE.he, skipped });
  }

  const ok = results.filter(r => !r.error);
  const summary = summarizeResults(results, { plan, engines, skipped, cost });
  const scan = { id: id(12), businessId: business.id, accountId: account.id, at: new Date().toISOString(), mock: ok.length > 0 && ok.every(r => r.mock), ...(utm ? { utm } : {}), ...(internal ? { internal: true } : {}), summary, results };
  scan.fixes = buildFixes(scan, business);
  const db = getDb(); const prev = db.scans[business.scanIds?.at(-1)]; scan.alerts = detectAlerts(prev, scan); db.scans[scan.id] = scan; business.scanIds = [...(business.scanIds || []), scan.id]; save();
  return scan;
}
