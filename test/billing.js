// Next queue: billing sync job, self-serve cancel, webhook auth, unsubscribe + consent, EMAIL_FROM/REPLY_TO,
// transactional emails, admin test checkout in pre-launch, Hebrew legal pages, SEO P1. All mock: no network calls.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { useTempData } from './helpers.js'; const TD = useTempData('billing');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'SUMIT_WEBHOOK_SECRET', 'ADMIN_TEST_TOKEN', 'EMAIL_FROM', 'EMAIL_REPLY_TO', 'UNSUBSCRIBE_SECRET', 'LEGAL_ENTITY', 'BILLING_SYNC_CRON']) delete process.env[k];
process.env.DISABLE_IP_LIMIT = '1'; process.env.EMAIL_FROM = 'Ranky Test <hello@askranky.com>'; process.env.EMAIL_REPLY_TO = 'help@askranky.com'; process.env.UNSUBSCRIBE_SECRET = 'test-unsub-secret-0123456789';
const realFetch = globalThis.fetch; let outbound = 0;
const { default: app } = await import('../server.js'); const { getDb, flush, save } = await import('../src/store.js'); const { mockPayments } = await import('../src/payments/mock.js');
const { syncAll, startBillingCron, stopBillingCron, GRACE_DAYS } = await import('../src/jobs/billing-sync.js'); const C = await import('../src/consent.js'); const { runWeekly } = await import('../src/weekly.js');
const { renderTx } = await import('../src/email/templates.js'); const { checkConfig } = await import('../src/config-check.js'); const { BRAND } = await import('../src/brand.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
// Any fetch that isn't to our own test server is a bug (no live API / SUMIT / Resend calls).
globalThis.fetch = (u, o) => { if (!String(u).startsWith(B)) { outbound++; throw new Error('outbound fetch blocked in tests: ' + u); } return realFetch(u, o); };
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const META = path.join(TD.dir, 'outbox-meta'); const mails = () => fs.existsSync(META) ? fs.readdirSync(META).sort().map(f => ({ ...JSON.parse(fs.readFileSync(path.join(META, f), 'utf8')), html: fs.readFileSync(path.join(TD.outbox, f.replace(/\.json$/, '.html')), 'utf8') })) : [];
const mailsTo = to => mails().filter(m => m.to === to);
const post = (p, body, headers = {}) => realFetch(B + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const get = (p, h = {}) => realFetch(B + p, { redirect: 'manual', headers: h });
function paidAccount(email, extra = {}) { const db = getDb(); const id = 'acc' + Math.random().toString(36).slice(2, 10); const a = { id, key: 'k'.repeat(40) + id, email, plan: 'pro', createdAt: new Date().toISOString(), usage: {}, subscriptionRef: '123', paidAt: new Date().toISOString(), status: 'active', lang: 'he', billing: { currency: 'ILS', amount: 179 }, ...extra }; db.accounts[id] = a; save(); return a; }
try {
  // 1) daily billing sync
  { const now = new Date('2026-11-01T04:00:00Z'); const a = paidAccount('renew@t.test', { paidThrough: '2026-10-31T00:00:00Z', lang: 'en' }); const f = paidAccount('fail@t.test', { paidThrough: '2026-11-20T00:00:00Z' });
    const calls = []; const fake = { id: 'mock', sync: async acc => { calls.push(acc.id); return { active: acc.id === a.id }; } };
    const r = await syncAll({ payments: fake, now }); assert.ok(calls.includes(a.id) && calls.includes(f.id)); assert.equal(r.renewed, 1); assert.equal(r.pastDue, 1);
    assert.equal(a.paidThrough.slice(0, 10), '2026-11-30'); assert.equal(f.status, 'past_due');
    assert.match(mailsTo('renew@t.test').at(-1).subject, /receipt: Pro, 179 ILS/); assert.match(mailsTo('fail@t.test').at(-1).subject, /התשלום ל-Ranky לא עבר/);
    await syncAll({ payments: fake, now: new Date(now.getTime() + 864e5) }); assert.equal(mailsTo('fail@t.test').length, 1, 'failed notice sent once'); assert.equal(f.plan, 'pro');
    await syncAll({ payments: fake, now: new Date(now.getTime() + (GRACE_DAYS + 1) * 864e5) }); assert.equal(f.plan, 'free'); assert.equal(f.status, 'unpaid'); assert.ok(getDb().events.some(e => e.type === 'billing.sync'));
    ok('billing sync: renewals extend paidThrough + receipt; failure → past_due + one failed-payment email; downgrade to free after 7 days');
    { // failed-payment email: only promises what exists (no card-update flow); re-subscribe link; HE + EN; sent once; a delivery failure doesn't abort the run
      const fm = mailsTo('fail@t.test').at(-1); const strip = h => h.replace(/<[^>]+>/g, ' ');
      assert.ok(!/קישור מאובטח|secure link|ננסה לחייב|retry the charge/.test(fm.html), 'no card-update link / retry promise'); assert.match(fm.html, /אין טופס לעדכון כרטיס/); assert.match(fm.html, /href="http[^"]*\/he\/checkout\?plan=pro"/); assert.match(strip(fm.html), /7 ימים/); assert.match(fm.html, /dir="rtl"/);
      const en = renderTx('failed', 'en', { planName: 'Pro', amount: 179, currency: 'ILS', link: 'https://askranky.com/en/checkout?plan=pro' }); assert.ok(!/secure link|retry the charge/.test(en.html)); assert.match(en.html, /href="https:\/\/askranky\.com\/en\/checkout\?plan=pro"/); assert.match(en.html, /There is no card-update form yet/); assert.match(strip(en.html), /7-day grace period/);
      const nolink = renderTx('failed', 'en', { planName: 'Pro', amount: 1, currency: 'ILS', link: 'javascript:alert(1)' }); assert.ok(!/href=/.test(nolink.html), 'unsafe link dropped'); assert.match(nolink.html, /reply to this email/);
      const lg = renderTx('login', 'he', { link: 'https://askranky.com/auth/magic?a=x&t=y' }); assert.match(lg.subject, /קישור הכניסה שלך ל-Ranky/); assert.match(lg.html, /^<!doctype html><html lang="he" dir="rtl">/); assert.match(lg.html, /href="https:\/\/askranky\.com\/auth\/magic\?a=x&amp;t=y"/); assert.match(renderTx('login', 'en', { link: 'https://x.test/a' }).html, /valid for 15 minutes/);
      const g = paidAccount('softfail@t.test', { lang: 'en' }); const h = paidAccount('after@t.test'); const nowS = new Date('2026-12-01T04:00:00Z'); const savedFetch = globalThis.fetch; process.env.EMAIL_MODE = 'live'; process.env.RESEND_API_KEY = 're_test_not_real_0000'; const quiet = console.error; console.error = () => {};
      globalThis.fetch = async () => ({ ok: false, status: 403, text: async () => '{"name":"validation_error","message":"The domain is not verified."}' });
      try { const rs = await syncAll({ payments: { id: 'mock', sync: async () => ({ active: false }) }, now: nowS }); assert.ok(rs.pastDue >= 2); assert.ok(g.failedNoticeAt && h.failedNoticeAt, 'run completed for every account'); assert.ok(getDb().events.some(e => e.type === 'billing.email_failed' && e.account === g.id));
        globalThis.fetch = async () => { throw new Error('must not re-send'); }; await syncAll({ payments: { id: 'mock', sync: async () => ({ active: false }) }, now: new Date(nowS.getTime() + 864e5) }); }
      finally { globalThis.fetch = savedFetch; console.error = quiet; delete process.env.EMAIL_MODE; delete process.env.RESEND_API_KEY; }
      ok('failed-payment email: no card-update/retry promises, re-subscribe link + reply for help (HE/EN, RTL), unsafe link dropped; a failed delivery is logged, does not abort the sync and is not re-sent next run; sign-in email HE/EN'); }
    { const { renderWeeklyEmail } = await import('../src/email/report.js'); const sc = { summary: { score: 40, mentionRate: .2, checks: 10, avgRank: null, byEngine: {}, topCompetitors: [] }, fixes: [], mock: false }; const bz = { name: 'Cafe' };
      const one = renderWeeklyEmail({ business: bz, scan: sc, reportUrl: 'https://askranky.com/r/x', unsubscribeUrl: 'https://askranky.com/unsubscribe?t=1', variant: 'report' }); const wk = renderWeeklyEmail({ business: bz, scan: sc, reportUrl: 'https://askranky.com/r/x', unsubscribeUrl: 'https://askranky.com/unsubscribe?t=1' });
      assert.match(one, /AI visibility report: Cafe/); assert.ok(!/weekly report|This week/.test(one)); assert.match(one, /Your 3 fixes/); assert.match(wk, /weekly report: Cafe/); assert.match(wk, /This week's 3 fixes/); assert.ok(one.includes(BRAND.address) && wk.includes(BRAND.address) && one.includes(BRAND.legalEntity), 'sender identity + address in the footer'); ok('one-off report email is not called "weekly"; both report emails carry sender name + postal address + unsubscribe'); }
    const thrower = { id: 'mock', sync: async () => { throw new Error('boom'); } }; const r2 = await syncAll({ payments: thrower, now }); assert.ok(r2.errors >= 1); ok('sync errors are recorded per account, job keeps going');
    let ran = 0; startBillingCron({ delayMs: 5, everyMs: 10, run: async () => { ran++; } }); await new Promise(r => setTimeout(r, 40)); stopBillingCron(); assert.ok(ran >= 2); ok('in-process scheduler runs syncAll repeatedly (BILLING_SYNC_CRON=1)');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); assert.match(pkg.scripts['billing:sync'], /scripts\/billing-sync\.js/); assert.match(fs.readFileSync('GO-LIVE.md', 'utf8'), /billing:sync/); ok('npm run billing:sync script for a Render cron, documented in GO-LIVE.md'); }
  // 2) cancel route + UI
  { const a = paidAccount('cancel@t.test'); let cancelled = 0; const orig = mockPayments.cancel; mockPayments.cancel = async acc => { cancelled++; assert.equal(acc.id, a.id); return { ok: true }; };
    assert.equal((await post(`/api/dashboard/${a.id}/cancel`, { confirm: true })).status, 403); assert.equal((await post(`/api/dashboard/${a.id}/cancel`, { confirm: true }, { 'x-dashboard-key': 'wrong' })).status, 403);
    assert.equal((await post(`/api/dashboard/${a.id}/cancel`, {}, { 'x-dashboard-key': a.key })).status, 400); assert.equal(cancelled, 0); ok('cancel: needs the dashboard key and an explicit confirm');
    const r = await post(`/api/dashboard/${a.id}/cancel`, { confirm: true, lang: 'he' }, { 'x-dashboard-key': a.key }); const j = await r.json(); assert.equal(r.status, 200); assert.equal(cancelled, 1); assert.ok(j.paidThrough);
    assert.equal(a.status, 'cancelled'); assert.equal(a.plan, 'pro', 'access kept until paidThrough'); const m = mailsTo('cancel@t.test').at(-1); assert.match(m.subject, /המנוי שלך ב-Ranky בוטל/); assert.match(m.html, /לא יבוצעו חיובים נוספים/); assert.match(m.html, /dir="rtl"/);
    const again = await (await post(`/api/dashboard/${a.id}/cancel`, { confirm: true }, { 'x-dashboard-key': a.key })).json(); assert.equal(again.already, true); assert.equal(cancelled, 1);
    const dj = await (await get(`/api/dashboard/${a.id}`, { 'x-dashboard-key': a.key })).json(); assert.equal(dj.account.status, 'cancelled'); assert.equal(dj.account.active, false);
    ok('cancel: calls payments.cancel once, keeps access until paidThrough, HE confirmation email, idempotent, dashboard shows status');
    mockPayments.cancel = async () => { throw new Error('down'); }; const b = paidAccount('cfail@t.test'); assert.equal((await post(`/api/dashboard/${b.id}/cancel`, { confirm: true }, { 'x-dashboard-key': b.key })).status, 502); assert.equal(b.status, 'active'); mockPayments.cancel = orig; ok('provider failure → 502, subscription untouched');
    await syncAll({ payments: { id: 'mock', sync: async () => ({ active: true }) }, now: new Date(Date.parse(a.paidThrough) + 1000) }); assert.equal(a.plan, 'free'); ok('sync downgrades a cancelled plan after paidThrough without calling the provider');
    const d = fs.readFileSync('web/components/Dashboard.tsx', 'utf8'); assert.match(d, /data-cancel-confirm/); assert.match(d, /confirm: true/); const i = fs.readFileSync('web/lib/i18n.ts', 'utf8'); assert.match(i, /cancelYes: "Yes, cancel"/); assert.match(i, /cancelYes: "כן, לבטל"/); ok('dashboard UI: cancel button → confirm dialog (HE/EN)'); }
  // 3) webhooks
  { const hit = (h = {}, qs = '') => post('/webhooks/payments' + qs, { EntityID: 1 }, h);
    assert.equal((await hit()).status, 401); assert.equal((await hit({ 'x-webhook-secret': '' })).status, 401); ok('webhook rejected when SUMIT_WEBHOOK_SECRET is unset');
    process.env.SUMIT_WEBHOOK_SECRET = 'short'; assert.equal((await hit({ 'x-webhook-secret': 'short' })).status, 401); ok('webhook rejected when the secret is too short to be real');
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec-0123456789abcdef'; assert.equal((await hit({ 'x-webhook-secret': 'whsec-0123456789abcdeX' })).status, 401); assert.equal((await hit()).status, 401);
    assert.equal((await hit({ 'x-webhook-secret': 'whsec-0123456789abcdef' })).status, 200); assert.equal((await hit({}, '?secret=whsec-0123456789abcdef')).status, 200); delete process.env.SUMIT_WEBHOOK_SECRET; ok('webhook: wrong/missing secret 401; correct header or ?secret= 200'); }
  // 4) unsubscribe + consent
  { const a = paidAccount('unsub@t.test', { lang: 'en' }); const t = C.unsubToken(a.id, 'all'); assert.deepEqual(C.verifyUnsubToken(t), { accountId: a.id, channel: 'all' });
    assert.equal(C.verifyUnsubToken(t.slice(0, -2) + 'xx'), null); assert.equal(C.verifyUnsubToken(Buffer.from('other.all').toString('base64url') + '.' + t.split('.')[1]), null); ok('unsubscribe token is HMAC-signed; tampering is rejected');
    const biz = { id: 'bz' + a.id, accountId: a.id, name: 'Unsub Cafe', category: 'Cafe', city: 'Haifa', scanIds: [] }; getDb().businesses[biz.id] = biz;
    let w = await runWeekly({ base: B }); assert.ok(w.sent >= 1); const wm = mailsTo('unsub@t.test').at(-1); assert.match(wm.html, /href="http:\/\/127\.0\.0\.1:\d+\/unsubscribe\?t=/); assert.ok(!wm.html.includes('{{unsubscribe}}')); assert.match(wm.headers['List-Unsubscribe'], /unsubscribe\?t=/); assert.equal(wm.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click'); ok('weekly email has a real signed unsubscribe link + List-Unsubscribe headers');
    const link = wm.html.match(/href="([^"]*unsubscribe[^"]*)"/)[1].replaceAll('&amp;', '&').replace(/^https?:\/\/[^/]+/, '');
    const g = await get(link); const gt = await g.text(); assert.equal(g.status, 200); assert.match(gt, /<form method="post"/); assert.equal(g.headers.get('x-robots-tag'), 'noindex, nofollow'); assert.notEqual(a.emailPrefs?.weekly, false, 'GET alone does not unsubscribe');
    const he = await (await get(link.replace('lang=en', 'lang=he'))).text(); assert.match(he, /dir="rtl"/); assert.match(he, /ביטול הרשמה/); ok('unsubscribe page: confirm step (POST form), HE RTL + EN, noindex');
    const p = await realFetch(B + link, { method: 'POST' }); assert.equal(p.status, 200); assert.match(await p.text(), /unsubscribed/); assert.equal(a.emailPrefs.weekly, false); assert.equal(a.emailPrefs.marketing, false);
    assert.ok(a.consentHistory.filter(h => h.granted === false).every(h => Date.parse(h.at) > 0)); assert.ok(getDb().events.some(e => e.type === 'consent.optout' && e.account === a.id)); ok('POST unsubscribes; opt-out history has timestamps + event');
    const before = mailsTo('unsub@t.test').length; w = await runWeekly({ base: B }); assert.equal(mailsTo('unsub@t.test').length, before); assert.ok(w.skipped >= 1); ok('weekly job skips opted-out accounts');
    assert.equal((await get('/unsubscribe?t=bogus')).status, 400); assert.equal((await realFetch(B + '/unsubscribe?t=bogus', { method: 'POST' })).status, 400); ok('bad token → 400, nothing changes');
    const c = { id: 'c1' }; C.setConsent(c, 'marketing', true, 'scan-form', new Date('2026-10-01T00:00:00Z')); assert.equal(C.canSend(c, 'marketing'), true); C.setConsent(c, 'marketing', false, 'unsubscribe-page', new Date('2026-10-02T00:00:00Z'));
    assert.equal(C.canSend(c, 'marketing'), false); assert.deepEqual(c.consentHistory.map(h => [h.at.slice(0, 10), h.granted]), [['2026-10-01', true], ['2026-10-02', false]]); assert.equal(C.canSend({}, 'marketing'), false); assert.equal(C.canSend({}, 'transactional'), true);
    ok('consent: opt-in → opt-out history kept in order; marketing off by default; transactional always allowed');
    const r = await post('/api/scan', { name: 'Opt', category: 'Plumber', city: 'Haifa', email: 'optin@t.test', marketingConsent: 'on' }); assert.equal(r.status, 200); const oa = Object.values(getDb().accounts).find(x => x.email === 'optin@t.test');
    assert.equal(oa.consentHistory[0].granted, true); assert.equal(oa.consentHistory[0].source, 'scan-form'); assert.match(mailsTo('optin@t.test').at(-1).html, /unsubscribe\?t=/); ok('scan-form opt-in is recorded in the history; report email also carries an unsubscribe link'); }
  // 5) EMAIL_FROM / EMAIL_REPLY_TO
  { const m = mails().at(-1); assert.equal(m.from, 'Ranky Test <hello@askranky.com>'); assert.equal(m.replyTo, 'help@askranky.com');
    const { emailFrom, emailReplyTo } = await import('../src/email/send.js'); delete process.env.EMAIL_FROM; delete process.env.EMAIL_REPLY_TO; assert.equal(emailFrom(), 'Ranky <hello@askranky.com>'); assert.equal(emailReplyTo(), BRAND.supportEmail);
    process.env.EMAIL_FROM = 'Ranky Test <hello@askranky.com>'; process.env.EMAIL_REPLY_TO = 'help@askranky.com';
    assert.ok(checkConfig({ EMAIL_MODE: 'resend', RESEND_API_KEY: 'x' }).errors.some(e => e.startsWith('UNSUBSCRIBE_SECRET'))); ok('EMAIL_FROM / EMAIL_REPLY_TO configurable (defaults: hello@askranky.com / support); live email requires UNSUBSCRIBE_SECRET'); }
  // 6) templates
  { for (const l of ['he', 'en']) { const r = renderTx('receipt', l, { planName: 'Pro', amount: 179, currency: 'ILS', paidThrough: '2026-11-22', receiptUrl: 'javascript:alert(1)' }); assert.ok(!/javascript:/.test(r.html)); assert.ok(!/מע"מ|VAT/.test(r.html)); assert.match(r.html, /322713082/);
      const x = renderTx('failed', l, { planName: '<b>x</b>', amount: 1, currency: 'ILS' }); assert.ok(!x.html.includes('<b>x</b>')); assert.match(x.html, /7/); }
    assert.match(renderTx('receipt', 'he', { planName: 'Pro', amount: 179, currency: 'ILS' }).subject, /^קבלה מ-Ranky: Pro, 179 ILS$/); assert.match(renderTx('cancel', 'en', { planName: 'Pro', cancelDate: '2026-10-22', paidThrough: '2026-11-22' }).html, /No further charges will be made/);
    ok('templates (receipt / failed / cancel) HE+EN follow ops/email-templates, escaped, no VAT wording, receipt link http(s) only'); }
  // 7) pre-launch admin test checkout
  { process.env.PRELAUNCH = '1'; const ck = (h = {}) => post('/api/checkout', { plan: 'pro', email: 'admin-test@t.test', lang: 'he' }, h);
    assert.equal((await ck()).status, 403); assert.equal((await ck({ 'x-admin-test-token': 'anything' })).status, 403); ok('pre-launch: checkout blocked without ADMIN_TEST_TOKEN configured');
    process.env.ADMIN_TEST_TOKEN = 'adm-0123456789abcdef'; assert.equal((await ck({ 'x-admin-test-token': 'adm-0123456789abcdeX' })).status, 403); assert.equal((await ck()).status, 403);
    const r = await ck({ 'x-admin-test-token': 'adm-0123456789abcdef' }); assert.equal(r.status, 200); const j = await r.json(); assert.match(j.redirectUrl, /^\/mock-checkout\?/);
    const mc = await get(j.redirectUrl); assert.match(mc.headers.get('location'), /\/checkout\?.*admintest=1/); const acct = new URL(B + j.redirectUrl).searchParams.get('account');
    const ret = await get(`/billing/return?Valid=1&Token=tok&Identifier=${encodeURIComponent(acct)}&lang=he`); assert.equal(ret.status, 200); const a = Object.values(getDb().accounts).find(x => x.email === 'admin-test@t.test');
    assert.equal(a.plan, 'pro'); assert.equal(a.adminTest, true); assert.match(a.subscriptionRef, /^mock_/); const rc = mailsTo('admin-test@t.test').find(m => /^קבלה מ-Ranky/.test(m.subject)); assert.ok(rc, 'receipt email (HE) in outbox'); assert.match(rc.html, /179 ILS/);
    ok('pre-launch + valid ADMIN_TEST_TOKEN (timing-safe): mock checkout → return activates plan (flagged adminTest) + HE receipt email');
    const other = Object.values(getDb().accounts).find(x => x.email === 'unsub@t.test'); other.checkoutState = 'st'; assert.equal((await get(`/billing/return?Valid=1&Token=t&Identifier=${other.id}.st`)).status, 403); ok('pre-launch: a non-admin checkout return is still refused');
    process.env.PAYMENTS_PROVIDER = 'sumit'; assert.equal((await ck({ 'x-admin-test-token': 'adm-0123456789abcdef' })).status, 403); delete process.env.PAYMENTS_PROVIDER; ok('admin test checkout never works with real payments (SUMIT)');
    delete process.env.ADMIN_TEST_TOKEN; delete process.env.PRELAUNCH; }
  // 8) Hebrew legal pages
  { for (const d of ['terms', 'privacy', 'refunds', 'disclaimer', 'accessibility']) { const p = await get(`/he/legal/${d}`); assert.equal(p.status, 200, d); assert.match(await p.text(), /<html lang="he" dir="rtl"/);
      const j = await (await get(`/api/legal/he/${d}`)).json(); assert.equal(j.lang, 'he'); assert.ok(j.markdown.includes(BRAND.legalEntityHe) || j.markdown.includes(BRAND.entityId) || j.markdown.includes(BRAND.supportEmail) || j.markdown.includes(BRAND.name), d); }
    const t = await (await get('/api/legal/he/terms')).json(); assert.match(t.markdown, /שי שוטשוילי/); assert.match(t.markdown, /322713082/); assert.ok(!/\[[A-Z_]+\]/.test(t.markdown));
    assert.equal((await get('/legal/he/terms')).status, 301); ok('Hebrew legal pages: /he/legal/{doc} → 200 RTL; API returns Hebrew docs with שי שוטשוילי / 322713082');
    const { execFileSync } = await import('node:child_process'); const out = execFileSync(process.execPath, ['--input-type=module', '-e', "const {BRAND}=await import('./src/brand.js');process.stdout.write(BRAND.legalEntity)"], { env: { ...process.env, LEGAL_ENTITY: 'Test Entity Ltd' } }).toString();
    assert.equal(out, 'Test Entity Ltd'); assert.equal(process.env.LEGAL_ENTITY, undefined); const s = await (await get('/api/seller')).json(); assert.equal(s.name, BRAND.legalEntity); assert.equal(s.nameHe, 'שי שוטשוילי'); ok('LEGAL_ENTITY env overrides the brand entity; /api/seller renders entity details'); }
  // 9) SEO P1
  { const he = await (await get('/he')).text(), en = await (await get('/en')).text(); const lds = h => [...h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    const types = h => lds(h).flatMap(o => o['@graph'] ? o['@graph'].map(g => g['@type']) : [o['@type']]);
    for (const h of [he, en]) for (const ty of ['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']) assert.ok(types(h).includes(ty), ty);
    const app = l => lds(l).flatMap(o => o['@graph'] || []).find(g => g['@type'] === 'SoftwareApplication'); assert.equal(app(he).offers[0].priceCurrency, 'ILS'); assert.equal(app(en).offers[0].priceCurrency, 'USD'); assert.equal(app(he).offers[0].price, '0');
    assert.equal(app(he).offers.length, 1, 'pre-launch build publishes only the free offer');
    const faq = lds(he).find(o => o['@type'] === 'FAQPage'); assert.match(faq.mainEntity[0].name, /[\u0590-\u05FF]/); ok('JSON-LD: Organization, WebSite, SoftwareApplication (offers, currency per language), FAQPage (HE text on /he)');
    const scanHe = await (await get('/he/scan')).text(); const desc = h => h.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.notEqual(desc(scanHe), desc(he)); assert.match(desc(scanHe), /[\u0590-\u05FF]/); assert.match(scanHe, /og:image" content="https:\/\/askranky\.com\/og-he\.png"/); assert.match(en, /og:image" content="https:\/\/askranky\.com\/og-en\.png"/); assert.match(scanHe, /<title>סריקת AI חינם/);
    assert.equal((await get('/og-he.png')).status, 200); assert.equal((await get('/logo.png')).status, 200); ok('per-page Hebrew/English meta descriptions + titles, og:image per language (served)');
    for (const p of ['/he/dashboard/x', '/en/login', '/he/login', '/en/checkout']) { const r = await get(p); assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow', p); assert.match(await r.text(), /<meta name="robots" content="noindex, nofollow"/, p); }
    for (const p of ['/billing/return', '/dashboard/x', '/login']) assert.equal((await get(p)).headers.get('x-robots-tag'), 'noindex, nofollow', p);
    assert.equal((await get('/he')).headers.get('x-robots-tag'), null); ok('noindex (meta + X-Robots-Tag) on dashboard/login/checkout/billing; public pages indexable');
    const llm = await get('/llms.txt'); assert.equal(llm.status, 200); assert.match(await llm.text(), /^# Ranky/); const sm = await (await get('/sitemap.xml')).text(); assert.match(sm, /hreflang="x-default" href="https:\/\/askranky\.com\/en\/scan"/); assert.match(sm, /hreflang="x-default" href="https:\/\/askranky\.com\/"/);
    assert.match(he, /hrefLang="x-default" href="https:\/\/askranky\.com\/?"/); ok('llms.txt served; x-default → /en<path> (root → /)'); }
  assert.equal(outbound, 0, 'no outbound network calls'); ok('no outbound network calls (no SUMIT / Resend / AI APIs)');
  console.log(`ALL BILLING/QUEUE TESTS PASSED (${n})`);
} finally { globalThis.fetch = realFetch; srv.close(); await flush(); TD.done(); }
