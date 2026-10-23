// Manual browser check of the embedded SUMIT card form (NOT part of `npm test`: needs Chrome via playwright from ./web).
//   CHROME=/usr/bin/google-chrome node scripts/sumit-browser-check.mjs
// Runs the real app in-process with FAKE SUMIT keys and a stubbed server-side SUMIT API. In the browser, SUMIT's real payments.js
// (a saved copy: test/fixtures/sumit-payments.js) is served from the intercepted https://app.sumit.co.il/scripts/payments.js and the
// tokenize call to https://api.sumit.co.il/creditguy/vault/tokenizesingleuse/ is intercepted, so no network call to SUMIT is made.
// Verifies: forms render, CSP has no violations and lists SUMIT only where required, card data reaches ONLY the (fake) SUMIT tokenize
// endpoint and never our server, the server receives only {identifier, token, lang}, both flows end in a charge.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ranky-sumitbrowser-')); process.env.FORCE_JSON_STORE = '1'; process.env.DISABLE_IP_LIMIT = '1';
Object.assign(process.env, { PAYMENTS_PROVIDER: 'sumit', SUMIT_COMPANY_ID: '123456', SUMIT_API_KEY: 'FAKE-PRIVATE-KEY-0000', SUMIT_PUBLIC_API_KEY: 'FAKE-PUBLIC-KEY-1111', ADMIN_TEST_TOKEN: 'adm-0123456789abcdef-TOKEN', PRELAUNCH: '0', SCAN_MODE: 'mock', EMAIL_MODE: 'mock', TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' });
const CARD = '4580458045804580', CARD_FMT = '4580 4580 4580 4580', CVV = '737', SUT = 'sut-token-00000000-aaaa-bbbb';
const realFetch = globalThis.fetch; const chargeBodies = []; let tsVerify = 0;
globalThis.fetch = async (u, o) => { const url = String(u);
  if (url.startsWith('http://127.0.0.1')) return realFetch(u, o);
  if (url.includes('challenges.cloudflare.com/turnstile/v0/siteverify')) { tsVerify++; return new Response(JSON.stringify({ success: true, hostname: 'askranky.com' }), { headers: { 'content-type': 'application/json' } }); }
  if (url === 'https://api.sumit.co.il/billing/recurring/charge/') { chargeBodies.push(JSON.parse(o.body)); return new Response(JSON.stringify({ Status: 0, Data: { Payment: { ValidPayment: true, Status: '000' }, RecurringCustomerItemIDs: [1], CustomerID: 2, DocumentID: 3 } }), { headers: { 'content-type': 'application/json' } }); }
  throw new Error('unexpected server-side fetch ' + url); };
const { default: app } = await import('../server.js'); const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
const origErr = console.error; const serverLogs = []; for (const k of ['log', 'warn', 'error']) { const o = console[k]; console[k] = (...a) => { serverLogs.push(a.join(' ')); if (k === 'error') o(...a); }; }
const { chromium } = createRequire(import.meta.url)(path.resolve('web/node_modules/playwright'));
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {}); let fails = 0; const say = m => process.stdout.write(m + '\n');
async function session(name, fn) {
  const ctx = await browser.newContext({ locale: 'he-IL' }); const page = await ctx.newPage(); const cspViol = [], seen = { sumitScript: 0, tokenize: [], toServer: [] }, other = [];
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => (window.__csp ||= []).push(`${e.violatedDirective} ${e.blockedURI}`)); });
  await page.route('https://app.sumit.co.il/scripts/payments.js', r => { seen.sumitScript++; r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync('test/fixtures/sumit-payments.js') }); });
  await page.route('https://api.sumit.co.il/creditguy/vault/tokenizesingleuse/', r => { seen.tokenize.push({ body: r.request().postData() || '', lang: r.request().headers()['content-language'] }); r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ Status: 0, Data: { SingleUseToken: SUT } }) }); });
  
  page.on('request', q => { const u = q.url(); if (u.startsWith(B) && q.method() !== 'GET') seen.toServer.push({ url: u, body: q.postData() || '' }); if (u.startsWith(B) && q.method() === 'GET' && /card|cvv|4580/i.test(u)) other.push(u); });
  page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) cspViol.push(m.text()); });
  try { await fn(page, seen); const v = await page.evaluate(() => window.__csp || []); assert.deepEqual([...v, ...cspViol], [], 'CSP violations'); assert.deepEqual(other, []); say('  ✓ ' + name); }
  catch (e) { fails++; say('  ✗ ' + name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 6).join('\n    ')); await page.screenshot({ path: path.join(os.tmpdir(), `sumit-fail-${fails}.png`) }).catch(() => {}); }
  await ctx.close();
}
const noCardOnServer = seen => { for (const r of seen.toServer) for (const s of [CARD, CARD_FMT, CVV]) assert.ok(!r.body.includes(s) && !r.url.includes(s), `card data in a request to our server: ${r.url}`); };
await session('real checkout /he/checkout: email -> card form -> tokenize in browser -> charge', async (page, seen) => {
  await page.goto(B + '/he/checkout?plan=starter'); await page.waitForSelector('input[name=email]'); await page.fill('input[name=email]', 'buyer@example.test');
  const resp = await page.request.get(B + '/he/checkout'); const csp = resp.headers()['content-security-policy']; assert.match(csp, /script-src[^;]*https:\/\/app\.sumit\.co\.il/); assert.match(csp, /connect-src[^;]*https:\/\/api\.sumit\.co\.il/);
  assert.equal(seen.sumitScript, 0, 'SUMIT script must not load before the card form is shown');
  await page.waitForFunction(() => document.querySelector('[name="cf-turnstile-response"]')?.value, null, { timeout: 15000 }).catch(() => {}); // Turnstile test key auto-passes
  await page.click('button.btn-cta'); await page.waitForSelector('#ranky-card-form'); await page.waitForFunction(() => !document.querySelector('#ranky-card-form button').disabled); if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });
  assert.equal(await page.locator('#ranky-card-form input[name]').count(), 0, 'card inputs have no name attribute');
  await page.fill('[data-og=cardnumber]', CARD); await page.fill('[data-og=expirationmonth]', '12'); await page.fill('[data-og=expirationyear]', '2030'); await page.fill('[data-og=cvv]', CVV); await page.fill('[data-og=citizenid]', '123456782');
  await page.click('#ranky-card-form button'); await page.waitForSelector('[data-paid]', { timeout: 15000 });
  assert.equal(seen.tokenize.length, 1); const tb = decodeURIComponent(seen.tokenize[0].body.replace(/\+/g, ' ')); assert.ok(tb.includes(CARD_FMT) || tb.includes(CARD)); assert.ok(tb.includes('FAKE-PUBLIC-KEY-1111')); assert.ok(!tb.includes('FAKE-PRIVATE-KEY')); assert.equal(seen.tokenize[0].lang, 'he');
  noCardOnServer(seen); const ch = seen.toServer.filter(r => r.url.endsWith('/api/checkout/charge')); assert.equal(ch.length, 1); const cb = JSON.parse(ch[0].body); assert.deepEqual(Object.keys(cb).sort(), ['identifier', 'lang', 'token']); assert.equal(cb.token, SUT);
  assert.equal(chargeBodies.length, 1); assert.equal(chargeBodies[0].SingleUseToken, SUT); assert.equal(chargeBodies[0].Items[0].UnitPrice, 79); assert.equal(chargeBodies[0].DocumentType, 2);
  assert.equal(await page.locator('[data-og=cardnumber]').count(), 0); // form gone after success
});
await session('hidden admin test page: card form + CSP nonce, 1 ILS flow', async (page, seen) => {
  const resp = await page.goto(B + '/admin/test-checkout'); const csp = resp.headers()['content-security-policy']; assert.match(csp, /script-src 'self' 'nonce-[^']+' https:\/\/app\.sumit\.co\.il/); assert.ok(!/unsafe-inline/.test(csp.split(';').find(d => d.includes('script-src'))));
  await page.fill('#e', 'admin@example.test'); await page.fill('#t', process.env.ADMIN_TEST_TOKEN);
  await page.fill('[data-og=cardnumber]', CARD); await page.fill('[data-og=expirationmonth]', '12'); await page.fill('[data-og=expirationyear]', '2030'); await page.fill('[data-og=cvv]', CVV);
  await page.click('#go'); await page.waitForFunction(() => /החיוב עבר/.test(document.getElementById('out').textContent), null, { timeout: 15000 });
  noCardOnServer(seen); const ch = seen.toServer.filter(r => r.url.endsWith('/api/admin/test-checkout/charge')); assert.equal(ch.length, 1); assert.deepEqual(Object.keys(JSON.parse(ch[0].body)).sort(), ['identifier', 'token']);
  const last = chargeBodies.at(-1); assert.equal(last.Items[0].UnitPrice, 1); assert.equal(last.Items[0].Recurrence, 1); assert.equal(last.DocumentType, 2); assert.equal(last.Customer.NoVAT, true);
  assert.equal(await page.inputValue('[data-og=cardnumber]'), ''); // fields wiped
});
await session('/en/checkout and other pages render; no CSP on other pages', async (page) => {
  await page.goto(B + '/en/checkout?plan=pro'); await page.waitForSelector('input[name=email]'); for (const p of ['/he', '/he/scan', '/en/legal/terms']) { const r = await page.request.get(B + p); assert.equal(r.headers()['content-security-policy'], undefined, p); }
});
const all = serverLogs.join('\n'); for (const s of [CARD, CARD_FMT, CVV, SUT, 'FAKE-PRIVATE-KEY-0000']) assert.ok(!all.includes(s), 'server log leak');
await browser.close(); srv.close(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); say(fails ? `FAILED (${fails})` : 'BROWSER CHECK PASSED'); process.exit(fails ? 1 : 0);
