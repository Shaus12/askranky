// Hidden admin-only REAL 1 ILS test checkout. The SUMIT HTTP layer is mocked: no real network calls, no real keys.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('admintest');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'ADMIN_TEST_TOKEN', 'CRON_SECRET', 'SUMIT_WEBHOOK_SECRET']) delete process.env[k];
process.env.DISABLE_IP_LIMIT = '1'; process.env.SUMIT_COMPANY_ID = '123456'; process.env.SUMIT_API_KEY = 'SUMIT-API-KEY-SECRET-abcdef'; process.env.SUMIT_PUBLIC_API_KEY = 'SUMIT-PUBLIC-KEY-xyz'; process.env.ADMIN_FAIL_MAX = '6';
const TOKEN = 'adm-0123456789abcdef-TOKEN'; const SUMIT_PRIVATE = 'SUMIT-PRIVATE-DATA-777'; const CARD_TOKEN = 'single-use-card-token-999';
const realFetch = globalThis.fetch; const sumitCalls = []; let outbound = 0; let sumitMode = { charge: 'ok', listActive: false, listFail: false, cancelFail: false };
const { default: app } = await import('../server.js'); const { getDb, flush } = await import('../src/store.js'); const { syncAll } = await import('../src/jobs/billing-sync.js');
const { sumitPayments, buildChargeRequest } = await import('../src/payments/sumit.js'); const { PLANS } = await import('../src/plans.js'); const { TEST_PLAN } = await import('../src/payments/test-plan.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0;
const logs = []; const orig = { log: console.log, warn: console.warn, error: console.error }; for (const k of Object.keys(orig)) console[k] = (...a) => { logs.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); };
const ok = m => { n++; orig.log('  ✓', m); };
globalThis.fetch = async (u, o) => {
  const url = String(u); if (url.startsWith(B)) return realFetch(u, o);
  if (!url.startsWith('https://api.sumit.co.il/')) { outbound++; throw new Error('outbound fetch blocked in tests: ' + url); }
  const path = url.slice('https://api.sumit.co.il'.length); const body = JSON.parse(o.body); sumitCalls.push({ path, body });
  const res = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
  if (path === '/billing/recurring/charge/') return sumitMode.charge === 'ok'
    ? res({ Status: 0, Data: { Payment: { ValidPayment: true, Status: '000' }, RecurringCustomerItemIDs: [555], CustomerID: 9, DocumentID: 4242, DocumentDownloadURL: 'https://pay.sumit.test/' + SUMIT_PRIVATE } })
    : res({ Status: 1, UserErrorMessage: 'card declined ' + SUMIT_PRIVATE });
  if (path === '/billing/recurring/cancel/') return sumitMode.cancelFail ? res({ Status: 2, UserErrorMessage: 'boom' }) : res({ Status: 0, Data: {} });
  if (path === '/billing/recurring/listforcustomer/') return sumitMode.listFail ? res({ Status: 2, UserErrorMessage: 'boom' }) : res({ Status: 0, Data: { RecurringItems: [{ ID: 555, Status: sumitMode.listActive ? 0 : 1 }] } });
  throw new Error('unexpected SUMIT call ' + path);
};
const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const adm = (p, body, tok = TOKEN) => post(p, body, tok === null ? {} : { 'x-admin-test-token': tok });
const acct = email => Object.values(getDb().accounts).find(a => a.email === email); const outbox = () => fs.existsSync(TD.outbox) ? fs.readdirSync(TD.outbox).length : 0;
const identOf = j => new URL(j.redirectUrl).searchParams.get('identifier'); const chargeCalls = () => sumitCalls.filter(c => c.path === '/billing/recurring/charge/');
try {
  // ---- mock mode (no PAYMENTS_PROVIDER): unchanged; the new endpoint and page do not exist ----
  process.env.ADMIN_TEST_TOKEN = TOKEN; process.env.PRELAUNCH = '1';
  assert.equal((await adm('/api/admin/test-checkout', { email: 'a@t.test' })).status, 404); assert.equal((await fetch(B + '/admin/test-checkout')).status, 404);
  let r = await adm('/api/checkout', { plan: 'starter', email: 'm@t.test', currency: 'ILS' }, null); assert.equal(r.status, 403);
  r = await post('/api/checkout', { plan: 'starter', email: 'm@t.test' }, { 'x-admin-test-token': TOKEN }); assert.equal(r.status, 200); assert.match((await r.json()).redirectUrl, /mock-checkout/); assert.equal(sumitCalls.length, 0);
  ok('mock mode: admin endpoint + page are 404; the existing mock admin test checkout still works; public pre-launch checkout still 403; no SUMIT call');

  // ---- sumit mode: gating ----
  process.env.PAYMENTS_PROVIDER = 'sumit';
  assert.equal((await adm('/api/admin/test-checkout', { email: 'a@t.test' }, null)).status, 401); assert.equal((await adm('/api/admin/test-checkout', { email: 'a@t.test' }, 'wrong')).status, 401); assert.equal((await adm('/api/admin/test-checkout', { email: 'a@t.test' }, TOKEN + 'x')).status, 401);
  assert.equal((await post('/api/admin/test-checkout?admin_token=' + TOKEN, { email: 'a@t.test', adminToken: TOKEN })).status, 401); assert.equal((await adm('/api/admin/test-checkout/login-link', { email: 'a@t.test' }, null)).status, 401);
  assert.equal(sumitCalls.length, 0); ok('token required: missing/wrong/long token, token in query or body, other admin endpoint -> 401, no SUMIT call');
  process.env.ADMIN_TEST_TOKEN = 'short'; assert.equal((await adm('/api/admin/test-checkout', { email: 'a@t.test' }, 'short')).status, 404); assert.equal((await fetch(B + '/admin/test-checkout')).status, 404); process.env.ADMIN_TEST_TOKEN = TOKEN;
  ok('ADMIN_TEST_TOKEN unset/short -> everything 404');
  r = await fetch(B + '/admin/test-checkout'); const html = await r.text(); assert.equal(r.status, 200); assert.match(r.headers.get('x-robots-tag'), /noindex/); assert.match(html, /name="robots" content="noindex/); assert.equal(r.headers.get('cache-control'), 'no-store');
  for (const p of ['/sitemap.xml', '/robots.txt', '/llms.txt', '/he', '/en', '/he/checkout', '/en/scan']) { const t = await (await fetch(B + p)).text(); assert.ok(!/admin\/test-checkout|admin-test|test-checkout/.test(t), p); }
  const webSrc = fs.readdirSync('web/components').map(f => fs.readFileSync('web/components/' + f, 'utf8')).join('\n'); assert.ok(!webSrc.includes('admin/test-checkout'));
  ok('hidden page: 200 only when enabled, noindex (header + meta), no-store, not in sitemap/robots/llms.txt, not linked from the site or the frontend source');
  for (let i = 0; i < 12; i++) await adm('/api/admin/test-checkout', { email: 'a@t.test' }, 'bad' + i); assert.equal((await adm('/api/admin/test-checkout', { email: 'a@t.test' }, 'bad-final')).status, 429); assert.equal((await adm('/api/admin/test-checkout', { email: 'rl@t.test' })).status, 200); ok('repeated wrong tokens are rate limited (429); the right token is never blocked by it');
  getDb().accounts[acct('rl@t.test').id].pendingTest = undefined; delete getDb().accounts[acct('rl@t.test').id];

  // ---- public surface unchanged ----
  assert.deepEqual(Object.keys(PLANS), ['free', 'starter', 'pro', 'agency']); assert.deepEqual(Object.values(PLANS).map(p => [p.prices.ILS, p.prices.USD]), [[0, 0], [79, 19], [179, 49], [549, 149]]);
  r = await fetch(B + '/api/pricing'); const pj = JSON.stringify(await r.json()); assert.ok(!/"test"|Test \(1 ILS\)/.test(pj)); for (const x of ['79', '179', '549']) assert.ok(pj.includes(x));
  process.env.PRELAUNCH = '0'; for (const bad of ['test', 'TEST', 'constructor', '__proto__']) assert.equal((await post('/api/checkout', { plan: bad, email: 'p@t.test' })).status, 400); assert.equal((await post('/checkout', { plan: 'test', email: 'p@t.test' })).status, 400);
  assert.equal(acct('p@t.test'), undefined); assert.ok(!('test' in PLANS)); assert.throws(() => buildChargeRequest({ account: { id: 'x', email: 'x@t.test' }, plan: PLANS.starter, billing: { currency: 'ILS', amount: 1 }, token: 't' }), /Amount does not match/);
  assert.throws(() => buildChargeRequest({ account: { id: 'x', email: 'x@t.test' }, plan: TEST_PLAN, billing: { currency: 'USD', amount: 0 }, token: 't' })); process.env.PRELAUNCH = '1';
  ok('public API unchanged: plans/prices (79/179/549) intact, test plan not listed, not selectable via /api/checkout or /checkout, a public plan can never be charged 1 ILS, USD rejected for the test plan');

  // ---- the flow (works while PRELAUNCH is on) ----
  const E1 = 'shai@t.test'; r = await adm('/api/admin/test-checkout', { email: 'bad' }); assert.equal(r.status, 400); r = await adm('/api/admin/test-checkout', { email: E1 }); let j = await r.json(); assert.equal(r.status, 200);
  const u = new URL(j.redirectUrl); assert.equal(u.origin + u.pathname, 'https://app.sumit.co.il/creditguy/external/tokenize/'); assert.ok(acct(E1).pendingTest); assert.equal(sumitCalls.length, 0, 'starting does not charge');
  r = await fetch(`${B}/billing/return?Valid=1&Token=${CARD_TOKEN}&Identifier=${encodeURIComponent(identOf(j))}&lang=he`); assert.equal(r.status, 200);
  assert.equal(chargeCalls().length, 1); const c = chargeCalls()[0].body; const it = c.Items[0];
  assert.equal(it.UnitPrice, 1); assert.equal(it.Currency, 0); assert.equal(it.Recurrence, 1); assert.equal(it.Duration_Months, 1); assert.equal(c.DocumentType, 2); assert.equal(c.Customer.NoVAT, true); assert.equal(c.VATIncluded, false); assert.equal(c.OnlyDocument, false); assert.equal(c.SingleUseToken, CARD_TOKEN); assert.equal(c.Customer.EmailAddress, E1);
  ok('flow while pre-launch: real recurring/charge payload = 1 ILS (Currency 0), Recurrence 1 (one payment), DocumentType 2 receipt, NoVAT true, VATIncluded false');
  const a = acct(E1); assert.equal(a.plan, 'starter'); assert.equal(a.testSubscription, true); assert.deepEqual(a.billing, { currency: 'ILS', amount: 1 }); assert.equal(a.subscriptionRef, '555'); assert.equal(a.status, 'active'); const hrs = (Date.parse(a.paidThrough) - Date.now()) / 36e5; assert.ok(hrs > 23 && hrs <= 24.01);
  assert.ok(!a.pendingTest && !a.checkoutState); assert.ok(getDb().events.some(e => e.type === 'subscription.activated' && e.test === true && e.documentId === 4242));
  r = await fetch(`${B}/billing/return?Valid=1&Token=${CARD_TOKEN}&Identifier=${encodeURIComponent(identOf(j))}`); assert.ok([400, 403].includes(r.status)); assert.equal(chargeCalls().length, 1); ok('subscription: test flag, 24h access, billing 1 ILS, document id recorded; replaying the return URL is rejected (no second charge)');

  // ---- guards ----
  r = await adm('/api/admin/test-checkout', { email: E1 }); assert.equal(r.status, 409); assert.equal((await r.json()).error, 'test_active_cancel_first');
  const real = { id: 'REAL1', key: 'k'.repeat(40), email: 'real@t.test', plan: 'pro', status: 'active', subscriptionRef: '777', createdAt: new Date().toISOString(), usage: {} }; getDb().accounts.REAL1 = real;
  assert.equal((await adm('/api/admin/test-checkout', { email: 'real@t.test' })).status, 409); assert.equal((await adm('/api/admin/test-checkout/login-link', { email: 'real@t.test' })).status, 404); assert.equal(real.plan, 'pro'); assert.ok(!real.pendingTest);
  ok('guards: cannot start over an active test subscription or a real customer subscription; login-link refuses non-test accounts');

  // ---- expiry / stale / public override ----
  const E2 = 'old@t.test'; j = await (await adm('/api/admin/test-checkout', { email: E2 })).json(); acct(E2).pendingTest.at = new Date(Date.now() - 31 * 60e3).toISOString(); const before = chargeCalls().length;
  r = await fetch(`${B}/billing/return?Valid=1&Token=${CARD_TOKEN}&Identifier=${encodeURIComponent(identOf(j))}`); assert.equal(r.status, 400); assert.equal(chargeCalls().length, before); assert.equal(acct(E2).plan, 'free'); ok('a started test checkout expires after 30 minutes (400, no charge)');
  const E3 = 'pub@t.test'; j = await (await adm('/api/admin/test-checkout', { email: E3 })).json(); const staleIdent = identOf(j); process.env.PRELAUNCH = '0';
  r = await post('/api/checkout', { plan: 'starter', email: E3, currency: 'ILS' }); const j2 = await r.json(); assert.equal(r.status, 200); assert.ok(!acct(E3).pendingTest);
  r = await fetch(`${B}/billing/return?Valid=1&Token=${CARD_TOKEN}&Identifier=${encodeURIComponent(staleIdent)}`); assert.equal(r.status, 400);
  r = await fetch(`${B}/billing/return?Valid=1&Token=${CARD_TOKEN}&Identifier=${encodeURIComponent(identOf(j2))}`); assert.equal(r.status, 200); const pc = chargeCalls().at(-1).body; assert.equal(pc.Items[0].UnitPrice, 79); assert.equal(pc.Items[0].Recurrence, 0); assert.ok(!acct(E3).testSubscription); assert.equal(acct(E3).billing.amount, 79); process.env.PRELAUNCH = '1';
  ok('a public checkout for the same email clears a pending test: it is charged the normal 79 ILS, continuous recurrence; the stale test link is rejected');

  // ---- failed charge ----
  const E4 = 'fail@t.test'; j = await (await adm('/api/admin/test-checkout', { email: E4 })).json(); sumitMode.charge = 'fail';
  r = await fetch(`${B}/billing/return?Valid=1&Token=${CARD_TOKEN}&Identifier=${encodeURIComponent(identOf(j))}`); assert.equal(r.status, 502); assert.equal(acct(E4).plan, 'free'); assert.ok(!acct(E4).testSubscription); sumitMode.charge = 'ok'; ok('declined/failed charge: nothing activated');

  // ---- cancel via the normal self-serve flow ----
  const outBefore = outbox(); r = await post(`/api/dashboard/${a.id}/cancel`, { confirm: true, lang: 'he' }, { 'x-dashboard-key': a.key }); j = await r.json(); assert.equal(r.status, 200); assert.equal(j.ok, true);
  const cc = sumitCalls.filter(x => x.path === '/billing/recurring/cancel/').at(-1).body; assert.equal(cc.RecurringCustomerItemID, 555); assert.equal(a.status, 'cancelled'); assert.ok(outbox() > outBefore, 'cancellation email'); ok('self-serve cancel works for the test subscription: SUMIT cancel for RecurringCustomerItemID 555, status cancelled, written confirmation email');
  // login link for a test account, single use
  const E5 = 'link@t.test'; j = await (await adm('/api/admin/test-checkout', { email: E5 })).json(); await fetch(`${B}/billing/return?Valid=1&Token=${CARD_TOKEN}&Identifier=${encodeURIComponent(identOf(j))}`);
  r = await adm('/api/admin/test-checkout/login-link', { email: E5 }); j = await r.json(); assert.equal(r.status, 200); const lk = new URL(j.link); r = await fetch(B + lk.pathname + lk.search, { redirect: 'manual' }); assert.equal(r.status, 302); assert.match(r.headers.get('location'), /^\/dashboard\//);
  r = await fetch(B + lk.pathname + lk.search, { redirect: 'manual' }); assert.equal(r.status, 403); ok('login-link for a test account is a normal single-use magic link');

  // ---- daily sync: test subscriptions never renew / never past_due; expire after 24h ----
  for (const x of Object.values(getDb().accounts)) if (!x.testSubscription) delete x.subscriptionRef; // isolate: only test subscriptions take part in the sync assertions
  const T = acct('sync@t.test') || (getDb().accounts.TST1 = { id: 'TST1', key: 'k'.repeat(40), email: 'sync@t.test', plan: 'starter', status: 'active', testSubscription: true, subscriptionRef: '555', billing: { currency: 'ILS', amount: 1 }, paidThrough: new Date(Date.now() + 3600e3).toISOString(), lang: 'he', usage: {} });
  let calls0 = sumitCalls.length, mails0 = outbox(); let out = await syncAll({ payments: sumitPayments, now: new Date() }); assert.equal(T.plan, 'starter'); assert.equal(T.status, 'active'); assert.ok(!sumitCalls.slice(calls0).some(x => x.body.Customer?.ExternalIdentifier === T.id), 'no SUMIT call for a live test subscription'); assert.equal(outbox(), mails0); assert.equal(out.renewed, 0);
  ok('sync: a live test subscription is skipped entirely (no renewal, no SUMIT call, no emails)');
  T.paidThrough = new Date(Date.now() - 3600e3).toISOString(); sumitMode.listActive = false; calls0 = sumitCalls.length; out = await syncAll({ payments: sumitPayments, now: new Date() });
  assert.equal(T.plan, 'free'); assert.equal(T.status, 'cancelled_ended'); assert.equal(out.downgraded >= 1, true); assert.ok(!sumitCalls.slice(calls0).some(x => x.path.includes('cancel') && x.body.Customer?.ExternalIdentifier === T.id), 'nothing to cancel when the standing order is already inactive'); assert.equal(outbox(), mails0, 'no failed-payment email');
  const T2 = getDb().accounts.TST2 = { ...T, id: 'TST2', email: 'sync2@t.test', plan: 'starter', status: 'active', paidThrough: new Date(Date.now() - 3600e3).toISOString() }; delete T2.cancelledAt; sumitMode.listActive = true; calls0 = sumitCalls.length; await syncAll({ payments: sumitPayments, now: new Date() });
  assert.ok(sumitCalls.slice(calls0).some(x => x.path === '/billing/recurring/cancel/' && x.body.Customer.ExternalIdentifier === 'TST2')); assert.equal(T2.plan, 'free'); assert.equal(outbox(), mails0);
  const T3 = getDb().accounts.TST3 = { ...T2, id: 'TST3', email: 'sync3@t.test', plan: 'starter', status: 'active' }; sumitMode.cancelFail = true; out = await syncAll({ payments: sumitPayments, now: new Date() }); assert.equal(T3.plan, 'starter'); assert.ok(out.errors >= 1); sumitMode.cancelFail = false; await syncAll({ payments: sumitPayments, now: new Date() }); assert.equal(T3.plan, 'free');
  ok('sync: 24h after the charge the test subscription is ended; if SUMIT still shows it active it is cancelled first (retried on the next run if that fails); no failed-payment email, never past_due');

  // ---- logs ----
  const all = logs.join('\n'); for (const s of [TOKEN, 'SUMIT-API-KEY-SECRET-abcdef', 'SUMIT-PUBLIC-KEY-xyz', SUMIT_PRIVATE, CARD_TOKEN]) assert.ok(!all.includes(s), 'leak: ' + s);
  assert.ok(all.includes('[admin-test] charge ok doc=4242')); assert.ok(all.includes('[admin-test] charge failed')); ok('logs contain neither the admin token, SUMIT keys, card token nor SUMIT response data (only "charge ok doc=<id>" / "charge failed")');
  assert.equal(outbound, 0); Object.assign(console, orig); console.log(`ALL ADMIN TEST-CHECKOUT TESTS PASSED (${n})`);
} finally { Object.assign(console, orig); globalThis.fetch = realFetch; srv.close(); await flush(); TD.done(); }
process.exit(0);
