// Plans + hard caps. Prices are per currency, in whole units (ILS shekels / USD dollars), shown and charged as-is:
// the owner is an עוסק פטור (VAT-exempt dealer), so NO VAT is ever added or shown. This file is the ONLY source of
// truth for amounts: checkout looks the price up here server-side and never trusts an amount from the client.
// Israeli prices are set per market, not FX-converted (research/design-and-market.md, "תמחור מוצע").
export const CURRENCIES = ['ILS', 'USD'];
export const PLANS = {
  free:    { id: 'free',    name: 'Free scan', prices: { ILS: 0,   USD: 0 },   businesses: 1,  questionsPerBusiness: 5,  competitors: 3, cadence: 'once',   monthlyCheckBudget: 15 },
  starter: { id: 'starter', name: 'Starter',   prices: { ILS: 79,  USD: 19 },  businesses: 1,  questionsPerBusiness: 15, competitors: 3, cadence: 'monthly', rescanDays: 30, monthlyCheckBudget: 15 * 3 * 5 },
  pro:     { id: 'pro',     name: 'Pro',       prices: { ILS: 179, USD: 49 },  businesses: 3,  questionsPerBusiness: 20, competitors: 5, cadence: 'weekly', rescanDays: 7, monthlyCheckBudget: 3 * 20 * 3 * 5 },
  agency:  { id: 'agency',  name: 'Agency',    prices: { ILS: 549, USD: 149 }, businesses: 10, questionsPerBusiness: 20, competitors: 5, cadence: 'weekly', rescanDays: 7, monthlyCheckBudget: 10 * 20 * 3 * 5 },
};
// cadence/rescanDays: how often src/rescan.js re-scans each business of a paying account (only while AUTO_RESCAN_ENABLED=1).
// One-time products: NOT plans (no subscription, never change account.plan, ignored by billing sync / MRR). Charged through the
// same SUMIT /billing/recurring/charge call with Recurrence: 1 (exactly one payment, no further charges), the path the internal 1 ILS
// admin test already uses; SUMIT issues the receipt (קבלה) as for plans. ILS only. The scans it includes run via src/fixup.js (FIXUP_SCANS_ENABLED).
export const PRODUCTS = {
  fixup: { id: 'fixup', name: 'Fix-up', prices: { ILS: 390 }, oneTime: true, recurrence: 1, questionsPerBusiness: 20, competitors: 5, rescanAfterDays: 30, monthlyCheckBudget: 2 * 20 * 2 },
};
export const productBilling = p => ({ currency: 'ILS', amount: p.prices.ILS, displayCurrency: 'ILS', displayAmount: p.prices.ILS, fallback: false });
// Founding-member offer (policy text only, no billing logic): the first FOUNDING_MEMBER_LIMIT paying customers (default 20; 0 hides the
// offer) keep the Starter price they signed up at (₪79) while they stay subscribed. Counting is manual (no live counter is shown).
export const foundingLimit = () => { const v = process.env.FOUNDING_MEMBER_LIMIT; const n = v === undefined || v === '' ? 20 : Number(v); return Number.isInteger(n) && n >= 0 && n <= 1000 ? n : 20; };
export const isPaid = p => !!p && p.prices.ILS > 0;
export const priceOf = (plan, currency) => { if (!CURRENCIES.includes(currency)) throw new Error('bad currency'); return plan.prices[currency]; };
export const formatPrice = (amount, currency) => currency === 'ILS' ? `₪${amount}` : `$${amount}`;
// Estimated USD cost per single check (1 question x 1 engine), from Oct-2026 published API prices.
export const COST_PER_CHECK = { chatgpt: 0.014, perplexity: 0.008, gemini: 0.02 };
// Deprecated: use dailyCapUsd() in costs.js (reads env per call).
export const GLOBAL_DAILY_SPEND_CAP_USD = Number(process.env.DAILY_SPEND_CAP_USD || 10);
