// Scan follow-up email (src/followup.js, POST /api/internal/cron/followup): inert unless FOLLOWUP_EMAILS_ENABLED=1, not scheduled, opted-in addresses only,
// 24-72h window, one per address ever, never to paying / unsubscribed accounts, HE/EN by scan.lang, real top-3 fixes, no discount unless configured. Mock outbox only.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { useTempData } from './helpers.js'; const TD = useTempData('followup');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'CRON_SECRET', 'WEEKLY_EMAILS_ENABLED', 'FOLLOWUP_EMAILS_ENABLED', 'FOLLOWUP_OFFER_TEXT_HE', 'FOLLOWUP_OFFER_TEXT_EN', 'REPORT_EMAIL_MAX_PER_DAY']) delete process.env[k];
Object.assign(process.env, { DISABLE_IP_LIMIT: '1', SCAN_RATE_MAX: '500', UNSUBSCRIBE_SECRET: 'test-unsub-secret-0123456789', BASE_URL: 'https://askranky.com' });
const realFetch = globalThis.fetch; const { default: app, CONSENT_VERSION } = await import('../server.js'); const { getDb, flush, save } = await import('../src/store.js');
const F = await import('../src/followup.js'); const { verifyUnsubToken } = await import('../src/consent.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
let outbound = 0; globalThis.fetch = (u, o) => { if (!String(u).startsWith(B)) { outbound++; throw new Error('outbound fetch blocked'); } return realFetch(u, o); };
const META = path.join(TD.dir, 'outbox-meta'); const mails = () => fs.existsSync(META) ? fs.readdirSync(META).sort().map(f => ({ ...JSON.parse(fs.readFileSync(path.join(META, f), 'utf8')), html: fs.readFileSync(path.join(TD.outbox, f.replace(/\.json$/, '.html')), 'utf8') })) : [];
const fu = to => mails().filter(m => m.to === to && m.kind === 'marketing');
const post = (p, body, h = {}) => realFetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) });
const SECRET = 'cron-secret-0123456789abcdef-XYZ'; const cron = () => post('/api/internal/cron/followup', {}, { 'X-Cron-Secret': SECRET });
const acct = e => Object.values(getDb().accounts).find(a => a.email === e); const scanOf = e => Object.values(getDb().scans).find(s => s.accountId === acct(e).id);
const age = (e, h) => { scanOf(e).at = new Date(Date.now() - h * 36e5).toISOString(); save(); };
const scan = async (email, extra = {}) => { const r = await post('/api/scan', { name: 'Cafe ' + email.split('@')[0], category: 'Cafe', city: 'Haifa', email, ...extra }); assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
try {
  // ---- consent capture ----
  const form = fs.readFileSync('web/components/ScanForm.tsx', 'utf8'); assert.match(form, /type="checkbox" name="marketingConsent"[^>]*defaultChecked=\{false\}/); const i18n = fs.readFileSync('web/lib/i18n.ts', 'utf8');
  assert.ok(i18n.includes('consent: "Send me tips and offers by email (optional, unsubscribe anytime)."') && i18n.includes('consent: "שלחו לי טיפים והצעות במייל (לא חובה, אפשר להסיר בכל עת)."'));
  await scan('yes@t.test', { lang: 'he', marketingConsent: 'on' }); await scan('no@t.test', { lang: 'en' });
  const c = acct('yes@t.test').marketingConsent; assert.equal(c.granted, true); assert.ok(Date.parse(c.at)); assert.equal(c.version, CONSENT_VERSION); assert.equal(CONSENT_VERSION, 'scan-form-2026-10-25'); assert.ok(F.OFFER_CONSENT_VERSIONS.includes(CONSENT_VERSION));
  assert.ok(!acct('no@t.test').marketingConsent); ok('scan form: unticked-by-default "tips and offers" checkbox (he/en); consent stored with timestamp + text version only when ticked');
  // ---- endpoint gating ----
  let r = await cron(); assert.equal(r.status, 404); process.env.CRON_SECRET = SECRET; assert.equal((await post('/api/internal/cron/followup', {}, { 'X-Cron-Secret': 'nope-nope-nope-nope' })).status, 401);
  age('yes@t.test', 25); age('no@t.test', 25); r = await cron(); assert.deepEqual(await r.json(), { ok: true, skipped: 'followup_disabled' }); assert.equal(fu('yes@t.test').length, 0);
  for (const v of ['true', '0', 'yes']) { process.env.FOLLOWUP_EMAILS_ENABLED = v; assert.equal((await (await cron()).json()).skipped, 'followup_disabled'); }
  ok('no CRON_SECRET → 404, wrong secret → 401, FOLLOWUP_EMAILS_ENABLED not exactly "1" → 200 {skipped:"followup_disabled"} and nothing sent');
  // ---- window ----
  process.env.FOLLOWUP_EMAILS_ENABLED = '1'; age('yes@t.test', 23); r = await cron(); assert.equal(r.status, 200); assert.equal(fu('yes@t.test').length, 0); ok('scan younger than 24h → not yet');
  age('yes@t.test', 25); await cron(); let m = fu('yes@t.test'); assert.equal(m.length, 1); assert.equal(fu('no@t.test').length, 0); ok('opted-in address gets the follow-up at 24h; address without consent gets nothing');
  m = m[0]; const s = scanOf('yes@t.test'); assert.equal(m.subject, 'פרסומת: שלושה דברים שיקדמו אותך בתשובות של ChatGPT'); assert.match(m.html, /^<!doctype html><html lang="he" dir="rtl">/);
  for (const f of s.fixes.slice(0, 3)) assert.ok(m.html.includes(f.title.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')) || m.html.includes(f.title), f.title);
  assert.ok(m.html.includes(`https://askranky.com/r/${s.id}`) && m.html.includes('https://askranky.com/he/checkout?plan=starter')); assert.ok(m.html.includes('שי שוטשוילי') && /אצ("|&quot;|&#34;)ל 8/.test(m.html));
  const u = m.html.match(/href="(https:\/\/askranky\.com\/unsubscribe\?t=[^"]+)"/)[1].replaceAll('&amp;', '&'); assert.equal(m.headers['List-Unsubscribe'], `<${u}>`); assert.deepEqual(verifyUnsubToken(new URL(u).searchParams.get('t')), { accountId: acct('yes@t.test').id, channel: 'marketing' });
  assert.ok(!/הנחה|discount|data-offer|₪|\$/i.test(m.html)); assert.ok(s.followupSentAt && acct('yes@t.test').followupSentAt);
  ok('Hebrew follow-up: "פרסומת" subject, RTL, that scan\'s own top 3 fixes, report + checkout links, sender identity + address, signed marketing unsubscribe link + List-Unsubscribe; no discount by default; followupSentAt set');
  // ---- idempotency / one per address ever ----
  await cron(); assert.equal(fu('yes@t.test').length, 1); getDb().scans[s.id].followupSentAt = undefined; delete getDb().scans[s.id].followupSentAt; save(); await cron(); assert.equal(fu('yes@t.test').length, 1, 'account-level guard');
  ok('re-running the job sends nothing again; even a second scan for the same address never gets a second follow-up');
  // ---- English, offer only when configured + offer-consent version ----
  process.env.FOLLOWUP_OFFER_TEXT_EN = 'First month 50% off with code X'; await scan('en@t.test', { lang: 'en', marketingConsent: true }); age('en@t.test', 30); await cron(); m = fu('en@t.test')[0];
  assert.equal(m.subject, 'פרסומת | Ad: Three things that will lift you in ChatGPT answers'); assert.match(m.html, /lang="en" dir="ltr"/); assert.ok(m.html.includes('data-offer') && m.html.includes('First month 50% off with code X'));
  await scan('old@t.test', { lang: 'en', marketingConsent: true }); acct('old@t.test').marketingConsent.version = 'scan-form-2026-10-22'; age('old@t.test', 30); await cron(); m = fu('old@t.test')[0]; assert.ok(m && !m.html.includes('data-offer'));
  delete process.env.FOLLOWUP_OFFER_TEXT_EN; ok('English follow-up by scan.lang; offer line only from FOLLOWUP_OFFER_TEXT_EN and only for consent to the "tips and offers" wording (older "product news" consent: email without offer)');
  // ---- exclusions ----
  await scan('late@t.test', { marketingConsent: true }); age('late@t.test', 73); await scan('paid@t.test', { marketingConsent: true }); Object.assign(acct('paid@t.test'), { plan: 'starter', subscriptionRef: '7', status: 'active' }); age('paid@t.test', 25);
  await scan('unsub@t.test', { marketingConsent: true }); age('unsub@t.test', 25); const ut = fu('yes@t.test')[0].html.match(/unsubscribe\?t=([^"&]+)/); // reuse flow on a fresh account
  const { unsubToken } = await import('../src/consent.js'); r = await realFetch(B + '/unsubscribe?t=' + encodeURIComponent(unsubToken(acct('unsub@t.test').id, 'marketing')), { method: 'POST' }); assert.equal(r.status, 200); assert.ok(ut);
  await scan('limited@t.test', { marketingConsent: true }); age('limited@t.test', 25); process.env.REPORT_EMAIL_MAX_PER_DAY = '1';
  await cron(); for (const e of ['late', 'paid', 'unsub', 'limited']) assert.equal(fu(e + '@t.test').length, 0, e); assert.ok(!acct('limited@t.test').followupSentAt, 'rate-limited: not marked, may go later in window');
  delete process.env.REPORT_EMAIL_MAX_PER_DAY; ok('skipped: past the 72h window, paying subscriber, unsubscribed (via the real unsubscribe link), and over the shared per-address email limit');
  // ---- unit: render escapes, no invented data ----
  const h = F.renderFollowup({ business: { name: '<b>x</b>' }, scan: { id: 'S1', summary: { score: 12 }, fixes: [{ title: '<i>t</i>', why: 'w' }] }, lang: 'en', base: 'https://askranky.com', unsubscribeUrl: 'https://askranky.com/unsubscribe?t=a' });
  assert.ok(!h.html.includes('<b>x</b>') && !h.html.includes('<i>t</i>') && h.fixes === 1); ok('render: values escaped; uses only the fixes the scan has');
  // ---- not scheduled ----
  const srvSrc = fs.readFileSync('server.js', 'utf8'); assert.equal((srvSrc.match(/runFollowup/g) || []).length, 2); assert.ok(!/cron\/followup/.test(fs.readFileSync('package.json', 'utf8'))); assert.ok(!fs.existsSync('.github/workflows'));
  for (const f of ['legal/privacy.md', 'legal/privacy.he.md']) assert.match(fs.readFileSync(f, 'utf8'), /1\.3/); assert.equal(outbound, 0); ok('not scheduled by the app / npm scripts / workflows; privacy v1.3 mentions it; no outbound network');
  console.log(`ALL FOLLOWUP TESTS PASSED (${n})`);
} finally { globalThis.fetch = realFetch; srv.close(); await flush(); TD.done(); }
process.exit(0);
