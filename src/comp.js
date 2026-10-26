// Complimentary ("comp") accounts: COMP_ACCOUNTS=email:plan[,email:plan...] (e.g. owner@example.com:pro), applied once at server startup.
// Idempotent: creates the account if missing, sets plan + comp:true. A comp account has NO subscriptionRef, so the SUMIT billing sync,
// status MRR / subscriber counts and cancel flows ignore it, and hasActiveSubscription() never blocks a real checkout for it. Weekly
// auto-scans skip comp accounts (no unattended API spend); a manual "Run scan now" stays allowed within the plan's caps.
// An account that already pays (has a subscriptionRef) is never touched. Logs only counts, never the address or any secret.
import { getDb, save, id } from './store.js'; import { PLANS, isPaid } from './plans.js'; import { token } from './security/tokens.js';
export const isComp = a => !!a?.comp && !a?.subscriptionRef;
export function parseCompAccounts(v = process.env.COMP_ACCOUNTS) {
  return String(v || '').split(',').map(s => s.trim()).filter(Boolean).map(s => { const i = s.lastIndexOf(':'); const email = (i > 0 ? s.slice(0, i) : s).trim().toLowerCase(); const plan = (i > 0 ? s.slice(i + 1) : 'pro').trim().toLowerCase();
    return /^[^@\s:,]+@[^@\s:,]+\.[^@\s:,]+$/.test(email) && email.length <= 200 && Object.hasOwn(PLANS, plan) && isPaid(PLANS[plan]) ? { email, plan } : null; }).filter(Boolean);
}
export function applyCompAccounts(v = process.env.COMP_ACCOUNTS, now = new Date()) {
  const list = parseCompAccounts(v); if (!list.length) return { applied: 0, created: 0, skipped: 0 };
  const db = getDb(); let applied = 0, created = 0, skipped = 0, changed = false;
  for (const { email, plan } of list) {
    let a = Object.values(db.accounts).find(x => x.email === email);
    if (a?.subscriptionRef) { skipped++; continue; } // a real (paying or ex-paying) subscription: billing owns the plan
    if (!a) { a = { id: id(10), key: token(32), email, plan: 'free', createdAt: now.toISOString(), usage: {} }; db.accounts[a.id] = a; created++; changed = true; }
    if (a.plan !== plan || a.comp !== true) { a.plan = plan; a.comp = true; a.compSince ||= now.toISOString(); changed = true; db.events.push({ at: now.toISOString(), type: 'account.comp', account: a.id, plan }); }
    applied++;
  }
  if (changed) save();
  console.log(`[comp] ${applied} comp account(s) applied (${created} created, ${skipped} skipped: real subscription)`);
  return { applied, created, skipped };
}
