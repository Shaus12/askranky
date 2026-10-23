// Daily billing reconciliation. SUMIT sends no IPN for renewals, so once a day we call payments.sync(account) for every
// account with a subscription and:
//  - active  → status 'active', clear failure state, extend paidThrough by a month when the period rolled over (receipt
//              email for the renewal; SUMIT also issues the קבלה document itself).
//  - inactive (not cancelled by us) → first time: status 'past_due' + failed-payment email (once); after GRACE_DAYS
//              (7, per the template) → downgrade to free, data kept.
//  - cancelled by the customer → downgrade to free once paidThrough has passed.
// Run it with `npm run billing:sync` (Render Cron Job) or in-process with BILLING_SYNC_CRON=1 (every 24h).
import { getDb, save, flush } from '../store.js'; import { getPayments } from '../payments/index.js'; import { PLANS } from '../plans.js';
import { sendEmailSoft } from '../email/send.js'; import { renderTx } from '../email/templates.js'; import { BRAND } from '../brand.js';
export const GRACE_DAYS = 7; const DAY = 864e5;
const addMonth = d => { const x = new Date(d), day = x.getUTCDate(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() + 1); x.setUTCDate(Math.min(day, new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate())); return x; }; // clamps Jan 31 → Feb 28
// The only way to replace a card today (no card-update flow): subscribe again at checkout with the same email.
const resubscribeUrl = (lang, planId) => `${(process.env.BASE_URL || `https://${BRAND.domain}`).replace(/\/+$/, '')}/${lang === 'he' ? 'he' : 'en'}/checkout?plan=${encodeURIComponent(planId || 'starter')}`;
export const ymd = d => new Date(d).toISOString().slice(0, 10);
export async function syncAll({ payments = getPayments(), now = new Date() } = {}) {
  const db = getDb(); const out = { checked: 0, active: 0, renewed: 0, pastDue: 0, downgraded: 0, errors: 0 };
  for (const a of Object.values(db.accounts)) {
    if (!a.subscriptionRef || a.plan === 'free') continue; out.checked++;
    const plan = PLANS[a.plan]; const lang = a.lang || a.pendingLang || 'en'; const billing = a.billing || {};
    if (a.status === 'cancelled') { if (a.paidThrough && now > new Date(a.paidThrough)) { downgrade(db, a, now, 'cancel-period-ended'); out.downgraded++; } continue; }
    // Admin 1 ILS test subscription (src/payments/test-plan.js): never renewed, no receipt/failed-payment emails, never past_due.
    // The SUMIT standing order is created for exactly one payment; 24h after the charge we make sure it is not active (cancel it
    // if it somehow still is) and end the access. A failed check is retried on the next run.
    if (a.testSubscription) {
      if (a.paidThrough && now > new Date(a.paidThrough)) {
        try { const st = await payments.sync(a); if (st.active) await payments.cancel(a); } catch (e) { out.errors++; db.events.push({ at: now.toISOString(), type: 'billing.sync_error', account: a.id, error: 'test subscription check failed' }); continue; }
        a.cancelledAt ||= now.toISOString(); downgrade(db, a, now, 'cancel-period-ended'); out.downgraded++;
      }
      continue;
    }
    let res; try { res = await payments.sync(a); } catch (e) { out.errors++; db.events.push({ at: now.toISOString(), type: 'billing.sync_error', account: a.id, error: String(e.message).slice(0, 200) }); continue; }
    if (res.active) {
      out.active++; if (a.status === 'past_due') db.events.push({ at: now.toISOString(), type: 'billing.recovered', account: a.id });
      a.status = 'active'; delete a.pastDueSince; delete a.failedNoticeAt;
      if (!a.paidThrough) a.paidThrough = addMonth(a.paidAt || now).toISOString();
      else if (now > new Date(a.paidThrough)) {
        a.paidThrough = addMonth(a.paidThrough).toISOString(); out.renewed++;
        db.events.push({ at: now.toISOString(), type: 'subscription.renewed', account: a.id, paidThrough: a.paidThrough });
        const m = renderTx('receipt', lang, { planName: plan?.name, amount: billing.amount, currency: billing.currency, paidThrough: ymd(a.paidThrough) }); if (!await sendEmailSoft({ to: a.email, ...m })) db.events.push({ at: now.toISOString(), type: 'billing.email_failed', account: a.id, email: 'receipt' });
      }
    } else {
      a.status = 'past_due'; a.pastDueSince ||= now.toISOString(); out.pastDue++;
      if (!a.failedNoticeAt) { a.failedNoticeAt = now.toISOString(); db.events.push({ at: now.toISOString(), type: 'billing.payment_failed', account: a.id });
        const m = renderTx('failed', lang, { planName: plan?.name, amount: billing.amount, currency: billing.currency, link: resubscribeUrl(lang, a.plan) });
        // Soft: a delivery problem is logged by sendEmail and must neither abort the sync for the other accounts nor re-send next run (failedNoticeAt is already set).
        if (!await sendEmailSoft({ to: a.email, ...m })) db.events.push({ at: now.toISOString(), type: 'billing.email_failed', account: a.id, email: 'failed' }); }
      if (now - new Date(a.pastDueSince) > GRACE_DAYS * DAY) { downgrade(db, a, now, 'unpaid'); out.downgraded++; }
    }
  }
  db.events.push({ at: now.toISOString(), type: 'billing.sync', ...out }); await save(); return out;
}
function downgrade(db, a, now, reason) {
  db.events.push({ at: now.toISOString(), type: 'subscription.downgraded', account: a.id, from: a.plan, reason });
  a.previousPlan = a.plan; a.plan = 'free'; a.status = reason === 'unpaid' ? 'unpaid' : 'cancelled_ended';
}
let timer = null;
// In-process scheduler (single instance only). First run after `delayMs`, then every 24h.
export function startBillingCron({ delayMs = 60_000, everyMs = DAY, run = syncAll } = {}) {
  if (timer) return timer; const tick = () => run().catch(e => console.error('billing sync failed:', e.message));
  timer = setTimeout(function loop() { tick(); timer = setTimeout(loop, everyMs); timer.unref?.(); }, delayMs); timer.unref?.(); return timer;
}
export const stopBillingCron = () => { clearTimeout(timer); timer = null; };
export { flush };
