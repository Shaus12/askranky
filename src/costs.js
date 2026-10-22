import { getDb, save } from './store.js';
import { COST_PER_CHECK, GLOBAL_DAILY_SPEND_CAP_USD, PLANS } from './plans.js';
const today = () => new Date().toISOString().slice(0, 10);
const month = () => new Date().toISOString().slice(0, 7);

export function estimateCost(engines, questions) { return engines.reduce((s, e) => s + COST_PER_CHECK[e] * questions, 0); }

export function checkBudget(account, engines, questions) {
  const db = getDb();
  const plan = PLANS[account.plan];
  const checks = engines.length * questions;
  const used = account.usage?.[month()] || 0;
  if (used + checks > plan.monthlyCheckBudget) return { ok: false, reason: `Plan cap reached (${used}/${plan.monthlyCheckBudget} checks this month)` };
  const est = estimateCost(engines, questions);
  const spent = db.spend[today()] || 0;
  if (spent + est > GLOBAL_DAILY_SPEND_CAP_USD) return { ok: false, reason: `Global daily API spend cap ($${GLOBAL_DAILY_SPEND_CAP_USD}) reached` };
  return { ok: true, checks, est };
}

export function recordSpend(account, checks, usd) {
  const db = getDb();
  account.usage = account.usage || {};
  account.usage[month()] = (account.usage[month()] || 0) + checks;
  db.spend[today()] = +((db.spend[today()] || 0) + usd).toFixed(4);
  const pct = db.spend[today()] / GLOBAL_DAILY_SPEND_CAP_USD;
  if (pct >= 0.8) db.events.push({ at: new Date().toISOString(), type: 'spend.alert', pct: +pct.toFixed(2) });
  save();
}
