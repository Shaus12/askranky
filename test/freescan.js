// Free plan = one scan per email. A different business with an email that already used its free scan gets a structured 409
// (free_scan_used) pointing at its own report, BEFORE any engine call / spend / email; the same business keeps returning the existing
// report (existing:true). Plus the Resend sender: plain or "Name <addr>" From, hello@askranky.com default, useful API error text in logs
// without secrets/PII, and a failed report email never breaks a finished scan. All mock / stubbed: no real engine or Resend call.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module'; import { useTempData } from './helpers.js'; const TD = useTempData('freescan');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_REPLY_TO', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES']) delete process.env[k];
process.env.DISABLE_IP_LIMIT = '1'; process.env.SCAN_RATE_MAX = '1000'; process.env.UNSUBSCRIBE_SECRET = 'test-unsub-secret-0123456789';
const realFetch = globalThis.fetch; const outbound = []; const resendCalls = []; let resendMode = 'ok'; const KEY = 're_SECRETKEY123456';
const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js'); const { sendEmail, sendEmailSoft, emailFrom, parseFrom, describeResendError } = await import('../src/email/send.js'); const { checkConfig } = await import('../src/config-check.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
const DOMAIN_ERR = { statusCode: 403, name: 'validation_error', message: 'The send.askranky.com domain is not verified. Please, add and verify your domain on https://resend.com/domains' };
globalThis.fetch = async (u, o) => { u = String(u); if (u.startsWith(B)) return realFetch(u, o);
  if (u.startsWith('https://api.resend.com')) { resendCalls.push(JSON.parse(o.body)); return resendMode === 'ok' ? new Response(JSON.stringify({ id: 'x' }), { status: 200 }) : new Response(JSON.stringify(DOMAIN_ERR), { status: 403 }); }
  outbound.push(u); throw new Error('outbound fetch blocked in tests: ' + u); };
