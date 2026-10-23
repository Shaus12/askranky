// Double-charge guard: an account with an ACTIVE paid subscription can't start or complete another checkout (409 already_subscribed),
// past-due accounts may re-subscribe (card replacement; the old failed order is superseded), concurrent/duplicate submits never charge twice.
// SUMIT is mocked (no network).
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('dblcharge');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'ADMIN_TEST_TOKEN', 'CRON_SECRET', 'SUMIT_WEBHOOK_SECRET', 'SUMIT_API_PUBLIC_KEY']) delete process.env[k];
Object.assign(process.env, { DISABLE_IP_LIMIT: '1', SUMIT_COMPANY_ID: '123456', SUMIT_API_KEY: 'PRIVATE-KEY-secret-abcdef', SUMIT_PUBLIC_API_KEY: 'PUBLIC-KEY-xyz-123', CHARGE_RATE_MAX: '1000', PAYMENTS_PROVIDER: 'sumit', BASE_URL: 'https://askranky.com' });
const realFetch = globalThis.fetch; const calls = []; let outbound = 0, delayMs = 0, nextRef = 700, cancelFails = false;
const { default: app, hasActiveSubscription, ALREADY_SUBSCRIBED } = await import('../server.js'); const { getDb, flush, save } = await import('../src/store.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0;
const logs = []; const orig = { log: console.log, warn: console.warn, error: console.error }; for (const k of Object.keys(orig)) console[k] = (...a) => { logs.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); };
const ok = m => { n++; orig.log('  ✓', m); };
globalThis.fetch = async (u, o) => { const url = String(u); if (url.startsWith(B)) return realFetch(u, o);
  if (!url.startsWith('https://api.sumit.co.il/')) { outbound++; throw new Error('outbound fetch blocked in tests: ' + url); }
  const path = url.slice('https://api.sumit.co.il'.length); calls.push({ path, body: JSON.parse(o.body) }); if (delayMs) await new Promise(r => setTimeout(r, delayMs));
  if (path === '/billing/recurring/cancel/' && cancelFails) return new Response(JSON.stringify({ Status: 1, UserErrorMessage: 'already disabled' }), { headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ Status: 0, Data: { Payment: { ValidPayment: true, Status: '000' }, RecurringCustomerItemIDs: [nextRef++], CustomerID: 9, DocumentID: 4242 } }), { headers: { 'content-type': 'application/json' } }); };
