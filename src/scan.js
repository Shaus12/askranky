import { ENGINES, getProvider, isMockMode } from './providers/index.js';
import { analyzeAnswer } from './extract.js';
import { buildQuestions } from './questions.js';
import { checkBudget, recordSpend } from './costs.js';
import { COST_PER_CHECK, PLANS } from './plans.js';
import { buildFixes } from './fixes.js';
import { getDb, save, id } from './store.js';

export async function runScan(account, business, { engines = ENGINES, maxQuestions } = {}) {
  const plan = PLANS[account.plan];
  const questions = buildQuestions(business, Math.min(plan.questionsPerBusiness, maxQuestions || Infinity));
  const budget = checkBudget(account, engines, questions.length);
  if (!budget.ok) throw Object.assign(new Error(budget.reason), { code: 'CAP' });

  const results = []; let cost = 0;
  for (const q of questions) for (const e of engines) {
    const p = getProvider(e);
    try {
      const ans = await p.ask(q, { business });
      results.push({ question: q, engine: e, engineLabel: p.label, mock: !!p.mock, answer: ans.text, usage: ans.usage, searches: ans.searches, ...analyzeAnswer(ans, business) });
      cost += COST_PER_CHECK[e];
    } catch (err) { results.push({ question: q, engine: e, error: String(err.message).slice(0, 300) }); }
  }
  recordSpend(account, results.filter(r => !r.error).length, cost);

  const ok = results.filter(r => !r.error);
  const compCount = {}, hostCount = {};
  for (const r of ok) { for (const c of r.competitors.slice(0, plan.competitors + 2)) compCount[c] = (compCount[c] || 0) + 1; for (const c of r.citations) { const k = c.host; hostCount[k] = hostCount[k] || { host: k, count: 0, isOwnSite: c.isOwnSite }; hostCount[k].count++; } }
  const byEngine = Object.fromEntries(engines.map(e => { const rs = ok.filter(r => r.engine === e); const m = rs.filter(r => r.mentioned); return [e, { checks: rs.length, mentions: m.length, avgRank: m.length ? +(m.reduce((s, r) => s + (r.rank || 5), 0) / m.length).toFixed(1) : null }]; }));
  const mentionRate = ok.length ? ok.filter(r => r.mentioned).length / ok.length : 0;
  const ranks = ok.filter(r => r.rank).map(r => r.rank);
  const avgRank = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
  const score = Math.round(100 * (0.7 * mentionRate + 0.3 * (avgRank ? Math.max(0, (6 - avgRank) / 5) : 0)));
  const summary = {
    score, mentionRate: +mentionRate.toFixed(2), avgRank: avgRank && +avgRank.toFixed(1), byEngine,
    topCompetitors: Object.entries(compCount).sort((a, b) => b[1] - a[1]).slice(0, plan.competitors).map(([name, count]) => ({ name, count })),
    topCitedHosts: Object.values(hostCount).sort((a, b) => b.count - a.count).slice(0, 8),
    ownSiteCited: ok.some(r => r.ownSiteCited), checks: ok.length, errors: results.length - ok.length, estCostUsd: +cost.toFixed(3),
  };
  const scan = { id: id(12), businessId: business.id, accountId: account.id, at: new Date().toISOString(), mock: isMockMode(), summary, results };
  scan.fixes = buildFixes(scan, business);
  const db = getDb(); db.scans[scan.id] = scan; business.scanIds = [...(business.scanIds || []), scan.id]; save();
  return scan;
}