let n = 0; const ok = m => { n++; console.log('  ✓', m); }; const read = f => fs.readFileSync(f, 'utf8');
const post = (p, body, extra = {}) => realFetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...extra });
const A = { name: 'Acme Plumbing', category: 'Plumber', city: 'Haifa', email: 'one@t.test', lang: 'en' };
const logs = []; const origErr = console.error; console.error = (...a) => { logs.push(a.join(' ')); };
try {
  // 1) first scan runs; same business again -> existing (unchanged behaviour); case/space variations are the same business
  const first = await post('/api/scan', A); assert.equal(first.status, 200); const f = await first.json(); assert.ok(f.reportId); assert.equal(f.existing, undefined);
  const again = await post('/api/scan', { ...A, name: '  acme   PLUMBING ', city: 'haifa' }); assert.equal(again.status, 200); const ag = await again.json(); assert.deepEqual(ag, { reportId: f.reportId, existing: true });
  ok('same business + same email: 200 {reportId, existing:true} (unchanged), also for case/whitespace variants');

  // 2) different business, same email -> 409 with a structured body; nothing new is created, spent or sent. Live mode with a key: the engine must not be called.
  const db = getDb(); const snap = () => JSON.stringify({ s: Object.keys(db.scans).length, b: Object.keys(db.businesses).length, spend: db.spend, ev: db.events.filter(e => /scan|spend/.test(e.type)).length });
  const outbox = () => (fs.existsSync(path.join(TD.dir, 'outbox')) ? fs.readdirSync(path.join(TD.dir, 'outbox')).length : 0); const before = snap(), mailBefore = outbox();
  process.env.SCAN_MODE = 'live'; process.env.OPENAI_API_KEY = 'sk-test-not-real'; process.env.LIVE_ENGINES = 'chatgpt';
  for (const [lang, expectLang] of [['he', 'he'], ['en', 'en'], [undefined, 'en']]) {
    const r = await post('/api/scan', { name: 'Other Biz', category: 'Electrician', city: 'Haifa', email: 'ONE@t.test', lang }); assert.equal(r.status, 409); const j = await r.json();
    assert.deepEqual(Object.keys(j).sort(), ['code', 'error', 'message', 'reportId', 'reportUrl']); assert.equal(j.error, 'free_scan_used'); assert.equal(j.code, 'free_scan_used'); assert.equal(j.message, 'Free plan includes one scan per email.');
    assert.equal(j.reportId, f.reportId); assert.equal(j.reportUrl, `/${expectLang}/r/${f.reportId}`); }
  assert.equal(snap(), before, 'no scan, business, spend or event was created'); assert.equal(outbox(), mailBefore, 'no email'); assert.deepEqual(outbound, [], 'no engine / outbound call'); assert.equal(resendCalls.length, 0);
  delete process.env.SCAN_MODE; delete process.env.OPENAI_API_KEY; delete process.env.LIVE_ENGINES;
  ok('different business, same email: 409 {error, code:free_scan_used, message, reportId, reportUrl:/{lang}/r/<id>}; no scan/business/spend/email, no engine call (live mode, key set)');

  // 3) only the owner's own report id is ever returned; other emails are unaffected and get their own scan
  const other = await post('/api/scan', { ...A, name: 'Other Biz', email: 'two@t.test' }); assert.equal(other.status, 200); const o = await other.json(); assert.ok(o.reportId && o.reportId !== f.reportId && !o.existing);
  const blank = await post('/api/scan', { ...A, name: '', email: 'three@t.test' }); assert.equal(blank.status, 400);
  const jOther = await (await post('/api/scan', { name: 'Third', category: 'x', city: 'y', email: 'two@t.test' })).json(); assert.equal(jOther.reportId, o.reportId); assert.notEqual(jOther.reportId, f.reportId);
  ok('409 only for the email that owns the report and only ever points at that email\'s own report; other emails scan normally; validation unchanged');

  // 4) a paid account is not limited; a free account whose earlier scan never finished (no scanIds) can still scan
  const paid = Object.values(db.accounts).find(a => a.email === 'one@t.test'); paid.plan = 'starter'; const pr = await post('/api/scan', { name: 'Biz Two', category: 'Electrician', city: 'Haifa', email: 'one@t.test' }); assert.equal(pr.status, 200); assert.ok(!(await pr.json()).existing); paid.plan = 'free';
  const { freeScanLookup } = await import('../server.js'); const fake = { businesses: { x: { id: 'x', accountId: 'a1', name: 'N', city: 'C' }, y: { id: 'y', accountId: 'a1', name: 'M', city: 'C', scanIds: ['s1', 's2'] } } };
  assert.equal(freeScanLookup({ businesses: { x: fake.businesses.x } }, { id: 'a1', plan: 'free' }, { name: 'N', city: 'C' }), null); assert.deepEqual(freeScanLookup(fake, { id: 'a1', plan: 'free' }, { name: 'Z', city: 'C' }), { same: false, reportId: 's2' });
  assert.deepEqual(freeScanLookup(fake, { id: 'a1', plan: 'free' }, { name: 'm', city: 'c ' }), { same: true, reportId: 's2' }); assert.equal(freeScanLookup(fake, { id: 'a2', plan: 'free' }, { name: 'M', city: 'C' }), null); assert.equal(freeScanLookup(fake, { id: 'a1', plan: 'pro' }, { name: 'Z', city: 'C' }), null);
  ok('paid plan not limited; a business with no finished scan never counts as the used free scan; lookup is per account');

  // 5) legacy HTML form /scan: same business redirects as before, different business gets a 409 page with the message and report link
  const form = body => realFetch(B + '/scan', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const s1 = await form({ name: 'Acme Plumbing', category: 'Plumber', city: 'Haifa', email: 'html@t.test' }); assert.equal(s1.status, 302); const rid = s1.headers.get('location').split('/').pop();
  const s2 = await form({ name: 'Acme Plumbing', category: 'Plumber', city: 'Haifa', email: 'html@t.test' }); assert.equal(s2.status, 302); assert.equal(s2.headers.get('location'), '/r/' + rid);
  const s3 = await form({ name: 'Different', category: 'Plumber', city: 'Haifa', email: 'html@t.test' }); assert.equal(s3.status, 409); const html = await s3.text(); assert.match(html, /Free plan includes one scan per email/); assert.ok(html.includes('/r/' + rid));
  ok('legacy /scan form: same business → redirect to existing report; different business → 409 page with message + report link');

  // 6) frontend wiring + strings (HE + EN)
  const sp = read('web/components/ScanProgress.tsx'), fl = read('web/components/FreeLimitNotice.tsx'), strings = read('web/lib/i18n-free.ts'), i18n = read('web/lib/i18n.ts');
  assert.match(sp, /e\?\.code === "free_scan_used"/); assert.match(sp, /<FreeLimitNotice /); assert.match(sp, /prelaunch=\{cfg \? !!cfg\.prelaunch : true\}/);
  assert.match(fl, /role="alert"/); assert.match(fl, /aria-live="assertive"/); assert.match(fl, /\/\$\{lang\}\/r\//); assert.match(fl, /\/\$\{lang\}\/checkout\?plan=starter/); assert.match(fl, /prelaunch \? f\.notify : f\.upgrade/); assert.match(fl, /prelaunch \? f\.upgradeSoon : f\.upgradeLive/); assert.match(fl, /rtl:rotate-180/);
  assert.doesNotMatch(fl, /name=|sessionStorage|\/api\/checkout/);
  const ts = createRequire(import.meta.url)('../web/node_modules/typescript'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'free-'));
  fs.writeFileSync(path.join(tmp, 'f.mjs'), ts.transpileModule(strings.replace(/import type[^\n]*\n/, ''), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText); const { freeText } = await import(path.join(tmp, 'f.mjs')); fs.rmSync(tmp, { recursive: true, force: true });
  assert.deepEqual(Object.keys(freeText.en).sort(), Object.keys(freeText.he).sort()); for (const l of ['en', 'he']) for (const [k, v] of Object.entries(freeText[l])) assert.ok(v.length > 3, `${l}.${k}`);
  assert.equal(freeText.he.title, 'התוכנית החינמית כוללת סריקה אחת לכל אימייל'); assert.equal(freeText.en.title, 'Free plan includes one scan per email'); assert.equal(freeText.he.view, 'לדוח הקיים'); assert.equal(freeText.en.view, 'View your existing report');
  assert.match(freeText.he.upgradeSoon, /בקרוב/); assert.match(freeText.en.upgradeSoon, /soon/i); assert.ok(!/[\u0590-\u05ff]/.test(Object.values(freeText.en).join('')));
  assert.match(i18n, /formNote: "The free plan includes one scan per email\./); assert.match(i18n, /formNote: "התוכנית החינמית כוללת סריקה אחת לכל אימייל\./);
  ok('frontend: 409 handled in ScanProgress → FreeLimitNotice (role=alert, report link /{lang}/r/<id>, waitlist/upgrade button by prelaunch); HE+EN strings; form note updated');

  // 7) Resend sender: From formats, default, config validation
  assert.equal(emailFrom(), 'Ranky <hello@askranky.com>'); assert.deepEqual(parseFrom('hello@askranky.com'), { name: '', address: 'hello@askranky.com', domain: 'askranky.com' }); assert.deepEqual(parseFrom('Ranky <hello@askranky.com>'), { name: 'Ranky', address: 'hello@askranky.com', domain: 'askranky.com' });
  assert.equal(parseFrom('"Ranky Team" <hello@askranky.com>').name, 'Ranky Team'); for (const bad of ['send.askranky.com', 'Ranky <>', '<a@b>', 'a@b', 'a b@c.com', '']) assert.equal(parseFrom(bad), null, bad);
  const mailEnv = from => ({ EMAIL_MODE: 'resend', RESEND_API_KEY: 'x', UNSUBSCRIBE_SECRET: 'y', EMAIL_FROM: from }); const bad = x => checkConfig(mailEnv(x)).errors.filter(e => e.startsWith('EMAIL_FROM')); const warn = x => checkConfig(mailEnv(x)).warnings.filter(e => e.startsWith('EMAIL_FROM'));
  assert.deepEqual(bad('hello@askranky.com'), []); assert.deepEqual(warn('Ranky <hello@askranky.com>'), []); assert.equal(bad('send.askranky.com').length, 1); assert.match(warn('Ranky <a@gmail.com>')[0], /verified in Resend/);
  assert.ok(checkConfig({ EMAIL_MODE: 'resend', RESEND_API_KEY: 'x', UNSUBSCRIBE_SECRET: 'y' }).warnings.some(w => /hello@askranky\.com/.test(w)));
  for (const f of ['GO-LIVE.md', '.env.example']) { const d = read(f); assert.match(d, /hello@askranky\.com/); assert.match(d, /send\.askranky\.com.{0,12}NOT|NOT.{0,3}send\.askranky\.com/); } assert.match(read('GO-LIVE.md'), /EMAIL_REPLY_TO. = .shaysho1111@gmail\.com/);
  for (const f of ['src/email/send.js', 'src/config-check.js', 'server.js', 'README.md']) assert.doesNotMatch(read(f), /reports@|send\.askranky/);
  ok('From: default Ranky <hello@askranky.com>; plain or "Name <addr>" accepted, malformed rejected; config check + docs updated; no code references send.askranky.com');

  // 8) Resend delivery: payload, API error text in logs (no secrets/PII), failure never breaks a finished scan
  process.env.EMAIL_MODE = 'resend'; process.env.RESEND_API_KEY = KEY; process.env.EMAIL_FROM = 'Ranky <hello@askranky.com>'; process.env.EMAIL_REPLY_TO = 'shaysho1111@gmail.com';
  await sendEmail({ to: 'someone@t.test', subject: 's', html: '<p>x</p>' }); assert.equal(resendCalls.at(-1).from, 'Ranky <hello@askranky.com>'); assert.equal(resendCalls.at(-1).reply_to, 'shaysho1111@gmail.com');
  process.env.EMAIL_FROM = 'hello@askranky.com'; await sendEmail({ to: 'someone@t.test', subject: 's', html: '<p>x</p>' }); assert.equal(resendCalls.at(-1).from, 'hello@askranky.com');
  resendMode = 'domain403'; logs.length = 0; let err; try { await sendEmail({ to: 'victim@t.test', subject: 'secret subject', html: '<p>body</p>', kind: 'report' }); } catch (e) { err = e; }
  assert.ok(err); assert.equal(err.status, 403); assert.match(err.message, /^Resend 403 validation_error: The send\.askranky\.com domain is not verified/); const L = logs.join('\n'); assert.match(L, /\[email\] report send failed: Resend 403 validation_error: The send\.askranky\.com domain is not verified/);
  for (const secret of [KEY, 'victim@t.test', 'secret subject', 'Bearer']) assert.ok(!L.includes(secret) && !err.message.includes(secret), 'leaked ' + secret);
  const d = describeResendError(422, JSON.stringify({ name: 'validation_error', message: `Invalid to address victim@t.test with key ${KEY} Bearer ${KEY}` })); assert.ok(!/victim|SECRET/.test(d)); assert.match(d, /\[email\]/); assert.equal(describeResendError(500, '<html>oops</html>'), 'Resend 500: <html>oops</html>'); assert.ok(describeResendError(500, 'x'.repeat(5000)).length < 400);
  assert.equal(await sendEmailSoft({ to: 'victim@t.test', subject: 's', html: 'x' }), false);
  logs.length = 0; const live = await post('/api/scan', { name: 'Mail Fails', category: 'Plumber', city: 'Haifa', email: 'mailfail@t.test' }); assert.equal(live.status, 200); assert.ok((await live.json()).reportId); assert.match(logs.join('\n'), /Resend 403 validation_error/); assert.ok(!logs.join('\n').includes('mailfail@t.test'));
  ok('Resend: From plain/"Name <addr>" sent as given; 403 domain-not-verified text reaches logs (no key, recipient, subject); a failing report email does not turn a finished scan into an error');
  console.log(`ALL FREE-SCAN TESTS PASSED (${n})`);
} catch (e) { console.error = origErr; throw e; } finally { console.error = origErr; srv.close(); TD.done(); }
process.exit(0);
