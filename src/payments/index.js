// Pluggable payments. Interface:
//   createCheckout({account, plan, returnUrl}) -> { redirectUrl }
//   handleReturn(query, account)              -> { ok, subscriptionRef?, error? }   (customer redirected back)
//   handleWebhook(body, headers)              -> { ok, event }                       (provider trigger / IPN)
//   cancel(account)                           -> { ok }
//   sync(account)                             -> { active, paidThrough? }            (daily reconciliation)
import { mockPayments } from './mock.js';
import { sumitPayments } from './sumit.js';
export function getPayments() { return process.env.PAYMENTS_PROVIDER === 'sumit' ? sumitPayments : mockPayments; }
