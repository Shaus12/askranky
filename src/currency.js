// Display + billing currency. Display: Israeli visitors see ILS, everyone else USD.
// Order: 1) ranky_currency cookie (manual toggle on the pricing page)  2) geo header (CF-IPCountry, or
// X-Vercel-IP-Country / X-Country-Code if a proxy sets them; only meaningful behind that proxy)  3) Hebrew UI
// (?lang=he from the page, or ranky_lang=he cookie)  4) Accept-Language he/iw  5) USD.
import { PLANS, CURRENCIES, priceOf, isPaid } from './plans.js';
export const usdBillingEnabled = () => process.env.ENABLE_USD_BILLING === '1' || process.env.ENABLE_USD_BILLING === 'true';
const cookie = (q, k) => (new RegExp(`(?:^|;\\s*)${k}=([^;]*)`).exec(q.get?.('cookie') || q.headers?.cookie || '') || [])[1];
const hdr = (q, k) => (q.get ? q.get(k) : q.headers?.[k]) || '';
export function detectCurrency(q, lang) {
  const c = String(cookie(q, 'ranky_currency') || '').toUpperCase(); if (CURRENCIES.includes(c)) return { currency: c, source: 'cookie' };
  const geo = String(hdr(q, 'cf-ipcountry') || hdr(q, 'x-vercel-ip-country') || hdr(q, 'x-country-code')).toUpperCase();
  if (/^[A-Z]{2}$/.test(geo) && geo !== 'XX' && geo !== 'T1') return { currency: geo === 'IL' ? 'ILS' : 'USD', source: 'geo' };
  if ((lang || cookie(q, 'ranky_lang')) === 'he') return { currency: 'ILS', source: 'locale' };
  if (/\b(he|iw)\b/i.test(hdr(q, 'accept-language'))) return { currency: 'ILS', source: 'accept-language' };
  return { currency: 'USD', source: 'default' };
}
// What is actually charged. USD billing via SUMIT is unverified (help center: Excel-imported standing orders are ILS-only),
// so while ENABLE_USD_BILLING is off a USD visitor is charged the plan's own ILS list price (fallback documented in plan.md).
export function billingFor(plan, displayCurrency) {
  if (!isPaid(plan)) throw new Error('not a paid plan');
  const currency = displayCurrency === 'USD' && usdBillingEnabled() ? 'USD' : 'ILS';
  return { currency, amount: priceOf(plan, currency), displayCurrency, displayAmount: priceOf(plan, displayCurrency), fallback: currency !== displayCurrency };
}
export const publicPlans = () => Object.values(PLANS).map(p => ({ id: p.id, name: p.name, prices: p.prices, businesses: p.businesses, questionsPerBusiness: p.questionsPerBusiness, competitors: p.competitors, cadence: p.cadence }));