const post = (p, body) => realFetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const acct = email => Object.values(getDb().accounts).find(a => a.email === email); const charges = () => calls.filter(c => c.path === '/billing/recurring/charge/'); const cancels = () => calls.filter(c => c.path === '/billing/recurring/cancel/');
let tokN = 0; const tok = () => `single-use-token-${++tokN}-abcdefgh`;
const start = async (email, plan = 'starter') => { const r = await post('/api/checkout', { plan, email, lang: 'he' }); return { r, j: await r.json() }; };
try {
  // ---- pure rule ----
  const future = new Date(Date.now() + 864e5).toISOString(), past = new Date(Date.now() - 864e5).toISOString(); const sub = x => ({ plan: 'pro', subscriptionRef: '5', status: 'active', ...x });
  assert.equal(hasActiveSubscription(sub()), true); assert.equal(hasActiveSubscription(sub({ status: 'cancelled', paidThrough: future })), true, 'cancelled but paid period not over');
  assert.equal(hasActiveSubscription(sub({ status: 'cancelled', paidThrough: past })), false); assert.equal(hasActiveSubscription(sub({ status: 'past_due' })), false); assert.equal(hasActiveSubscription(sub({ status: 'unpaid', plan: 'free' })), false);
  assert.equal(hasActiveSubscription({ plan: 'free' }), false); assert.equal(hasActiveSubscription(sub({ testSubscription: true })), false); assert.equal(hasActiveSubscription(sub({ subscriptionRef: undefined })), false); assert.equal(hasActiveSubscription(undefined), false);
  ok('rule: active (and cancelled-until-period-end) blocks; past_due, unpaid, ended, free, admin-test and no-subscription accounts do not');
  // ---- first purchase, then blocked ----
  let { r, j } = await start('buy@t.test'); assert.equal(r.status, 200); assert.ok(j.embedded?.identifier);
  const id1 = j.embedded.identifier; r = await post('/api/checkout/charge', { identifier: id1, token: tok(), lang: 'he' }); assert.equal(r.status, 200); assert.equal(charges().length, 1); const a = acct('buy@t.test'); assert.equal(a.status, 'active'); assert.equal(a.plan, 'starter');
  ({ r, j } = await start('buy@t.test')); assert.equal(r.status, 409); assert.equal(j.error, 'already_subscribed'); assert.equal(j.code, 'already_subscribed'); assert.match(j.message, /active subscription/); assert.match(j.messageHe, /מנוי פעיל/); assert.deepEqual(j, ALREADY_SUBSCRIBED); assert.ok(!j.embedded);
  ({ r, j } = await start('BUY@t.test', 'pro')); assert.equal(r.status, 409, 'email case does not matter, other plan blocked too');
  r = await post('/checkout', { plan: 'starter', email: 'buy@t.test', lang: 'en' }); assert.equal(r.status, 409); const hp = await r.text(); assert.match(hp, /already have an active subscription/); assert.match(hp, /href="\/en\/login"/);
  r = await post('/checkout', { plan: 'starter', email: 'buy@t.test', lang: 'he' }); assert.match(await r.text(), /כבר יש לך מנוי פעיל/);
  assert.equal(charges().length, 1, 'no extra SUMIT charge'); assert.ok(!a.pendingPlan || a.checkoutState === undefined, 'blocked start left no new checkout state');
  ok('active subscription: POST /api/checkout and /checkout → 409 already_subscribed (he+en message, login link), no new checkout state, no SUMIT call');
  // ---- replay / second device with a NEW token after success ----
  r = await post('/api/checkout/charge', { identifier: id1, token: tok(), lang: 'he' }); j = await r.json(); assert.equal(r.status, 409); assert.equal(j.error, 'already_subscribed'); assert.equal(charges().length, 1);
  r = await post('/api/checkout/charge', { identifier: a.id + '.forged-state-xx', token: tok() }); assert.equal(r.status, 400, 'a forged state gets the same 400 as any invalid checkout (no account-status probing via the charge route)'); assert.equal(charges().length, 1);
  r = await post('/api/checkout/charge', { identifier: 'nobody.state', token: tok() }); assert.equal(r.status, 400);
  ok('second charge (new token) after success → 409, never a second SUMIT charge; forged/unknown identifiers stay 400');
  // ---- cancelled with time left stays blocked; after the period it may subscribe again ----
  a.status = 'cancelled'; a.paidThrough = future; save(); ({ r, j } = await start('buy@t.test')); assert.equal(r.status, 409);
  a.paidThrough = past; save(); ({ r, j } = await start('buy@t.test')); assert.equal(r.status, 200, 'ended cancelled account may subscribe again'); assert.ok(j.embedded);
  ok('cancelled-until-period-end is blocked; once the paid period is over the account can subscribe again');
  // ---- past-due re-subscribe = card replacement; old order superseded ----
  const pd = await start('late@t.test'); await post('/api/checkout/charge', { identifier: pd.j.embedded.identifier, token: tok() }); const late = acct('late@t.test'); const oldRef = late.subscriptionRef;
  Object.assign(late, { status: 'past_due', pastDueSince: past, failedNoticeAt: past }); save(); const nC = charges().length, nX = cancels().length;
  ({ r, j } = await start('late@t.test')); assert.equal(r.status, 200); r = await post('/api/checkout/charge', { identifier: j.embedded.identifier, token: tok(), lang: 'he' }); assert.equal(r.status, 200); assert.equal(charges().length, nC + 1);
  assert.equal(late.status, 'active'); assert.notEqual(late.subscriptionRef, oldRef); assert.equal(late.pastDueSince, undefined); assert.equal(late.failedNoticeAt, undefined);
  assert.equal(cancels().length, nX + 1); assert.equal(cancels().at(-1).body.RecurringCustomerItemID, Number(oldRef), 'the OLD order is cancelled'); assert.notEqual(cancels().at(-1).body.RecurringCustomerItemID, Number(late.subscriptionRef), 'never the new one');
  assert.ok(getDb().events.some(e => e.type === 'subscription.superseded' && e.account === late.id && e.cancelled === true));
  ok('past_due account may re-subscribe: new standing order becomes the subscription, the old failed one is cancelled via the existing cancel path');
  const pd2 = await start('late2@t.test'); await post('/api/checkout/charge', { identifier: pd2.j.embedded.identifier, token: tok() }); const late2 = acct('late2@t.test'); Object.assign(late2, { status: 'past_due', pastDueSince: past }); save(); cancelFails = true;
  ({ r, j } = await start('late2@t.test')); r = await post('/api/checkout/charge', { identifier: j.embedded.identifier, token: tok() }); assert.equal(r.status, 200, 'a failing cancel of the old order never fails the new subscription'); assert.equal(late2.status, 'active');
  assert.ok(getDb().events.some(e => e.type === 'subscription.superseded' && e.account === late2.id && e.cancelled === false)); cancelFails = false;
  ok('old-order cancel failure (already disabled at SUMIT) is recorded but does not affect the new subscription');
  // ---- concurrent double submit (two tabs/devices) ----
  const dd = await start('dbl@t.test'); const idd = dd.j.embedded.identifier; const before = charges().length; delayMs = 150;
  const first = post('/api/checkout/charge', { identifier: idd, token: tok(), lang: 'he' }); await new Promise(r => setTimeout(r, 40));
  const during = await start('dbl@t.test'); const second = await post('/api/checkout/charge', { identifier: idd, token: tok(), lang: 'he' }); const sj = await second.json(); const f = await first; delayMs = 0;
  assert.equal(during.r.status, 409); assert.equal(during.j.error, 'busy'); assert.equal(second.status, 409); assert.equal(sj.error, 'busy'); assert.equal(f.status, 200); assert.equal(charges().length, before + 1, 'exactly one SUMIT charge');
  const third = await post('/api/checkout/charge', { identifier: idd, token: tok() }); assert.equal(third.status, 409); assert.equal((await third.json()).error, 'already_subscribed'); assert.equal(charges().length, before + 1);
  const par = await start('par@t.test'); const idp = par.j.embedded.identifier; const b2 = charges().length; delayMs = 30; const rs = await Promise.all([1, 2, 3, 4].map(() => post('/api/checkout/charge', { identifier: idp, token: tok() }))); delayMs = 0;
  assert.deepEqual(rs.map(x => x.status).sort(), [200, 409, 409, 409]); assert.equal(charges().length, b2 + 1);
  ok('concurrent submits (2 tabs / 4 parallel): one charge, others 409 busy/already_subscribed; a start during an in-flight charge is refused');
  // ---- no card data / secrets leaked ----
  const allBodies = JSON.stringify([ALREADY_SUBSCRIBED, sj, hp]); for (const s of ['single-use-token', 'PRIVATE-KEY', 'PUBLIC-KEY', 'RecurringCustomerItemID']) assert.ok(!allBodies.includes(s), 'response leak: ' + s);
  const rc = await post('/api/checkout/charge', { identifier: id1, token: tok(), cardNumber: '4580458045804580' }); assert.equal(rc.status, 400, 'card data still rejected by noCardData'); assert.ok(!(await rc.text()).includes('4580458045804580'));
  assert.ok(!logs.join('\n').match(/single-use-token|PRIVATE-KEY|4580458045804580/), 'logs carry no tokens, keys or card numbers');
  ok('409 bodies carry no token/keys/SUMIT data; card numbers still rejected; logs clean');
  // ---- mock provider unchanged ----
  process.env.PAYMENTS_PROVIDER = 'mock'; r = await post('/api/checkout', { plan: 'starter', email: 'mockuser@t.test', lang: 'en' }); j = await r.json(); assert.equal(r.status, 200); assert.ok(j.redirectUrl.startsWith('/mock-checkout?'));
  const ident = new URL(B + j.redirectUrl).searchParams.get('account'); r = await realFetch(`${B}/billing/return?Valid=1&Token=t&Identifier=${encodeURIComponent(ident)}`, { redirect: 'manual' }); assert.equal(r.status, 200); assert.equal(acct('mockuser@t.test').status, 'active');
  r = await realFetch(`${B}/billing/return?Valid=1&Token=t&Identifier=${encodeURIComponent(ident)}`, { redirect: 'manual' }); assert.equal(r.status, 409); ({ r, j } = await start('mockuser@t.test')); assert.equal(r.status, 409); assert.equal(j.error, 'already_subscribed');
  r = await post('/api/checkout', { plan: 'starter', email: 'mockfree@t.test', lang: 'en' }); assert.equal(r.status, 200); const ident2 = new URL(B + (await r.json()).redirectUrl).searchParams.get('account'); r = await realFetch(`${B}/billing/return?Valid=0&Identifier=${encodeURIComponent(ident2)}`); assert.match(await r.text(), /Payment failed/);
  ok('mock provider: new accounts check out as before (redirect page, return, declined); an active mock subscriber is blocked too');
  // ---- web ----
  const co = fs.readFileSync('web/components/Checkout.tsx', 'utf8'), cf = fs.readFileSync('web/components/CardForm.tsx', 'utf8'), pt = fs.readFileSync('web/lib/i18n-pay.ts', 'utf8');
  assert.match(co, /already_subscribed/); assert.match(co, /data-already-subscribed/); assert.match(co, /href=\{`\/\$\{lang\}\/login`\}/); assert.match(cf, /already_subscribed/); assert.match(cf, /onAlready/);
  assert.match(pt, /alreadyTitle: "You already have an active subscription"/); assert.match(pt, /alreadyTitle: "כבר יש לך מנוי פעיל"/); assert.match(pt, /alreadyCta: "Go to your dashboard"/); assert.match(pt, /alreadyCta: "ללוח הבקרה"/);
  ok('UI: calm HE/EN "already subscribed" panel with a dashboard (sign-in) link, from the start form and from the card form; strings in i18n-pay.ts');
  assert.equal(outbound, 0); Object.assign(console, orig); console.log(`ALL DOUBLE-CHARGE TESTS PASSED (${n})`);
} finally { Object.assign(console, orig); globalThis.fetch = realFetch; srv.close(); await flush(); TD.done(); }
process.exit(0);
