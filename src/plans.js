// Plans + hard caps. Prices are per currency, in whole units (ILS shekels / USD dollars), shown and charged as-is:
// the owner is an עוסק פטור (VAT-exempt dealer), so NO VAT is ever added or shown. This file is the ONLY source of
// truth for amounts: checkout looks the price up here server-side and never trusts an amount from the client.
// Israeli prices are set per market, not FX-converted (research/design-and-market.md, "תמחור מוצע").
export const CURRENCIES = ['ILS', 'USD'];
export const PLANS = {
  free:    { id: 'free',    name: 'Free scan', prices: { ILS: 0,   USD: 0 },   businesses: 1,  questionsPerBusiness: 5,  competitors: 3, cadence: 'once',   monthlyCheckBudget: 15 },
  starter: { id: 'starter', name: 'Starter',   prices: { ILS: 79,  USD: 19 },  businesses: 1,  questionsPerBusiness: 15, competitors: 3, cadence: 'weekly', monthlyCheckBudget: 15 * 3 * 5 },
  pro:     { id: 'pro',     name: 'Pro',       prices: { ILS: 179, USD: 49 },  businesses: 3,  questionsPerBusiness: 20, competitors: 5, cadence: 'weekly', monthlyCheckBudget: 3 * 20 * 3 * 5 },
  agency:  { id: 'agency',  name: 'Agency',    prices: { ILS: 549, USD: 149 }, businesses: 10, questionsPerBusiness: 15, competitors: 5, cadence: 'weekly', monthlyCheckBudget: 10 * 15 * 3 * 5 },
};
export const isPaid = p => !!p && p.prices.ILS > 0;
export const priceOf = (plan, currency) => { if (!CURRENCIES.includes(currency)) throw new Error('bad currency'); return plan.prices[currency]; };
export const formatPrice = (amount, currency) => currency === 'ILS' ? `₪${amount}` : `$${amount}`;
// Estimated USD cost per single check (1 question x 1 engine), from Oct-2026 published API prices.
export const COST_PER_CHECK = { chatgpt: 0.014, perplexity: 0.008, gemini: 0.02 };
export const GLOBAL_DAILY_SPEND_CAP_USD = Number(process.env.DAILY_SPEND_CAP_USD || 10);
