// Embedded SUMIT Payments JS checkout: token handling, card-data guard, CSP scope, PRELAUNCH gate, admin gate. SUMIT is mocked (no network).
import assert from 'node:assert/strict'; import fs from 'node:fs'; import crypto from 'node:crypto'; import { useTempData } from './helpers.js'; const TD = useTempData('sumitjs');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'ADMIN_TEST_TOKEN', 'CRON_SECRET', 'SUMIT_WEBHOOK_SECRET', 'SUMIT_API_PUBLIC_KEY']) delete process.env[k];
Object.assign(process.env, { DISABLE_IP_LIMIT: '1', SUMIT_COMPANY_ID: '123456', SUMIT_API_KEY: 'PRIVATE-KEY-secret-abcdef', SUMIT_PUBLIC_API_KEY: 'PUBLIC-KEY-xyz-123', CHARGE_RATE_MAX: '1000' });
const TOKEN = 'adm-0123456789abcdef-TOKEN', SUT = 'a1b2c3d4-0000-4aaa-bbbb-single-use-token', CARD = '4580458045804580';
const realFetch = globalThis.fetch; const sumitCalls = []; let outbound = 0;
const { default: app, noCardData } = await import('../server.js'); const { getDb, flush } = await import('../src/store.js');
const { embeddedConfig, validSingleUseToken, looksLikeCardNumber, sumitPayments } = await import('../src/payments/sumit.js'); const { checkConfig } = await import('../src/config-check.js');
const { checkoutCsp, inlineScriptHashes, SUMIT_SCRIPT_URL } = await import('../src/security/csp.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0;
const logs = []; const orig = { log: console.log, warn: console.warn, error: console.error }; for (const k of Object.keys(orig)) console[k] = (...a) => { logs.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); };
const ok = m => { n++; orig.log('  ✓', m); };
globalThis.fetch = async (u, o) => { const url = String(u); if (url.startsWith(B)) return realFetch(u, o);
  if (!url.startsWith('https://api.sumit.co.il/')) { outbound++; throw new Error('outbound fetch blocked in tests: ' + url); }
  sumitCalls.push({ path: url.slice('https://api.sumit.co.il'.length), body: JSON.parse(o.body) });
  return new Response(JSON.stringify({ Status: 0, Data: { Payment: { ValidPayment: true, Status: '000' }, RecurringCustomerItemIDs: [555], CustomerID: 9, DocumentID: 4242 } }), { headers: { 'content-type': 'application/json' } }); };
