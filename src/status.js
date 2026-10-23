// Read-only operational status for GET /api/internal/status (token-protected, see server.js). AGGREGATE NUMBERS ONLY: no emails,
// names, business names, report ids, IPs, per-customer amounts, SUMIT data or tokens ever enter the result. Works on the store's
// in-memory document (getDb()), which is the live data in BOTH backends (Postgres loads it at boot and writes through; the JSON
// store is the file), so no extra SQL is needed and the call is a single pass over accounts / scans / events (milliseconds).
// Every section is computed independently: a missing table/field yields null for that field (never an exception, never invented data).
import { getDb } from './store.js'; import { PLANS, isPaid } from './plans.js'; import { dailyCapUsd } from './costs.js';
import { getPayments } from './payments/index.js'; import { isMockMode } from './providers/index.js'; import { emailIsMock } from './email/send.js'; import { isPrelaunch } from './prelaunch.js';
import { GRACE_DAYS } from './jobs/billing-sync.js';
const DAY = 864e5, HOUR = 36e5;
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0); const r2 = v => Math.round(num(v) * 100) / 100;
// Short, scrubbed text: strips anything that looks like an email, URL, long token, or run of digits (ids, phone/card/amount-like numbers).
export const scrub = (s, max = 80) => String(s ?? '').replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]').replace(/https?:\/\/\S+/gi, '[url]').replace(/[A-Za-z0-9_\-+/=]{24,}/g, '[token]')
  .replace(/\d[\d\s.,-]{3,}\d/g, '[num]').replace(/\d{4,}/g, '[num]').replace(/\s+/g, ' ').trim().slice(0, max);
// Last run of the billing sync in THIS process (survives only until restart; the persisted 'billing.sync' events are the fallback).
let lastSync = null;
export const recordSync = (ok, err, at = new Date()) => { lastSync = { at: at.toISOString(), ok: !!ok, error: ok ? null : scrub(`${err?.name || 'Error'}: ${err?.message || ''}`) }; };
export const resetSyncState = () => { lastSync = null; };
// Spend day = UTC calendar date (costs.js today()). Next reset = next 00:00 UTC; also given as Asia/Jerusalem local time (DST-aware via Intl).
const resetInfo = now => { const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(next);
  return { resetsAt: next.toISOString(), resetsAtAsiaJerusalem: `${local} Asia/Jerusalem` }; };
