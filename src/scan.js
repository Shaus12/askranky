import { ENGINES, getProvider, engineStatus, isMockMode } from './providers/index.js';
import { analyzeAnswer } from './extract.js';
import { summarizeResults } from './summary.js';
import { buildQuestions } from './questions.js';
import { checkBudget, recordSpend } from './costs.js';
import { COST_PER_CHECK, PLANS } from './plans.js';
import { buildFixes } from './fixes.js';
import { getDb, save, id } from './store.js';

export const NO_ENGINE_MESSAGE = { en: 'Live scans are temporarily unavailable (no AI engine is available right now). Please try again later.', he: 'הסריקות האמיתיות לא זמינות כרגע (אף מנוע AI לא זמין). נסו שוב מאוחר יותר.' };
export async function runScan(account, business, { engines = ENGINES, maxQuestions, utm = null } = {}) {
  const plan = PLANS[account.plan];
  const questions = buildQuestions(business, Math.min(plan.questionsPerBusiness, maxQuestions || Infinity));
  // Engines that cannot run live (not enabled / key missing) are skipped, never faked. No runnable engine: refuse before any spend.
  const skipped = engines.map(engineStatus).filter(st => st.skipped).map(st => ({ engine: st.engine, reason: st.reason }));
  const active = engines.filter(e => !skipped.some(x => x.engine === e));
  if (!active.length) throw Object.assign(new Error(NO_ENGINE_MESSAGE.en), { code: 'NO_ENGINE', he: NO_ENGINE_MESSAGE.he, skipped });
  const budget = checkBudget(account, active, questions.length, active.filter(e => !getProvider(e).mock));
  if (!budget.ok) throw Object.assign(new Error(budget.reason), { code: 'CAP', he: budget.reasonHe });

  const results = []; let cost = 0;
  for (const q of questions) for (const e of active) {
    const p = getProvider(e);
    try {
      const ans = await p.ask(q, { business });
      results.push({ question: q, engine: e, engineLabel: p.label, mock: !!p.mock, answer: ans.text, usage: ans.usage, searches: ans.searches, ...(typeof ans.grounded === 'boolean' ? { grounded: ans.grounded } : {}), ...analyzeAnswer(ans, business) });
      if (!p.mock) cost += COST_PER_CHECK[e];
    } catch (err) { results.push({ question: q, engine: e, error: String(err.message).slice(0, 300) }); }
  }
  recordSpend(account, results.filter(r => !r.error).length, cost);
  // An engine whose every call failed (e.g. no credit, outage) counts as skipped too, so the report says it did not run.
  for (const e of active) if (!results.some(r => r.engine === e && !r.error)) skipped.push({ engine: e, reason: 'failed' });
  engines = active.filter(e => !skipped.some(x => x.engine === e));
  if (!engines.length) throw Object.assign(new Error(NO_ENGINE_MESSAGE.en), { code: 'NO_ENGINE', he: NO_ENGINE_MESSAGE.he, skipped });

  const ok = results.filter(r => !r.error);
  const summary = summarizeResults(results, { plan, engines, skipped, cost });
  const scan = { id: id(12), businessId: business.id, accountId: account.id, at: new Date().toISOString(), mock: ok.length > 0 && ok.every(r => r.mock), ...(utm ? { utm } : {}), summary, results };
  scan.fixes = buildFixes(scan, business);
  const db = getDb(); db.scans[scan.id] = scan; business.scanIds = [...(business.scanIds || []), scan.id]; save();
  return scan;
}
