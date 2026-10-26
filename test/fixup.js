// One-time Fix-up (₪390): checkout item via the existing SUMIT recurring/charge path with Recurrence 1 (single payment), mocked SUMIT
// (no network). Server-side price, ILS only, no card data, order recorded without touching plan/subscription, double-purchase guards,
// one-time receipt email (mock outbox), queued full scan + 30-day re-scan behind FIXUP_SCANS_ENABLED, legal text present.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('fixup');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'ADMIN_TEST_TOKEN', 'CRON_SECRET', 'FIXUP_SCANS_ENABLED', 'ENABLE_USD_BILLING']) delete process.env[k];
Object.assign(process.env, { DISABLE_IP_LIMIT: '1', SUMIT_COMPANY_ID: '123456', SUMIT_API_KEY: 'PRIVATE-KEY-secret-abcdef', SUMIT_PUBLIC_API_KEY: 'PUBLIC-KEY-xyz-123', CHARGE_RATE_MAX: '1000', PAYMENTS_PROVIDER: 'sumit', BASE_URL: 'https://askranky.com' });
const realFetch = globalThis.fetch; const calls = []; let nextRef = 900;
const { default: app } = await import('../server.js'); const { getDb, flush, save } = await import('../src/store.js'); const { runFixupScans } = await import('../src/fixup.js'); const { PRODUCTS } = await import('../src/plans.js');
const { buildChargeRequest } = await import('../src/payments/sumit.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
globalThis.fetch = async (u, o) => { const url = String(u); if (url.startsWith(B)) return realFetch(u, o); if (!url.startsWith('https://api.sumit.co.il/')) throw new Error('outbound fetch blocked: ' + url);
  calls.push({ path: url.slice(23), body: JSON.parse(o.body) }); return new Response(JSON.stringify({ Status: 0, Data: { Payment: { ValidPayment: true, Status: '000' }, RecurringCustomerItemIDs: [nextRef++], CustomerID: 9, DocumentID: 77 } }), { headers: { 'content-type': 'application/json' } }); };
const post = (p, body, h = {}) => realFetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const charges = () => calls.filter(c => c.path === '/billing/recurring/charge/'); const acct = e => Object.values(getDb().accounts).find(a => a.email === e); let t = 0; const tok = () => `single-use-token-${++t}-abcdefgh`;
try {
  const req = buildChargeRequest({ account: { id: 'a1', email: 'x@t.test' }, plan: PRODUCTS.fixup, billing: { currency: 'ILS', amount: 390 }, token: 'tok-abcdefgh' });
  assert.equal(req.Items[0].Recurrence, 1); assert.equal(req.Items[0].UnitPrice, 390); assert.equal(req.Items[0].Currency, 0); assert.equal(req.DocumentType, 2); assert.match(req.Items[0].Item.Description, /One-time/);
  assert.throws(() => buildChargeRequest({ account: { id: 'a1' }, plan: PRODUCTS.fixup, billing: { currency: 'ILS', amount: 1 }, token: 'tok-abcdefgh' }), /does not match/);
  assert.throws(() => buildChargeRequest({ account: { id: 'a1' }, plan: PRODUCTS.fixup, billing: { currency: 'USD', amount: 390 }, token: 'tok-abcdefgh' }));
  ok('charge payload: Recurrence 1 (exactly one payment), ₪390 from PRODUCTS, ILS only, receipt document (DocumentType 2)');
  const pr = await (await realFetch(B + '/api/pricing?lang=en&currency=USD')).json(); const fx = pr.products.find(p => p.id === 'fixup'); assert.equal(fx.billing.amount, 390); assert.equal(fx.billing.currency, 'ILS'); assert.ok(!pr.plans.some(p => p.id === 'fixup'));
  ok('/api/pricing lists the Fix-up as a product (₪390 ILS even for a USD visitor), not as a plan');
  // purchase
  let r = await post('/api/checkout', { plan: 'fixup', email: 'fix@t.test', lang: 'he', amount: 1 }); let j = await r.json(); assert.equal(r.status, 200); assert.ok(j.embedded?.identifier); assert.equal(j.billing.amount, 390);
  r = await post('/api/checkout/charge', { identifier: j.embedded.identifier, token: tok(), lang: 'he' }); assert.equal(r.status, 200); assert.equal(charges().length, 1); assert.equal(charges()[0].body.Items[0].UnitPrice, 390);
  const a = acct('fix@t.test'); assert.equal(a.plan, 'free'); assert.ok(!a.subscriptionRef); assert.equal(a.orders.length, 1); const o = a.orders[0]; assert.equal(o.status, 'paid'); assert.equal(o.amount, 390); assert.ok(o.ref);
  assert.ok(Math.abs(Date.parse(o.rescanDueAt) - Date.parse(o.at) - 30 * 864e5) < 5e3); assert.ok(getDb().events.some(e => e.type === 'order.paid' && e.product === 'fixup'));
  ok('purchase: client amount ignored, one charge of ₪390, order recorded (paid, re-scan due in 30 days); plan stays free and no subscriptionRef (billing sync / MRR ignore it)');
  const out = fs.readdirSync(TD.outbox).map(f => fs.readFileSync(TD.outbox + '/' + f, 'utf8')).join('\n'); assert.ok(/תשלום חד־פעמי/.test(out) && /אין חידוש/.test(out)); ok('one-time receipt email (HE): no renewal wording (mock outbox)');
  r = await post('/api/checkout/charge', { identifier: j.embedded.identifier, token: tok(), lang: 'he' }); assert.equal(r.status, 409); assert.equal((await r.json()).error, 'fixup_open'); assert.equal(charges().length, 1);
  r = await post('/api/checkout', { plan: 'fixup', email: 'fix@t.test', lang: 'he' }); assert.equal(r.status, 409); assert.equal((await r.json()).error, 'fixup_open');
  ok('double purchase: repeat submit and a 2nd checkout while the Fix-up is open → 409 fixup_open, no 2nd charge');
  r = await post('/api/checkout', { plan: 'starter', email: 'fix@t.test', lang: 'he' }); assert.equal(r.status, 200); ok('a Fix-up buyer can still subscribe to a monthly plan');
  // a subscriber may buy a Fix-up
  r = await post('/api/checkout', { plan: 'pro', email: 'sub@t.test', lang: 'he' }); j = await r.json(); await post('/api/checkout/charge', { identifier: j.embedded.identifier, token: tok(), lang: 'he' });
  r = await post('/api/checkout', { plan: 'fixup', email: 'sub@t.test', lang: 'he' }); j = await r.json(); assert.equal(r.status, 200); r = await post('/api/checkout/charge', { identifier: j.embedded.identifier, token: tok(), lang: 'he' }); assert.equal(r.status, 200);
  const s = acct('sub@t.test'); assert.equal(s.plan, 'pro'); assert.equal(s.status, 'active'); assert.ok(String(s.subscriptionRef) !== String(s.orders[0].ref)); ok('an active subscriber can buy a Fix-up; plan and subscriptionRef unchanged');
  r = await post('/api/checkout', { plan: 'fixup', email: 'card@t.test', lang: 'he', cardNumber: '4111111111111111' }); assert.equal(r.status, 400); ok('card-like data still rejected on the product checkout');
  // scans
  process.env.CRON_SECRET = 'cron-secret-0123456789'; r = await post('/api/internal/cron/fixup', {}, { 'X-Cron-Secret': process.env.CRON_SECRET }); assert.equal((await r.json()).skipped, 'fixup_disabled');
  const db = getDb(); let res = await runFixupScans(); assert.equal(res.skipped.no_business, 2);
  db.businesses.bf = { id: 'bf', accountId: a.id, name: 'Fix Clinic', category: 'Dentist', city: 'Holon', scanIds: [] }; save();
  const seen = []; const fake = async (acc, b, opts) => { seen.push(opts.planOverride.id); const sc = { id: 'f' + seen.length, at: new Date().toISOString() }; return sc; };
  res = await runFixupScans({ scan: fake }); assert.equal(res.full, 1); assert.ok(o.fullScanId); res = await runFixupScans({ scan: fake }); assert.equal(res.full + res.rescan, 0);
  res = await runFixupScans({ scan: fake, now: new Date(Date.now() + 31 * 864e5) }); assert.equal(res.rescan, 1); assert.equal(o.status, 'rescanned'); assert.deepEqual(seen, ['fixup', 'fixup']);
  r = await post('/api/checkout', { plan: 'fixup', email: 'fix@t.test', lang: 'he' }); assert.equal(r.status, 200);
  ok('fix-up scans: flag off → skipped; no business → skipped for manual follow-up; full scan once, re-scan once after 30 days (product plan: 20 questions); order then closed and a new Fix-up can be bought');
  const real = await runFixupScans({ now: new Date(Date.now() + 31 * 864e5) }); assert.ok(real.full + real.rescan >= 0); // real runScan with mock engines (budget per product)
  for (const f of ['legal/terms.md', 'legal/terms.he.md', 'legal/refunds.md', 'legal/refunds.he.md']) assert.match(fs.readFileSync(f, 'utf8'), /Fix-up/);
  assert.ok(fs.readFileSync('.env.example', 'utf8').includes('FIXUP_SCANS_ENABLED=')); ok('terms + refunds (HE/EN) describe the Fix-up; flag documented');
  console.log(`ALL FIXUP TESTS PASSED (${n})`);
} finally { globalThis.fetch = realFetch; srv.close(); await flush(); TD.done(); }
process.exit(0);