const safe = (f) => { try { return f(); } catch { return null; } };
const ts = v => { const t = Date.parse(v); return Number.isFinite(t) ? t : NaN; };
const isTestAcc = a => !!(a.testSubscription || a.pendingTest);
export function buildStatus({ now = new Date(), db = getDb(), running = false } = {}) {
  const T = now.getTime(), t24 = T - DAY, t7 = T - 7 * DAY, today = now.toISOString().slice(0, 10);
  const accounts = Object.values(db?.accounts || {}).filter(a => a && typeof a === 'object' && !isTestAcc(a));
  const events = Array.isArray(db?.events) ? db.events : [];
  const sync = safe(() => {
    let ev = null, err = null;
    for (const e of events) { if (e?.type === 'billing.sync' && (!ev || ts(e.at) >= ts(ev.at))) ev = e; if (e?.type === 'billing.sync_error' && (!err || ts(e.at) >= ts(err.at))) err = e; }
    const fromEv = ev && Number.isFinite(ts(ev.at)) ? { at: new Date(ts(ev.at)).toISOString(), ok: num(ev.errors) === 0, error: num(ev.errors) > 0 && err && ts(err.at) >= ts(ev.at) - 5 * 60e3 ? scrub(err.error) || 'sync_error' : num(ev.errors) > 0 ? 'sync_error' : null } : null;
    const pick = lastSync && (!fromEv || ts(lastSync.at) >= ts(fromEv.at)) ? lastSync : fromEv;
    return { lastRunAt: pick?.at ?? null, lastOk: pick ? pick.ok : null, lastError: pick?.error ?? null, running: !!running };
  });
  const scans = safe(() => {
    const list = Object.values(db?.scans || {}).filter(Boolean); const out = { today: 0, last24h: 0, total: list.length, liveLast24h: 0, byEngine: {}, errorsLast24h: 0, clarifyingAnswersLast24h: 0 };
    for (const s of list) { const t = ts(s.at), recent = t >= t24, sum = s.summary || {};
      const ran = Array.isArray(sum.engines?.ran) ? sum.engines.ran : Object.keys(sum.byEngine || {});
      for (const e of ran) { const b = out.byEngine[e] ||= { last24h: 0, total: 0 }; b.total++; if (recent) b.last24h++; }
      if (String(s.at).slice(0, 10) === today) out.today++;
      if (recent) { out.last24h++; if (!s.mock) out.liveLast24h++; out.errorsLast24h += num(sum.errors); out.clarifyingAnswersLast24h += num(sum.clarifyingAnswers); } }
    return out;
  });
  const spend = safe(() => {
    const cap = dailyCapUsd(), usd = num(db?.spend?.[today]); let capped = 0, lastAlert = null; for (const e of events) { if (e?.type === 'spend.capped' && ts(e.at) >= t24) capped++; if (e?.type === 'spend.alert' && Number.isFinite(ts(e.at)) && (!lastAlert || ts(e.at) > ts(lastAlert))) lastAlert = new Date(ts(e.at)).toISOString(); }
    return { todayUsd: r2(usd), capUsd: cap, pctOfCap: cap > 0 ? Math.round(usd / cap * 1000) / 10 : null, last7Days: Array.from({ length: 7 }, (_, i) => { const day = new Date(T - (6 - i) * DAY).toISOString().slice(0, 10); return { day, usd: r2(db?.spend?.[day]) }; }),
      estimated: true, cappedEventsLast24h: capped,
      alertState: { threshold: 0.8, reached: cap > 0 ? usd >= 0.8 * cap : usd > 0, capReached: usd >= cap, lastAlertLoggedAt: lastAlert },
      ...resetInfo(now), resetBasis: 'UTC midnight' };
  });
  const signups = safe(() => { const o = { today: 0, last24h: 0, total: accounts.length }; for (const a of accounts) { const t = ts(a.createdAt); if (String(a.createdAt).slice(0, 10) === today) o.today++; if (t >= t24) o.last24h++; } return o; });
  const subs = safe(() => {
    const o = { paying: 0, byPlan: { starter: 0, pro: 0, agency: 0 }, mrrIls: 0, trialOrFree: 0, cancelledInPeriod: 0 };
    for (const a of accounts) {
      const plan = PLANS[a.plan]; if (!plan || !isPaid(plan)) { if (!a.plan || a.plan === 'free') o.trialOrFree++; continue; }
      if (!a.subscriptionRef) continue;
      if (a.status === 'cancelled') { o.cancelledInPeriod++; continue; } if (a.status === 'past_due') continue; // past_due counted under payments, not as paying
      o.paying++; if (o.byPlan[a.plan] !== undefined) o.byPlan[a.plan]++;
      o.mrrIls += a.billing?.currency === 'ILS' && num(a.billing.amount) > 0 ? num(a.billing.amount) : plan.prices.ILS;
    } return o;
  });
  const payments = safe(() => {
    const o = { failuresLast24h: 0, failuresLast7d: 0, pastDue: 0, graceActive: 0 };
    for (const e of events) if (e?.type === 'billing.payment_failed') { const t = ts(e.at); if (t >= t7) o.failuresLast7d++; if (t >= t24) o.failuresLast24h++; }
    for (const a of accounts) if (a.status === 'past_due') { o.pastDue++; if (T - ts(a.pastDueSince) <= GRACE_DAYS * DAY) o.graceActive++; }
    return o;
  });
  const config = safe(() => ({ paymentsProvider: getPayments().id, scanMode: isMockMode() ? 'mock' : 'live', emailMode: emailIsMock() ? 'mock' : 'live', prelaunch: !!isPrelaunch() }));
  return { ok: true, generatedAt: now.toISOString(), dayBasis: 'UTC', sync, scans, spend, signups, subscribers: subs && { ...subs, mrrIls: Math.round(subs.mrrIls) }, payments, config };
}
