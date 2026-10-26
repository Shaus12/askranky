// Subscription state rules shared by checkout (server.js) and COMP_ACCOUNTS (src/comp.js).
import { PLANS, isPaid } from './plans.js';
// Double-charge guard. An account "has an active subscription" while it holds a paid plan with a standing order that is active, or
// cancelled by the customer but still inside the paid period. past_due (grace) and unpaid accounts MAY check out again: that is the
// card-replacement flow (the old failed order is superseded, see completeCheckout). Admin test accounts are not real subscriptions.
export const hasActiveSubscription = (a, now = Date.now()) => !!a && !a.testSubscription && !a.adminTest && isPaid(PLANS[a.plan]) && !!a.subscriptionRef && a.status !== 'past_due'
  && !(a.status === 'cancelled' && !(a.paidThrough && Date.parse(a.paidThrough) > now)) && !['unpaid', 'cancelled_ended'].includes(a.status);
// A stored subscription is "ended" (safe to replace with a comp grant) only when billing has already closed it: not active per
// hasActiveSubscription, not past_due (grace / possible recovery), and either already downgraded (plan free, status
// cancelled_ended / unpaid) or cancelled with paidThrough in the past. Anything else (incl. an unsynced 1 ILS test order) is left alone.
export const subscriptionEnded = (a, now = Date.now()) => !!a?.subscriptionRef && !hasActiveSubscription(a, now) && a.status !== 'past_due'
  && !(a.paidThrough && Date.parse(a.paidThrough) > now)
  && (a.plan === 'free' || !isPaid(PLANS[a.plan]) || ['cancelled_ended', 'unpaid'].includes(a.status) || a.status === 'cancelled');
