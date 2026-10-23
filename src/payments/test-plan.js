// INTERNAL admin-only 1 ILS test plan. Deliberately NOT part of PLANS (src/plans.js): it is not listed by the public
// pricing API, cannot be named in POST /api/checkout (Object.hasOwn(PLANS, ...) is false), and has no USD price.
// It is only ever used by POST /api/admin/test-checkout (valid ADMIN_TEST_TOKEN, PAYMENTS_PROVIDER=sumit).
// recurrence: 1 -> the SUMIT standing order is created for exactly ONE payment (Recurrence = number of recurring payments),
// so no second charge is ever scheduled. The daily sync additionally expires test subscriptions (see jobs/billing-sync.js).
export const TEST_PLAN = Object.freeze({ id: 'test', name: 'Test (1 ILS)', prices: Object.freeze({ ILS: 1, USD: 0 }), recurrence: 1, internal: true });
export const TEST_BILLING = Object.freeze({ currency: 'ILS', amount: 1, displayCurrency: 'ILS' });
export const TEST_CHECKOUT_TTL_MS = 30 * 60 * 1000; // a started test checkout is valid for 30 minutes
export const TEST_ACCESS_MS = 24 * 60 * 60 * 1000;  // the test subscription is expired by the sync 24h after the charge
