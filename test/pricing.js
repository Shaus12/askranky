// Dual-currency pricing: plan config, detection, server-side price lookup, USD-billing flag + ILS fallback, SUMIT payload, no VAT.
import assert from 'node:assert/strict'; import { useTempData } from './helpers.js'; import fs from 'node:fs';
const TD = useTempData('pricing'); delete process.env.ENABLE_USD_BILLING; delete process.env.PAYMENTS_PROVIDER;
const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js');
const { PLANS, priceOf } = await import('../src/plans.js'); const C = await import('../src/currency.js'); const S = await import('../src/payments/sumit.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const get = (p, h = {}) => fetch(B + p, { headers: h }).then(r => r.json());
const co = (body, h = {}) => fetch(B + '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) });
const fake = h => ({ headers: Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v])) });
try {
  assert.deepEqual(Object.fromEntries(Object.values(PLANS).map(p => [p.id, p.prices])), { free: { ILS: 0, USD: 0 }, starter: { ILS: 79, USD: 19 }, pro: { ILS: 179, USD: 49 }, agency: { ILS: 549, USD: 149 } }); ok('tiers: Free 0, Starter ₪79/$19, Pro ₪179/$49, Agency ₪549/$149');
  assert.throws(() => priceOf(PLANS.starter, 'EUR')); ok('unknown currency rejected');
  // detection
  assert.equal(C.detectCurrency(fake({})).currency, 'USD'); ok('default USD');
  assert.equal(C.detectCurrency(fake({ 'Accept-Language': 'he-IL,he;q=0.9' })).currency, 'ILS'); ok('Accept-Language he → ILS');
  assert.equal(C.detectCurrency(fake({}), 'he').currency, 'ILS'); assert.equal(C.detectCurrency(fake({ cookie: 'ranky_lang=he' })).currency, 'ILS'); ok('Hebrew UI locale → ILS');
  assert.equal(C.detectCurrency(fake({ 'CF-IPCountry': 'IL' })).currency, 'ILS'); assert.equal(C.detectCurrency(fake({ 'CF-IPCountry': 'US', 'Accept-Language': 'he' })).currency, 'USD'); ok('CF-IPCountry beats language (IL → ILS, US → USD)');
  assert.deepEqual(C.detectCurrency(fake({ 'CF-IPCountry': 'US' }), 'he'), { currency: 'ILS', source: 'locale' }); assert.equal(C.detectCurrency(fake({ 'CF-IPCountry': 'US', cookie: 'ranky_lang=he' })).currency, 'ILS'); ok('Hebrew UI beats geo (/he from US → ILS)');
  assert.equal(C.detectCurrency(fake({ 'CF-IPCountry': 'IL', cookie: 'ranky_lang=he' }), 'en').currency, 'ILS'); assert.equal(C.detectCurrency(fake({ 'CF-IPCountry': 'US', cookie: 'ranky_lang=he' }), 'en').currency, 'USD'); ok('explicit lang=en ignores stale ranky_lang=he cookie; geo decides');
  assert.equal(C.detectCurrency(fake({ cookie: 'ranky_currency=USD' }), 'he').currency, 'USD'); ok('toggle cookie beats Hebrew UI');
  assert.equal(C.detectCurrency(fake({ cookie: 'ranky_currency=USD', 'CF-IPCountry': 'IL' }), 'he').currency, 'USD'); assert.equal(C.detectCurrency(fake({ cookie: 'a=1; ranky_currency=ILS' })).currency, 'ILS'); ok('manual toggle cookie beats everything');
  assert.equal(C.detectCurrency(fake({ cookie: 'ranky_currency=BTC' })).currency, 'USD'); ok('invalid cookie ignored');
  // /api/pricing
  let p = await get('/api/pricing?lang=he'); assert.equal(p.currency, 'ILS'); assert.equal(p.vat, false); assert.equal(p.usdBilling, false); assert.equal(p.plans.find(x => x.id === 'pro').billing.amount, 179); ok('/api/pricing: Hebrew → ILS, vat:false, usdBilling:false');
  p = await get('/api/pricing?lang=en'); assert.equal(p.currency, 'USD'); const st = p.plans.find(x => x.id === 'starter').billing;
  assert.deepEqual(st, { currency: 'ILS', amount: 79, displayCurrency: 'USD', displayAmount: 19, fallback: true }); ok('flag off: USD visitor sees $19, checkout falls back to ₪79 (flagged)');
  p = await get('/api/pricing', { cookie: 'ranky_currency=ILS' }); assert.equal(p.currency, 'ILS'); ok('/api/pricing honours toggle cookie');
  // server-side lookup: client amounts ignored
  let j = await (await co({ plan: 'pro', email: 'a@t.test', currency: 'USD', amount: 1, price: 1, prices: { USD: 1 } })).json();
  assert.equal(j.billing.amount, 179); assert.equal(j.billing.currency, 'ILS'); const a = Object.values(getDb().accounts).find(x => x.email === 'a@t.test'); assert.equal(a.pendingBilling.amount, 179); ok('checkout ignores client-sent amount; uses PLANS');
  assert.equal((await co({ plan: 'free', email: 'b@t.test' })).status, 400); assert.equal((await co({ plan: '__proto__', email: 'b@t.test' })).status, 400);
  assert.equal((await (await co({ plan: 'pro', email: 'b@t.test', currency: 'EUR' })).json()).billing.currency, 'ILS'); ok('free / prototype plan names rejected');
  j = await (await co({ plan: 'agency', email: 'c@t.test' }, { 'CF-IPCountry': 'IL' })).json(); assert.deepEqual([j.billing.currency, j.billing.amount, j.billing.fallback], ['ILS', 549, false]); ok('Israeli visitor charged ₪549 for Agency');
  // return path re-derives amount even if stored quote is tampered with
  const ident = new URL(B + j.redirectUrl).searchParams.get('account'); const acc = getDb().accounts[ident.split('.')[0]]; acc.pendingBilling.amount = 1;
  const r = await fetch(`${B}/billing/return?Valid=1&Token=tok&Identifier=${encodeURIComponent(ident)}`); assert.equal(r.status, 200); assert.deepEqual(acc.billing, { currency: 'ILS', amount: 549 }); ok('billing/return re-derives price from PLANS');
  // flag on
  process.env.ENABLE_USD_BILLING = '1';
  assert.deepEqual(C.billingFor(PLANS.starter, 'USD'), { currency: 'USD', amount: 19, displayCurrency: 'USD', displayAmount: 19, fallback: false }); ok('ENABLE_USD_BILLING=1 → USD charged in USD');
  delete process.env.ENABLE_USD_BILLING;
  // SUMIT payload
  const account = { id: 'acc1', email: 'x@y.test' };
  const il = S.buildChargeRequest({ account, plan: PLANS.pro, billing: { currency: 'ILS', amount: 179 }, token: 't' });
  assert.equal(il.Items[0].UnitPrice, 179); assert.equal(il.Items[0].Currency, S.SUMIT_CURRENCY.ILS); assert.equal(il.VATIncluded, false); assert.equal(il.VATRate, undefined); assert.equal(il.Customer.NoVAT, true); assert.equal(il.DocumentType, 2); ok('SUMIT ILS charge: ₪179, no VAT, receipt (קבלה) document');
  assert.throws(() => S.buildChargeRequest({ account, plan: PLANS.pro, billing: { currency: 'USD', amount: 49 }, token: 't' }), /USD billing disabled/); ok('SUMIT refuses USD while flag off');
  process.env.ENABLE_USD_BILLING = 'true'; assert.equal(S.buildChargeRequest({ account, plan: PLANS.pro, billing: { currency: 'USD', amount: 49 }, token: 't' }).Items[0].Currency, S.SUMIT_CURRENCY.USD); delete process.env.ENABLE_USD_BILLING; ok('SUMIT USD charge when flag on');
  assert.throws(() => S.buildChargeRequest({ account, plan: PLANS.pro, billing: { currency: 'ILS', amount: 1 }, token: 't' }), /does not match/); ok('SUMIT adapter rejects amounts that differ from plan price');
  // no VAT / no tax-invoice wording in UI + legal
  const ui = fs.readFileSync('web/lib/i18n.ts', 'utf8') + fs.readFileSync('src/views.js', 'utf8') + fs.readFileSync('src/payments/sumit.js', 'utf8').replace(/never חשבונית מס[^\n]*/g, '');
  assert.ok(!/כולל מע"מ|\+ ?מע"מ|incl\.? VAT|plus VAT/i.test(ui)); assert.ok(!/VATIncluded: true/.test(ui)); ok('no VAT added or shown in UI/plan text');
  for (const f of ['legal/terms.md', 'legal/refunds.md', 'legal/refunds.he.md']) assert.ok(!/חשבונית מס-קבלה|invoice-receipt|חשבונית זיכוי/.test(fs.readFileSync(f, 'utf8').replace(/not an? [^.]*\./gi, '').replace(/ולא חשבונית[^.]*\./g, '')), f); ok('legal text uses קבלה, not חשבונית מס');
  const mirror = fs.readFileSync('web/lib/prices.ts', 'utf8'); for (const p of Object.values(PLANS)) assert.match(mirror, new RegExp(`${p.id}: \\{ ILS: ${p.prices.ILS}, USD: ${p.prices.USD} \\}`)); ok('web display mirror matches src/plans.js');
  const pc = fs.readFileSync('web/components/Pricing.tsx', 'utf8') + fs.readFileSync('web/components/Checkout.tsx', 'utf8'); assert.match(pc, /ranky_currency|setCurrencyCookie/); assert.ok(!/amount:/.test(fs.readFileSync('web/components/Checkout.tsx', 'utf8').match(/api<[^;]*\/api\/checkout[^;]*;/)[0])); ok('UI toggle saves cookie; checkout POST sends no amount');
  console.log(`ALL PRICING TESTS PASSED (${n})`);
} finally { srv.close(); }
await (await import('../src/store.js')).flush().catch(() => {}); TD.done(); console.log('  ✓ app/data untouched');
