// Founding-member offer: policy text only (no billing logic). FOUNDING_MEMBER_LIMIT (default 20, 0 hides) via /api/pricing; honest copy
// (no live counter, "first N customers"), 30-day deliver-or-refund text on the cards and in the refund policy (HE/EN). Checkout prices unchanged.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('founding');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'FOUNDING_MEMBER_LIMIT']) delete process.env[k]; process.env.DISABLE_IP_LIMIT = '1';
const { default: app } = await import('../server.js'); const { foundingLimit, PLANS } = await import('../src/plans.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const pricing = async () => (await (await fetch(B + '/api/pricing?lang=he')).json());
try {
  let j = await pricing(); assert.deepEqual(j.founding, { limit: 20, price: { ILS: 79 }, plan: 'starter' }); assert.equal(PLANS.starter.prices.ILS, 79); ok('default: first 20 customers, ₪79 Starter lock (price from src/plans.js)');
  process.env.FOUNDING_MEMBER_LIMIT = '10'; assert.equal((await pricing()).founding.limit, 10); process.env.FOUNDING_MEMBER_LIMIT = '0'; assert.equal((await pricing()).founding.limit, 0);
  process.env.FOUNDING_MEMBER_LIMIT = 'abc'; assert.equal(foundingLimit(), 20); process.env.FOUNDING_MEMBER_LIMIT = '-3'; assert.equal(foundingLimit(), 20); delete process.env.FOUNDING_MEMBER_LIMIT; ok('FOUNDING_MEMBER_LIMIT is config (0 hides the offer; invalid → 20)');
  const i18n = fs.readFileSync('web/lib/i18n.ts', 'utf8'); assert.ok(i18n.includes('The first {n} customers keep ₪79/month') && i18n.includes('{n} הלקוחות הראשונים נשארים על ₪79 לחודש'));
  assert.ok(!/spots? left|remaining|נותרו|נשארו \d/i.test(i18n.split('\n').filter(l => l.includes('founding: {')).join(' '))); ok('copy: "first N customers", no live/remaining counter claims');
  const pr = fs.readFileSync('web/components/Pricing.tsx', 'utf8'); assert.ok(pr.includes('data?.founding?.limit') && pr.includes('legal/refunds')); ok('pricing cards render the offer only when the server limit > 0, with a link to the refund policy');
  assert.match(fs.readFileSync('legal/refunds.md', 'utf8'), /## 1B\. Founding members[\s\S]*Deliver-or-refund: if within 30 days/); assert.match(fs.readFileSync('legal/refunds.he.md', 'utf8'), /## 1ב\. לקוחות מייסדים[\s\S]*מסירה או החזר/);
  const srvSrc = fs.readFileSync('server.js', 'utf8'); assert.ok(!/founding/i.test(srvSrc.slice(srvSrc.indexOf('async function completeCheckout'), srvSrc.indexOf('app.get(\'/billing/return\'')))); ok('refund policy (HE/EN) carries the founding + deliver-or-refund text; checkout/billing code untouched');
  assert.ok(fs.readFileSync('.env.example', 'utf8').includes('FOUNDING_MEMBER_LIMIT=20'));
  console.log(`ALL FOUNDING TESTS PASSED (${n})`);
} finally { srv.close(); TD.done(); }
process.exit(0);
