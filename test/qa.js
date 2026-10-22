// QA fixes: robots/sitemap, per-language SEO metadata, localized /billing/return, branded 404, Hebrew sample data, pre-launch mode.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js';
const TD = useTempData('qa'); delete process.env.PRELAUNCH; delete process.env.PAYMENTS_PROVIDER; delete process.env.SCAN_MODE; const ENV0 = process.env.NODE_ENV;
const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js'); const { isPrelaunch } = await import('../src/prelaunch.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const post = (p, b, h = {}) => fetch(B + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(b) });
const txt = (p, h = {}) => fetch(B + p, { headers: h, redirect: 'manual' }).then(async r => ({ s: r.status, t: await r.text(), ct: r.headers.get('content-type') }));
try {
  // 1. robots + sitemap
  const rb = (await txt('/robots.txt')).t; const groups = rb.split(/\n\n/).filter(g => g.startsWith('User-agent'));
  assert.ok(groups.length >= 10); for (const g of groups) for (const d of ['/app', '/api/', '/billing/', '/report']) assert.ok(g.includes(`Disallow: ${d}\n`) || g.endsWith(`Disallow: ${d}`), `${g.split('\n')[0]} missing ${d}`);
  assert.match(rb, /User-agent: GPTBot/); assert.match(rb, /User-agent: PerplexityBot/); assert.match(rb, /Sitemap: https:\/\/askranky\.com\/sitemap\.xml/); ok(`robots.txt: ${groups.length} groups each repeat all disallows; sitemap referenced`);
  const sm = await txt('/sitemap.xml'); assert.match(sm.ct, /xml/); assert.match(sm.t, /<loc>https:\/\/askranky\.com\/he<\/loc>/); assert.match(sm.t, /hreflang="en" href="https:\/\/askranky\.com\/en\/scan"/); assert.match(sm.t, /hreflang="x-default"/); assert.ok(!/&(?!amp;)/.test(sm.t)); ok('sitemap.xml: he/en pages with hreflang alternates, XML-escaped');
  // 2. metadata (static export)
  if (fs.existsSync('web/out/he.html')) { const he = fs.readFileSync('web/out/he.html', 'utf8'), en = fs.readFileSync('web/out/en/scan.html', 'utf8');
    assert.match(he, /<link rel="canonical" href="https:\/\/askranky\.com\/he"\/>/); assert.match(he, /hrefLang="x-default"/); assert.match(he, /og:locale" content="he_IL"/); assert.match(he, /<title>[^<]*ממליץ/);
    assert.match(en, /canonical" href="https:\/\/askranky\.com\/en\/scan"/); assert.match(en, /hrefLang="he" href="https:\/\/askranky\.com\/he\/scan"/); ok('per-language title/OG/canonical/hreflang in exported HTML'); }
  // 5. Hebrew sample competitors
  const mock = fs.readFileSync('web/lib/mock.ts', 'utf8'); assert.match(mock, /l === "he" \? \[ \{ name: "אינסטלציה רדיאנט"/); ok('Hebrew sample report uses Hebrew competitors');
  // 3. /billing/return localized
  assert.equal(isPrelaunch(), false); let j = await (await post('/api/checkout', { plan: 'starter', email: 'he@t.test', lang: 'he' })).json();
  const ident = new URL(B + j.redirectUrl).searchParams.get('account'); const acc = getDb().accounts[ident.split('.')[0]]; assert.equal(acc.pendingLang, 'he');
  let r = await txt(`/billing/return?Valid=0&Identifier=${encodeURIComponent(ident)}`); assert.match(r.t, /dir="rtl"/); assert.match(r.t, /התשלום נכשל/); ok('/billing/return failure in Hebrew (RTL) from checkout language');
  r = await txt(`/billing/return?Valid=1&Token=t&lang=he&Identifier=${encodeURIComponent(ident)}`); assert.equal(r.s, 200); assert.match(r.t, /התשלום התקבל/); ok('/billing/return success in Hebrew');
  r = await txt('/billing/return?Identifier=x.y&lang=en'); assert.equal(r.s, 400); assert.match(r.t, /Checkout link invalid/); assert.match(r.t, /dir="ltr"/);
  r = await txt('/billing/return?Identifier=x.y', { cookie: 'ranky_lang=he' }); assert.match(r.t, /קישור התשלום לא תקין/); ok('/billing/return invalid link: en / he by cookie');
  // 4. branded 404
  r = await txt('/he/nope'); assert.equal(r.s, 404); assert.match(r.t, /<html lang="he" dir="rtl">/); assert.match(r.t, /העמוד לא נמצא/); assert.match(r.t, /Page not found/); assert.match(r.t, /Ranky/); assert.match(r.t, /noindex/); ok('404 /he/*: branded, bilingual, RTL');
  r = await txt('/en/x/y/z'); assert.match(r.t, /<html lang="en" dir="ltr">/); assert.ok(r.t.indexOf('Page not found') < r.t.indexOf('העמוד לא נמצא')); ok('404 /en/*: English first, Hebrew section RTL');
  r = await txt('/<script>x'); assert.ok(!r.t.includes('<script>x')); r = await fetch(B + '/api/nope'); assert.equal(r.status, 404); assert.equal((await r.json()).error, 'not found'); ok('404 does not reflect path; /api 404 stays JSON');
  // 6. pre-launch
  process.env.NODE_ENV = 'production'; assert.equal(isPrelaunch(), true); ok('auto pre-launch: NODE_ENV=production + mock providers');
  process.env.SCAN_MODE = 'live'; process.env.PAYMENTS_PROVIDER = 'sumit'; assert.equal(isPrelaunch(), false); process.env.PAYMENTS_PROVIDER = 'mock'; assert.equal(isPrelaunch(), true); delete process.env.SCAN_MODE; delete process.env.PAYMENTS_PROVIDER;
  process.env.PRELAUNCH = '0'; assert.equal(isPrelaunch(), false); process.env.NODE_ENV = ENV0 ?? ''; if (ENV0 === undefined) delete process.env.NODE_ENV; process.env.PRELAUNCH = '1'; assert.equal(isPrelaunch(), true); ok('PRELAUNCH=1 forces on, PRELAUNCH=0 forces off; live+sumit in prod is off');
  const cfg = await (await fetch(B + '/api/config')).json(); assert.equal(cfg.prelaunch, true);
  r = await post('/api/checkout', { plan: 'pro', email: 'p@t.test' }); assert.equal(r.status, 403); assert.equal((await r.json()).prelaunch, true); assert.ok(!Object.values(getDb().accounts).some(a => a.email === 'p@t.test')); ok('pre-launch: /api/checkout refused, no account/pending charge created');
  r = await fetch(B + '/checkout', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'plan=pro&email=p@t.test&lang=he' }); assert.equal(r.status, 403); assert.match(await r.text(), /בקרוב/);
  r = await txt(`/billing/return?Valid=1&Token=t&Identifier=${encodeURIComponent(ident)}`); assert.equal(r.s, 403); assert.match(r.t, /Coming soon|בקרוב/);
  r = await fetch(B + '/mock-checkout?account=a.b', { redirect: 'manual' }); assert.match(r.headers.get('location'), /\/checkout$/); ok('pre-launch: form checkout, mock payment page and billing return all blocked');
  r = await post('/api/waitlist', { email: 'W@t.test', lang: 'he', plan: 'pro' }); assert.equal(r.status, 200); await post('/api/waitlist', { email: 'w@t.test' }); assert.equal(getDb().waitlist.length, 1); assert.equal(getDb().waitlist[0].lang, 'he');
  assert.equal((await post('/api/waitlist', { email: 'nope' })).status, 400); ok('waitlist stores email once, validates input, no payment');
  process.env.DISABLE_IP_LIMIT = '1'; j = await (await post('/api/scan', { name: 'Demo Co', category: 'Plumber', city: 'Haifa', email: 'd@t.test' })).json();
  const rep = await (await fetch(`${B}/api/report/${j.reportId}`)).json(); assert.equal(rep.demo, true); ok('pre-launch: reports flagged demo:true');
  const ck = fs.readFileSync('web/components/Checkout.tsx', 'utf8'); assert.match(ck, /if \(pre && !\(account && q\.get\("admintest"\) === "1"\)\)/); assert.match(ck, /\/api\/waitlist/); assert.match(fs.readFileSync('web/lib/api.ts', 'utf8'), /j\.scan\.mock \|\| j\.demo/); ok('UI: checkout shows waitlist in pre-launch; report badge uses demo flag');
  delete process.env.PRELAUNCH;
  console.log(`ALL QA TESTS PASSED (${n})`);
} finally { srv.close(); TD.done(); }
