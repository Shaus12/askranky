// Display + billing currency. Display: Israeli visitors see ILS, everyone else USD.
// Order: 1) ranky_currency cookie (manual toggle)  2) Hebrew UI (?lang=he, or ranky_lang=he cookie when no lang given)
// 3) geo header (CF-IPCountry / X-Vercel-IP-Country / X-Country-Code)  4) Accept-Language he/iw  5) USD.
import { PLANS, CURRENCIES, priceOf, isPaid } from './plans.js';
// ILS-only is enforced for real SUMIT billing until USD standing orders are verified: with PAYMENTS_PROVIDER=sumit, USD
// billing also needs SUMIT_USD_VERIFIED=1 (see GO-LIVE.md). The config check flags ENABLE_USD_BILLING=true as an error.
export const usdBillingEnabled = () => (process.env.ENABLE_USD_BILLING === '1' || process.env.ENABLE_USD_BILLING === 'true') && (process.env.PAYMENTS_PROVIDER !== 'sumit' || process.env.SUMIT_USD_VERIFIED === '1');
const cookie = (q, k) => (new RegExp(`(?:^|;\\s*)${k}=([^;]*)`).exec(q.get?.('cookie') || q.headers?.cookie || '') || [])[1];
const hdr = (q, k) => (q.get ? q.get(k) : q.headers?.[k]) || '';
export function detectCurrency(q, lang) {
  const c = String(cookie(q, 'ranky_currency') || '').toUpperCase(); if (CURRENCIES.includes(c)) return { currency: c, source: 'cookie' };
  // Hebrew UI: an explicit page language wins; otherwise the ranky_lang cookie set when a /he page was served.
  const ui = lang === 'he' || lang === 'en' ? lang : cookie(q, 'ranky_lang'); if (ui === 'he') return { currency: 'ILS', source: 'locale' };
  const geo = String(hdr(q, 'cf-ipcountry') || hdr(q, 'x-vercel-ip-country') || hdr(q, 'x-country-code')).toUpperCase();
  if (/^[A-Z]{2}$/.test(geo) && geo !== 'XX' && geo !== 'T1') return { currency: geo === 'IL' ? 'ILS' : 'USD', source: 'geo' };
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