const post = (p, body, h = {}) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const acct = email => Object.values(getDb().accounts).find(a => a.email === email); const charges = () => sumitCalls.filter(c => c.path === '/billing/recurring/charge/');
const csp = async p => (await fetch(B + p)).headers.get('content-security-policy'); const dir = (c, d) => (c.split('; ').find(x => x.startsWith(d + ' ')) || '').split(' ').slice(1);
try {
  // ---- pure helpers ----
  assert.ok(looksLikeCardNumber('4580 4580 4580 4580') && looksLikeCardNumber('4111-1111-1111-1111') && !looksLikeCardNumber('1234567890123456') && !looksLikeCardNumber('a1b2c3d4-0000-4aaa-bbbb-single-use-token'));
  for (const bad of [undefined, null, '', 'short', 'x'.repeat(300), 'has space in it', CARD, '4580 4580 4580 4580', '<script>alert(1)</script>']) assert.equal(validSingleUseToken(bad), false, String(bad)); assert.equal(validSingleUseToken(SUT), true); assert.equal(validSingleUseToken('3f2504e0-4f89-11d3-9a0c-0305e82c3301'), true);
  assert.deepEqual(embeddedConfig('i.d'), { identifier: 'i.d', companyId: 123456, publicKey: 'PUBLIC-KEY-xyz-123' }); process.env.SUMIT_PUBLIC_API_KEY = process.env.SUMIT_API_KEY; assert.throws(() => embeddedConfig('i.d'), /must not equal the private/); process.env.SUMIT_PUBLIC_API_KEY = 'PUBLIC-KEY-xyz-123';
  assert.ok(!JSON.stringify(embeddedConfig('i.d')).includes('PRIVATE-KEY'));
  ok('token validation (opaque string, no card numbers), browser config is company id + PUBLIC key only and refuses the private key as public');
  // ---- config check ----
  const base = { PAYMENTS_PROVIDER: 'sumit', SUMIT_COMPANY_ID: '123456', SUMIT_API_KEY: 'priv', SUMIT_PUBLIC_API_KEY: 'pub', SUMIT_WEBHOOK_SECRET: 'w', BASE_URL: 'https://askranky.com' };
  assert.deepEqual(checkConfig(base).errors.filter(e => /SUMIT/.test(e)), []); assert.ok(checkConfig({ ...base, SUMIT_PUBLIC_API_KEY: 'priv' }).errors.some(e => /PUBLIC API key, not the private/.test(e))); assert.ok(checkConfig({ ...base, SUMIT_COMPANY_ID: 'abc' }).errors.some(e => /numeric/.test(e)));
  assert.ok(checkConfig({ ...base, SUMIT_PUBLIC_API_KEY: '' }).errors.some(e => e.startsWith('SUMIT_PUBLIC_API_KEY missing'))); assert.ok(!checkConfig({ ...base, SUMIT_PUBLIC_API_KEY: '', SUMIT_API_PUBLIC_KEY: 'pub' }).errors.some(e => /PUBLIC_API_KEY missing/.test(e)));
  assert.ok(!JSON.stringify(checkConfig({ ...base, SUMIT_PUBLIC_API_KEY: 'priv-value-123', SUMIT_API_KEY: 'priv-value-123' })).includes('priv-value-123'));
  ok('config-check: SUMIT_COMPANY_ID numeric, SUMIT_PUBLIC_API_KEY required (and != private key), names only, no values');
  // ---- CSP: unit ----
  const off = checkoutCsp({ turnstile: true }), on = checkoutCsp({ sumit: true, turnstile: true });
  assert.ok(!/sumit/.test(off)); assert.ok(dir(on, 'script-src').includes('https://app.sumit.co.il') && dir(on, 'connect-src').includes('https://api.sumit.co.il'));
  assert.deepEqual(dir(on, 'frame-src'), ['https://challenges.cloudflare.com']); assert.deepEqual(dir(on, 'form-action'), ["'self'"]); assert.deepEqual(dir(on, 'object-src'), ["'none'"]); assert.deepEqual(dir(on, 'frame-ancestors'), ["'none'"]); assert.deepEqual(dir(on, 'default-src'), ["'none'"]);
  assert.ok(!dir(on, 'script-src').includes("'unsafe-inline'") && !dir(on, 'script-src').includes("'unsafe-eval'") && !dir(on, 'script-src').includes('*'));
  assert.ok(!dir(on, 'connect-src').some(x => /^https:\/\/(?!api\.sumit\.co\.il|challenges\.cloudflare\.com)/.test(x)));
  ok('CSP builder: SUMIT script/API origins only when asked; no unsafe-inline/eval or wildcard in script-src; form-action self, frame-ancestors none');
  // ---- CSP: HTTP, sumit provider ----
  process.env.PAYMENTS_PROVIDER = 'sumit'; process.env.ADMIN_TEST_TOKEN = TOKEN; process.env.PRELAUNCH = '1';
  for (const l of ['he', 'en']) { const c = await csp(`/${l}/checkout`); assert.ok(c, l); assert.ok(dir(c, 'script-src').includes('https://app.sumit.co.il')); assert.ok(dir(c, 'connect-src').includes('https://api.sumit.co.il'));
    const hashes = inlineScriptHashes(`web/out/${l}/checkout.html`); assert.ok(hashes.length > 0); for (const h of hashes) assert.ok(dir(c, 'script-src').includes(h), 'inline script hash allowed');
    const html = fs.readFileSync(`web/out/${l}/checkout.html`, 'utf8'); for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) if (m[1].trim()) assert.ok(dir(c, 'script-src').includes(`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`)); }
  const adminCsp = await csp('/admin/test-checkout'); assert.ok(adminCsp); assert.match(adminCsp, /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' https:\/\/app\.sumit\.co\.il/); assert.ok(!dir(adminCsp, 'script-src').includes("'unsafe-inline'")); assert.ok(dir(adminCsp, 'connect-src').includes('https://api.sumit.co.il')); assert.ok(!/challenges\.cloudflare/.test(adminCsp));
  const a1 = adminCsp.match(/nonce-([^']+)/)[1], a2 = (await csp('/admin/test-checkout')).match(/nonce-([^']+)/)[1]; assert.notEqual(a1, a2, 'fresh nonce per response');
  const adminHtml = await (await fetch(B + '/admin/test-checkout')).text(); assert.ok(adminHtml.includes('src="https://app.sumit.co.il/scripts/payments.js"') && adminHtml.includes('/vendor/jquery-3.7.1.min.js')); assert.equal((adminHtml.match(/<script(?![^>]*src=)[^>]*>/g) || []).length, 1); assert.ok(!/<script(?![^>]*src=)(?![^>]*nonce=)/.test(adminHtml));
  assert.ok(!/<input[^>]*\bname=/.test(adminHtml), 'admin page inputs have no name attribute (cannot be submitted natively)'); assert.ok(!adminHtml.includes('PUBLIC-KEY-xyz') && !adminHtml.includes('PRIVATE-KEY'), 'no keys in the page');
  for (const p of ['/he', '/en', '/he/scan', '/he/report', '/he/legal/terms', '/en/legal/privacy', '/api/config', '/api/pricing', '/health', '/robots.txt']) assert.equal(await csp(p), null, 'no CSP on ' + p);
  const jq = await fetch(B + '/vendor/jquery-3.7.1.min.js'); assert.equal(jq.status, 200); assert.match(await jq.text(), /^\/\*! jQuery v3\.7\.1/);
  assert.equal((await fetch(B + '/he/checkout')).headers.get('strict-transport-security')?.startsWith('max-age='), true); assert.equal((await fetch(B + '/he/checkout')).headers.get('x-content-type-options'), 'nosniff');
  ok('CSP only on /{lang}/checkout and /admin/test-checkout: SUMIT script+API origins, inline-script hashes (checkout) / per-response nonce (admin), no unsafe-inline scripts; HSTS+nosniff kept; no CSP elsewhere; jQuery self-hosted');
  process.env.PAYMENTS_PROVIDER = 'mock'; const mc = await csp('/he/checkout'); assert.ok(mc && !/sumit/i.test(mc)); assert.equal((await fetch(B + '/admin/test-checkout')).status, 404); process.env.PAYMENTS_PROVIDER = 'sumit';
  ok('with PAYMENTS_PROVIDER=mock the checkout CSP carries no SUMIT origins and the admin page is 404');
  // ---- PRELAUNCH gate ----
  let r = await post('/api/checkout', { plan: 'starter', email: 'pre@t.test' }); assert.equal(r.status, 403); assert.equal((await r.json()).prelaunch, true); assert.equal(acct('pre@t.test'), undefined);
  r = await post('/api/checkout/charge', { identifier: 'abc.def', token: SUT }); assert.equal(r.status, 403); assert.equal(charges().length, 0);
  ok('PRELAUNCH=1: /api/checkout 403 (waitlist), /api/checkout/charge 403, nothing created or charged');
  // forged: a real pending checkout created while live, then PRELAUNCH turned on again -> charge refused
  process.env.PRELAUNCH = '0'; r = await post('/api/checkout', { plan: 'starter', email: 'fl@t.test', currency: 'ILS', lang: 'he' }); const j0 = await r.json(); process.env.PRELAUNCH = '1';
  r = await post('/api/checkout/charge', { identifier: j0.embedded.identifier, token: SUT }); assert.equal(r.status, 403); assert.equal(charges().length, 0); process.env.PRELAUNCH = '0';
  ok('a checkout started live cannot be completed once PRELAUNCH is back on');
  // ---- live (PRELAUNCH=0) real checkout ----
  r = await post('/api/checkout', { plan: 'starter', email: 'buy@t.test', currency: 'ILS', lang: 'he' }); let j = await r.json(); assert.equal(r.status, 200);
  assert.ok(!('redirectUrl' in j)); assert.deepEqual(Object.keys(j.embedded).sort(), ['companyId', 'identifier', 'publicKey']); assert.equal(j.embedded.publicKey, 'PUBLIC-KEY-xyz-123'); assert.ok(!JSON.stringify(j).includes('PRIVATE-KEY')); assert.equal(j.billing.currency, 'ILS'); assert.equal(sumitCalls.length, 0, 'start does not charge');
  const IDENT = j.embedded.identifier;
  ok('POST /api/checkout (sumit): returns embedded {companyId, publicKey, identifier}, no redirect, no private key, no charge yet');
  // token handling
  for (const [body, why] of [[{ identifier: IDENT }, 'missing token'], [{ identifier: IDENT, token: '' }, 'empty token'], [{ identifier: IDENT, token: 'short' }, 'short token'], [{ identifier: IDENT, token: { a: 1 } }, 'object token'], [{ token: SUT }, 'missing identifier'], [{ identifier: 5, token: SUT }, 'numeric identifier'], [{ identifier: IDENT, token: 'x'.repeat(400) }, 'huge token']]) { r = await post('/api/checkout/charge', body); assert.equal(r.status, 400, why); }
  assert.equal(charges().length, 0); ok('charge route rejects missing/empty/short/oversized/non-string tokens and identifiers (400, no SUMIT call)');
  // card data must never reach the server
  const cardBodies = [{ identifier: IDENT, token: SUT, cardnumber: CARD }, { identifier: IDENT, token: SUT, cvv: '123' }, { identifier: IDENT, token: SUT, expirationmonth: '12' }, { identifier: IDENT, token: SUT, 'og-ccnum': 'x' }, { identifier: IDENT, token: SUT, nested: { CardNumber: CARD } }, { identifier: IDENT, token: SUT, note: CARD }, { identifier: IDENT, token: SUT, note: '4580 4580 4580 4580' }, { identifier: IDENT, token: SUT, citizenid: '123456782' }, { identifier: IDENT, token: CARD }, { identifier: IDENT, token: SUT, arr: [{ x: '4111-1111-1111-1111' }] }];
  for (const b of cardBodies) { r = await post('/api/checkout/charge', b); assert.equal(r.status, 400); assert.equal((await r.json()).error, 'card_data_rejected'); }
  r = await fetch(B + `/api/checkout/charge?cardnumber=${CARD}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: IDENT, token: SUT }) }); assert.equal(r.status, 400);
  r = await fetch(B + '/api/checkout/charge', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `identifier=${IDENT}&token=${SUT}&cardnumber=${CARD}` }); assert.equal(r.status, 400);
  r = await post('/api/checkout', { plan: 'starter', email: 'c@t.test', cardnumber: CARD }); assert.equal(r.status, 400); assert.equal(acct('c@t.test'), undefined); r = await post('/api/admin/test-checkout', { email: 'c@t.test', cvv: '123' }, { 'x-admin-test-token': TOKEN }); assert.equal(r.status, 400);
  assert.equal(charges().length, 0); const leak = logs.join('\n'); assert.ok(!leak.includes(CARD) && !leak.includes('4580 4580') && !leak.includes('4111')); assert.ok(logs.some(l => l.includes('[security] card-like data rejected on /api/checkout/charge')));
  ok('card-like keys/values (body JSON, nested, urlencoded, query, in the token itself) are rejected with 400 on checkout, charge and admin routes; nothing charged, nothing logged but the path');
  // happy path
  r = await post('/api/checkout/charge', { identifier: IDENT, token: SUT, lang: 'he' }); j = await r.json(); assert.equal(r.status, 200); assert.equal(j.ok, true); assert.deepEqual(Object.keys(j).sort(), ['lang', 'ok']);
  assert.equal(charges().length, 1); const c = charges()[0].body; assert.equal(c.SingleUseToken, SUT); assert.equal(c.Items[0].UnitPrice, 79); assert.equal(c.Items[0].Currency, 0); assert.equal(c.Items[0].Recurrence, 0); assert.equal(c.DocumentType, 2); assert.equal(c.Customer.NoVAT, true); assert.equal(c.VATIncluded, false); assert.equal(c.Credentials.APIKey, 'PRIVATE-KEY-secret-abcdef'); assert.equal(c.Customer.EmailAddress, 'buy@t.test');
  const a = acct('buy@t.test'); assert.equal(a.plan, 'starter'); assert.equal(a.status, 'active'); assert.equal(a.subscriptionRef, '555'); assert.ok(!a.checkoutState && !a.pendingBilling);
  r = await post('/api/checkout/charge', { identifier: IDENT, token: SUT + 'x' }); assert.equal(r.status, 409); assert.equal(charges().length, 1);
  ok('happy path: server charges /billing/recurring/charge/ with SingleUseToken exactly (79 ILS, receipt DocumentType 2, NoVAT, ILS); replay of the identifier is refused with 409');
  // wrong / forged identifiers
  r = await post('/api/checkout', { plan: 'pro', email: 'w@t.test', currency: 'USD' }); j = await r.json(); const [wid] = j.embedded.identifier.split('.');
  for (const id of [wid, `${wid}.forged`, 'nobody.x', `${wid}.`, '.', '__proto__.x', 'constructor.x']) { r = await post('/api/checkout/charge', { identifier: id, token: SUT }); assert.equal(r.status, 400, id); } assert.equal(charges().length, 1);
  r = await post('/api/checkout/charge', { identifier: j.embedded.identifier, token: SUT, lang: 'en' }); assert.equal(r.status, 200); const pc = charges().at(-1).body; assert.equal(pc.Items[0].UnitPrice, 179); assert.equal(pc.Items[0].Currency, 0, 'USD display currency is still billed in ILS');
  ok('forged/partial identifiers rejected; amount and currency come from the server (Pro = 179 ILS even when USD display was requested)');
  // old redirect flow is dead for SUMIT
  r = await post('/api/checkout', { plan: 'starter', email: 'old@t.test' }); j = await r.json(); const before = charges().length;
  r = await fetch(`${B}/billing/return?Valid=1&Token=${SUT}&Identifier=${encodeURIComponent(j.embedded.identifier)}`); assert.equal(r.status, 400); assert.equal(charges().length, before); assert.equal(acct('old@t.test').plan, 'free');
  r = await fetch(B + '/checkout', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'starter', email: 'old2@t.test', lang: 'en' }) }); assert.equal(r.status, 302); assert.match(r.headers.get('location'), /^\/en\/checkout\?plan=starter$/);
  ok('GET /billing/return can no longer charge with SUMIT (tokens never travel in URLs); the HTML /checkout post sends the browser to the embedded checkout page');
  // lock / double submit
  const dbl = (await (await post('/api/checkout', { plan: 'starter', email: 'dbl@t.test' })).json()).embedded.identifier; const both = await Promise.all([post('/api/checkout/charge', { identifier: dbl, token: SUT + 'A' }), post('/api/checkout/charge', { identifier: dbl, token: SUT + 'B' })]);
  assert.equal(both.filter(x => x.status === 200).length, 1); assert.equal(charges().filter(x => x.body.Customer.EmailAddress === 'dbl@t.test').length, 1);
  ok('double submit with two different tokens charges exactly once');
  // mock provider: no embedded route
  process.env.PAYMENTS_PROVIDER = 'mock'; assert.equal((await post('/api/checkout/charge', { identifier: IDENT, token: SUT })).status, 404); r = await post('/api/checkout', { plan: 'starter', email: 'mk@t.test' }); assert.match((await r.json()).redirectUrl, /mock-checkout/); process.env.PAYMENTS_PROVIDER = 'sumit'; ok('mock provider unchanged: redirect to the stand-in page, no embedded charge route (404)');
  // ---- admin gate ----
  const adm = (p, body, tok = TOKEN) => post(p, body, tok === null ? {} : { 'x-admin-test-token': tok });
  for (const tok of [null, 'wrong', TOKEN + 'x']) { assert.equal((await adm('/api/admin/test-checkout/charge', { identifier: 'a.b', token: SUT }, tok)).status, 401); assert.equal((await adm('/api/admin/test-checkout', { email: 'a@t.test' }, tok)).status, 401); }
  r = await fetch(B + '/api/admin/test-checkout/charge?admin_token=' + TOKEN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: 'a.b', token: SUT }) }); assert.equal(r.status, 401);
  process.env.ADMIN_TEST_TOKEN = 'short'; assert.equal((await adm('/api/admin/test-checkout/charge', { identifier: 'a.b', token: SUT }, 'short')).status, 404); process.env.ADMIN_TEST_TOKEN = TOKEN; process.env.PAYMENTS_PROVIDER = 'mock'; assert.equal((await adm('/api/admin/test-checkout/charge', { identifier: 'a.b', token: SUT })).status, 404); process.env.PAYMENTS_PROVIDER = 'sumit';
  const nb = charges().length; process.env.PRELAUNCH = '1';
  j = await (await adm('/api/admin/test-checkout', { email: 'adm@t.test' })).json(); assert.equal(j.ok, true); assert.ok(!('redirectUrl' in j)); assert.equal(j.embedded.publicKey, 'PUBLIC-KEY-xyz-123');
  r = await post('/api/checkout/charge', { identifier: j.embedded.identifier, token: SUT }); assert.equal(r.status, 403, 'test checkout cannot be completed through the public route while pre-launch');
  process.env.PRELAUNCH = '0'; r = await post('/api/checkout/charge', { identifier: j.embedded.identifier, token: SUT }); assert.equal(r.status, 400, 'nor when live'); assert.equal(charges().length, nb);
  r = await adm('/api/admin/test-checkout/charge', { identifier: j.embedded.identifier, token: SUT }); assert.equal(r.status, 200); const tc = charges().at(-1).body; assert.equal(tc.Items[0].UnitPrice, 1); assert.equal(tc.Items[0].Recurrence, 1); assert.equal(tc.DocumentType, 2); assert.equal(tc.Customer.NoVAT, true);
  r = await adm('/api/admin/test-checkout/charge', { identifier: j.embedded.identifier, token: SUT }); assert.equal(r.status, 400);
  const own = (await (await post('/api/checkout', { plan: 'starter', email: 'own@t.test' })).json()).embedded.identifier; r = await adm('/api/admin/test-checkout/charge', { identifier: own, token: SUT }); assert.equal(r.status, 400, 'the admin route cannot charge a public checkout'); assert.equal(acct('own@t.test').plan, 'free');
  process.env.PRELAUNCH = '1'; ok('admin: token required (header only, timing-safe), 404 when disabled or mock; the test checkout completes ONLY through the admin charge route; admin route cannot charge public checkouts; 1 ILS / Recurrence 1 / receipt / NoVAT');
  // ---- errors and logs ----
  r = await post('/api/checkout/charge', '{"identifier":"a.b","token":"' + 'SECRET-FRAGMENT-9' + '", "cardnumber": 4580458045804580, '); assert.equal(r.status, 400); assert.ok(!(await r.text()).includes('SECRET-FRAGMENT'));
  r = await post('/api/checkout/charge', 'cardnumber=4580458045804580'); assert.equal(r.status, 400);
  assert.ok(!logs.join('\n').includes('SECRET-FRAGMENT') && !logs.join('\n').includes('4580458045804580')); assert.ok(logs.some(l => /^\[http\] POST \/api\/checkout\/charge -> 400 \(entity\.parse\.failed\)$/.test(l)));
  const all = logs.join('\n'); for (const s of [TOKEN, 'PRIVATE-KEY-secret-abcdef', 'PUBLIC-KEY-xyz-123', SUT, 'a1b2c3d4', CARD]) assert.ok(!all.includes(s), 'log leak: ' + s);
  ok('malformed bodies on payment routes: 400 and the error handler logs only method/path/error class (no body fragment); logs contain no card numbers, tokens, SUMIT keys or admin token');
  // ---- frontend source guards ----
  const form = fs.readFileSync('web/components/CardForm.tsx', 'utf8'), co = fs.readFileSync('web/components/Checkout.tsx', 'utf8'), pay = fs.readFileSync('web/lib/i18n-pay.ts', 'utf8');
  for (const f of [form, co, pay]) assert.ok(!/SUMIT_API_KEY|APIKey\b/.test(f) && !/PRIVATE/i.test(f)); assert.ok(!/<input[^>]*\bname=/.test(form), 'card inputs have no name'); assert.ok(!/useState[^;]*(card|cvv|expir)/i.test(form), 'card data not in React state');
  assert.deepEqual([...form.matchAll(/\bapi\(\s*"([^"]+)"/g)].map(m => m[1]), ['/api/checkout/charge']); assert.ok(form.includes('https://app.sumit.co.il/scripts/payments.js') && SUMIT_SCRIPT_URL === 'https://app.sumit.co.il/scripts/payments.js'); assert.ok(!/\.val\(|data-og.*value=/.test(form));
  for (const a of ['cardnumber', 'expirationmonth', 'expirationyear', 'cvv', 'citizenid']) assert.ok(form.includes(`data-og="${a}"`), a);
  assert.ok(fs.readFileSync('server.js', 'utf8').includes("data-og=\"cardnumber\"")); ok('frontend: card inputs use SUMIT data-og attributes, have no name, are never in React state, only /api/checkout/charge is called; no private key in web sources');
  // ---- card form polish guards (visual changes must not weaken anything) ----
  const inputs = [...form.matchAll(/<input\b[^>]*data-og="[a-z]+"[^>]*\/>/g)].map(m => m[0]); assert.equal(inputs.length, 5, 'five card inputs (number, month, year, cvv, id)');
  for (const [a, ac] of [['cardnumber', 'cc-number'], ['expirationmonth', 'cc-exp-month'], ['expirationyear', 'cc-exp-year'], ['cvv', 'cc-csc']]) { const i = inputs.find(x => x.includes(`data-og="${a}"`)); assert.ok(i && i.includes(`autoComplete="${ac}"`), 'autocomplete ' + a); }
  assert.ok(/inputMode: "numeric"/.test(form) && /dir: "ltr"/.test(form) && /readOnly: busy/.test(form) && !/disabled=\{busy\}.*input/.test(form), 'numeric LTR inputs, read-only (not disabled) while busy');
  assert.ok(/aria-live="assertive"/.test(form) && /role="alert"/.test(form) && /htmlFor="cf-number"/.test(form) && /lock\.current/.test(form) && /disabled=\{!ready \|\| busy\}/.test(form), 'aria-live errors, labels, double-submit lock, disabled while loading/busy');
  assert.ok(!/<(style|script)\b/.test(form) && !/\bstyle=\{/.test(form) && !/dangerouslySetInnerHTML/.test(form + co), 'no inline style/script in React card form (CSP stays strict)');
  assert.ok(!/\.value\b|getElementById|FormData/.test(form.replace(/i\.value = ""/g, '')), 'card form code never reads field values (only wipes them)');
  const adm2 = await (await fetch(B + '/admin/test-checkout')).text(); assert.ok(adm2.includes('TEST ₪1') && /class="warn"/.test(adm2), 'admin page: TEST banner'); assert.ok(!/\sstyle="/.test(adm2), 'admin page: no inline style attributes (style-src is nonce-only)'); assert.equal((adm2.match(/<style\b[^>]*nonce=/g) || []).length, 1);
  for (const ac of ['cc-number', 'cc-exp-month', 'cc-exp-year', 'cc-csc']) assert.ok(adm2.includes(`autocomplete="${ac}"`), 'admin ' + ac); assert.equal((adm2.match(/data-og="/g) || []).length, 5); assert.ok(!/<input[^>]*\bname=/.test(adm2));
  ok('card form polish: autocomplete cc-* + numeric LTR inputs, aria-live errors, double-submit lock, no inline style/script, form code never reads values; admin page marked TEST ₪1 with warning, no inline style attrs');
  assert.equal(outbound, 0); Object.assign(console, orig); console.log(`ALL SUMIT PAYMENTS JS TESTS PASSED (${n})`);
} finally { Object.assign(console, orig); globalThis.fetch = realFetch; srv.close(); await flush(); TD.done(); }
process.exit(0);
