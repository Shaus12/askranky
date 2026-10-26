import { getDb, save } from './store.js';
import { COST_PER_CHECK, PLANS } from './plans.js';
// Daily live-API spend guard. DAILY_SPEND_CAP_USD (default 10) is read per call; only real (non-mock) checks count.
export const dailyCapUsd = () => { const raw = process.env.DAILY_SPEND_CAP_USD; const v = Number(raw); return raw && Number.isFinite(v) && v >= 0 ? v : 10; };
export const spentToday = () => getDb().spend[today()] || 0;
export const CAP_MESSAGE = { en: 'We have hit today\'s scanning limit. Please try again tomorrow; your report will be ready in 60 seconds then.', he: 'הגענו למכסת הסריקות היומית. נסו שוב מחר, והדוח יהיה מוכן תוך 60 שניות.' };
const today = () => new Date().toISOString().slice(0, 10);
const month = () => new Date().toISOString().slice(0, 7);

export function estimateCost(engines, questions) { return engines.reduce((s, e) => s + COST_PER_CHECK[e] * questions, 0); }

export function checkBudget(account, engines, questions, liveEngines = engines, plan = PLANS[account.plan]) {
  const db = getDb();
  const checks = engines.length * questions;
  const used = account.usage?.[month()] || 0;
  if (used + checks > plan.monthlyCheckBudget) return { ok: false, reason: `Plan cap reached (${used}/${plan.monthlyCheckBudget} checks this month)` };
  const est = estimateCost(liveEngines, questions); const cap = dailyCapUsd();
  if (est > 0 && spentToday() + est > cap) { db.events.push({ at: new Date().toISOString(), type: 'spend.capped', cap, spent: spentToday() }); return { ok: false, capped: true, reason: CAP_MESSAGE.en, reasonHe: CAP_MESSAGE.he }; }
  return { ok: true, checks, est };
}

export function recordSpend(account, checks, usd) {
  const db = getDb();
  account.usage = account.usage || {};
  account.usage[month()] = (account.usage[month()] || 0) + checks;
  db.spend[today()] = +((db.spend[today()] || 0) + usd).toFixed(4);
  const pct = dailyCapUsd() ? db.spend[today()] / dailyCapUsd() : 1;
  if (usd > 0 && pct >= 0.8) db.events.push({ at: new Date().toISOString(), type: 'spend.alert', pct: +pct.toFixed(2) });
  save();
}
