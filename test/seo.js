// SEO: server-rendered legal docs (text in the HTML, canonical/hreflang, ?doc= 301s, COMPLIANCE-NOTES 404), sitemap + llms.txt.
// Needs the static export (`npm run build`); the page-shell checks are skipped with a notice when web/out is missing.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('seo');
delete process.env.PRELAUNCH; delete process.env.NODE_ENV;
const { default: app, LEGAL_DOCS } = await import('../server.js'); const { renderMarkdown } = await import('../src/legal.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const get = (p, h = {}) => fetch(B + p, { redirect: 'manual', headers: h }).then(async r => ({ s: r.status, t: await r.text(), h: r.headers }));
const words = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
const BUILT = fs.existsSync('web/out/he/legal/terms.html'); if (!BUILT) console.log('  ! web/out not built: skipping page-shell checks (run npm run build)');
try {
  // markdown renderer: escapes everything, no raw HTML or javascript: links
  { const h = renderMarkdown('# T <script>x</script>\n\n[a](javascript:alert(1)) [ok](https://x.test/a?b=1&c=2) **b** *i*\n\n- one\n- two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n'); assert.ok(!/<script/.test(h)); assert.ok(!/href="javascript/.test(h));
    assert.match(h, /<h1>T &lt;script&gt;/); assert.match(h, /<a href="https:\/\/x\.test\/a\?b=1&amp;c=2"/); assert.match(h, /<strong>b<\/strong> <em>i<\/em>/); assert.match(h, /<ul><li>one<\/li><li>two<\/li><\/ul>/); assert.match(h, /<table><thead><tr><th>A<\/th><th>B<\/th>/); ok('markdown renderer escapes HTML, blocks javascript: links, renders headings/lists/tables'); }
  if (BUILT) for (const lang of ['en', 'he']) for (const d of LEGAL_DOCS) {
    const url = `https://askranky.com/${lang}/legal/${d}`; const r = await get(`/${lang}/legal/${d}`, { 'user-agent': 'GPTBot' }); assert.equal(r.s, 200, url); const h = r.t;
    assert.ok(words(h) > 200, `${url} only ${words(h)} words`); assert.ok(!h.includes('<!--LEGAL_BODY-->'), 'marker replaced'); assert.ok(!/\{\{[A-Z_]+\}\}/.test(h), 'no raw placeholders');
    assert.match(h, new RegExp(`<link rel="canonical" href="${url}"/>`)); assert.match(h, new RegExp(`hrefLang="he" href="https://askranky.com/he/legal/${d}"`)); assert.match(h, new RegExp(`hrefLang="en" href="https://askranky.com/en/legal/${d}"`)); assert.match(h, new RegExp(`hrefLang="x-default" href="https://askranky.com/en/legal/${d}"`));
    assert.ok(!/name="robots"/.test(h) && !r.h.get('x-robots-tag'), 'indexable'); assert.match(h, /<title>[^<]+ · Ranky<\/title>/); assert.match(h, /<meta name="description" content="[^"]{40,}"/); assert.match(h, new RegExp(`<html lang="${lang}" dir="${lang === 'he' ? 'rtl' : 'ltr'}"`));
    assert.match(h, /<article[^>]*data-legal-doc/); assert.match(h, /<h1>/); }
  if (BUILT) ok(`all ${LEGAL_DOCS.length} docs × he/en: 200, full text in HTML (>200 words), unique title/description, self-canonical, he/en/x-default alternates, no noindex, correct lang/dir`);
  if (BUILT) { const he = (await get('/he/legal/terms')).t, en = (await get('/en/legal/terms')).t; assert.match(he, /<article[^>]*dir="rtl"[^>]*>\s*<h1>[^<]*[\u0590-\u05FF]/); assert.ok(he.includes('322713082')); assert.notEqual(he.match(/<title>[^<]*/)[0], en.match(/<title>[^<]*/)[0]); ok('Hebrew doc is Hebrew RTL with the seller number; titles differ per language'); }
  // index page
  if (BUILT) { const r = await get('/en/legal'); assert.equal(r.s, 200); for (const d of LEGAL_DOCS) { assert.ok(r.t.includes(`href="/en/legal/${d}"`), d); } assert.match(r.t, /rel="canonical" href="https:\/\/askranky\.com\/en\/legal"/); ok('/en/legal index lists a link to each doc'); }
  // old URLs
  for (const d of LEGAL_DOCS) for (const l of ['he', 'en']) { const r = await get(`/${l}/legal?doc=${d}`); assert.equal(r.s, 301, d); assert.equal(r.h.get('location'), `/${l}/legal/${d}`); }
  assert.equal((await get('/he/legal?doc=nope')).h.get('location'), '/he/legal'); assert.equal((await get('/en/legal?doc=COMPLIANCE-NOTES')).s, 301); assert.equal((await get('/en/legal?doc=COMPLIANCE-NOTES')).h.get('location'), '/en/legal');
  { const r = await get('/legal/he/terms'); assert.equal(r.s, 301); assert.equal(r.h.get('location'), '/he/legal/terms'); const r2 = await get('/legal/privacy', { 'accept-language': 'he-IL' }); assert.equal(r2.h.get('location'), '/he/legal/privacy'); const r3 = await get('/legal/privacy', { cookie: 'ranky_lang=en', 'accept-language': 'he' }); assert.equal(r3.h.get('location'), '/en/legal/privacy'); }
  ok('old /{lang}/legal?doc=… and /legal/{doc} short links redirect to /{lang}/legal/{doc} (301; language-less short links follow preference)');
  // internal notes are never served and never redirected into a 200
  for (const p of ['/legal/COMPLIANCE-NOTES', '/legal/he/COMPLIANCE-NOTES', '/he/legal/COMPLIANCE-NOTES', '/en/legal/COMPLIANCE-NOTES', '/en/legal/compliance-notes', '/en/legal/..%2Fpackage', '/en/legal/terms.he', '/en/legal/constructor', '/en/legal/__proto__']) assert.equal((await get(p)).s, 404, p);
  assert.ok(!/COMPLIANCE/i.test((await get('/en/legal')).t)); ok('COMPLIANCE-NOTES and anything off the whitelist → explicit 404, never listed');
  // sitemap + llms.txt
  { const sm = (await get('/sitemap.xml')).t; assert.ok(!sm.includes('doc='), 'no ?doc= in sitemap'); assert.ok(!sm.includes('COMPLIANCE'));
    for (const d of LEGAL_DOCS) for (const l of ['he', 'en']) { assert.ok(sm.includes(`<loc>https://askranky.com/${l}/legal/${d}</loc>`), `${l}/${d}`); assert.ok(sm.includes(`hreflang="${l === 'he' ? 'en' : 'he'}" href="https://askranky.com/${l === 'he' ? 'en' : 'he'}/legal/${d}"`)); }
    assert.ok(sm.includes('<loc>https://askranky.com/en/legal</loc>')); const llms = (await get('/llms.txt')).t; assert.ok(!llms.includes('doc=')); for (const d of LEGAL_DOCS) for (const l of ['he', 'en']) assert.ok(llms.includes(`(https://askranky.com/${l}/legal/${d})`), `llms ${l}/${d}`);
    ok('sitemap.xml and llms.txt list the new /{lang}/legal/{doc} URLs (no ?doc=)'); }
  // robots.txt vs noindex: one method per path (never both, so crawlers can read the tag they are meant to obey)
  { const rb = (await get('/robots.txt')).t; const groups = rb.split(/\n\n/).filter(g => g.startsWith('User-agent')); assert.ok(groups.length >= 10);
    const dis = g => g.split('\n').filter(l => l.startsWith('Disallow: ')).map(l => l.slice(10)); const base = dis(groups[0]); assert.deepEqual(base, ['/api/', '/webhooks/']); for (const g of groups) assert.deepEqual(dis(g), base, g.split('\n')[0]);
    const blocked = p => base.some(d => p.startsWith(d)); const hdr = async p => (await get(p)).h.get('x-robots-tag');
    const PRIVATE_HTML = ['/dashboard/abc?key=k', '/he/dashboard/abc', '/en/dashboard', '/login', '/he/login', '/en/login', '/en/checkout', '/he/checkout', '/en/r/abc', '/he/r/abc', '/r/abc', '/billing/return', '/auth/magic?t=x', '/mock-checkout', '/unsubscribe?t=x'];
    for (const p of PRIVATE_HTML) { assert.equal(await hdr(p), 'noindex, nofollow', `noindex header ${p}`); assert.ok(!blocked(p.split('?')[0]), `${p} must be crawlable so the noindex can be read`); }
    for (const p of ['/api/health', '/api/config', '/webhooks/sumit']) { assert.ok(blocked(p), p); assert.equal(await hdr(p), null, `${p} is Disallow-only (never indexable), no noindex`); }
    for (const p of ['/he', '/en', '/en/scan', '/he/scan', '/en/report', '/he/report', '/en/legal', '/en/legal/terms']) { assert.ok(!blocked(p), p); assert.equal(await hdr(p), null, `${p} indexable`); }
    if (BUILT) { for (const p of ['/he/dashboard', '/en/dashboard', '/en/login', '/he/login', '/en/checkout', '/he/checkout']) assert.match((await get(p)).t, /<meta name="robots" content="noindex, nofollow"\/>/, `meta ${p}`);
      for (const p of ['/en/report', '/he/report', '/en/scan', '/he']) assert.ok(!/name="robots"/.test((await get(p)).t), `${p} must not carry a robots meta`); }
    assert.ok(/NOINDEX_PATH/.test(fs.readFileSync('server.js', 'utf8')) && !/Disallow: \/(dashboard|login|checkout|r\/)/.test(rb));
    ok('robots/noindex consistency: private HTML = crawlable + noindex (header; meta on static pages), /api/ + /webhooks/ = Disallow only, public pages indexable'); }
  // security headers, cookies, caching
  { const paths = ['/he', '/en/scan', '/he/legal/terms', '/en/legal', '/robots.txt', '/sitemap.xml', '/llms.txt', '/og-en.png', '/logo.png', '/api/config', '/api/pricing?lang=en', '/he/dashboard', '/nope', '/he/nope', '/r/abc', '/'];
    for (const p of paths) { const r = await get(p); assert.equal(r.h.get('strict-transport-security'), 'max-age=31536000; includeSubDomains', p); assert.ok(!/preload/i.test(r.h.get('strict-transport-security'))); assert.equal(r.h.get('x-content-type-options'), 'nosniff', p); }
    ok('HSTS (max-age=31536000; includeSubDomains, no preload) + X-Content-Type-Options: nosniff on HTML, static, API, 404 and redirect responses');
    const PUBLIC = ['/he', '/en', '/he/scan', '/en/scan', '/en/report', '/he/report', '/en/legal', '/he/legal/privacy', '/en/legal/terms'];
    if (BUILT) for (const p of PUBLIC) { const r = await get(p, { cookie: 'ranky_lang=en', 'accept-language': 'he' }); assert.equal(r.s, 200, p); assert.equal(r.h.get('set-cookie'), null, `${p} must not set a cookie`); assert.ok(!/cookie/i.test(r.h.get('vary') || ''), `${p} must not Vary on Cookie`); assert.match(r.h.get('cache-control'), /public/); assert.match(r.h.get('cache-control'), /s-maxage=\d+/, p); }
    if (BUILT) ok('public pages (/he, /en, scan, sample report, legal index + docs): no Set-Cookie, no Vary: Cookie, cacheable (public, s-maxage)');
    if (BUILT) for (const p of ['/he/dashboard', '/en/login', '/en/checkout', '/he/r/abc']) assert.equal((await get(p)).h.get('set-cookie'), null, p);
    for (const p of ['/', '/r/abc', '/legal/privacy', '/login']) { const r = await get(p); assert.equal(r.s >= 300 && r.s < 400, true, p); assert.match(r.h.get('vary'), /Cookie/); assert.match(r.h.get('vary'), /Accept-Language/); assert.match(r.h.get('cache-control'), /no-store/); }
    assert.equal((await get('/', { cookie: 'ranky_lang=he' })).h.get('location'), '/he'); assert.equal((await get('/', { 'accept-language': 'he-IL,he;q=0.9' })).h.get('location'), '/he'); assert.equal((await get('/', { cookie: 'ranky_lang=en', 'accept-language': 'he' })).h.get('location'), '/en'); assert.equal((await get('/')).h.get('location'), '/en');
    ok('language-less "/" and short links still follow cookie → Accept-Language, and say so (Vary, private/no-store)');
    for (const f of ['/og-en.png', '/og-he.png', '/logo.png']) { const r = await get(f); assert.equal(r.s, 200); assert.equal(r.h.get('cache-control'), 'public, max-age=86400, stale-while-revalidate=604800', f); }
    assert.notEqual((await get('/style.css')).h.get('cache-control'), 'public, max-age=86400, stale-while-revalidate=604800'); ok('OG images + logo: Cache-Control public, max-age=86400, stale-while-revalidate=604800');
    const lang = fs.readFileSync('web/components/LangLink.tsx', 'utf8'); assert.match(lang, /document\.cookie = `ranky_lang=\$\{to\}/); assert.match(lang, /onClick=\{remember\}/); for (const f of ['Nav', 'Footer']) assert.match(fs.readFileSync(`web/components/${f}.tsx`, 'utf8'), /<LangLink /); assert.ok(!/Set-Cookie[^\n]*ranky_lang/.test(fs.readFileSync('server.js', 'utf8')));
    ok('ranky_lang is written only by the explicit language switcher (client), never by the server'); }
  // currency precedence is unaffected by dropping the server-set language cookie (cookie → Hebrew UI → geo → Accept-Language)
  { const cur = async (q, h) => { const j = JSON.parse((await get('/api/pricing' + q, h)).t); return [j.currency, j.source]; };
    assert.deepEqual(await cur('?lang=he', { 'cf-ipcountry': 'US' }), ['ILS', 'locale']); assert.deepEqual(await cur('?lang=en', { 'cf-ipcountry': 'IL' }), ['ILS', 'geo']); assert.deepEqual(await cur('?lang=he', { 'cf-ipcountry': 'IL', cookie: 'ranky_currency=USD' }), ['USD', 'cookie']);
    assert.deepEqual(await cur('', { 'accept-language': 'he-IL' }), ['ILS', 'accept-language']); assert.deepEqual(await cur('', { cookie: 'ranky_lang=he', 'cf-ipcountry': 'US' }), ['ILS', 'locale']); assert.deepEqual(await cur(''), ['USD', 'default']);
    ok('currency precedence intact without a server-set cookie: ranky_currency cookie > Hebrew UI (?lang=he) > geo > Accept-Language > USD'); }
  // footer + client no longer fetches legal text
  { const ft = fs.readFileSync('web/components/Footer.tsx', 'utf8'); assert.ok(!ft.includes('legal?doc=')); assert.match(ft, /\/legal\/\$\{doc\}/); const lg = fs.readFileSync('web/components/Legal.tsx', 'utf8'); assert.ok(!/useEffect|api\(/.test(lg)); ok('footer links to /legal/{doc}; legal components no longer fetch text client-side'); }
  console.log(`ALL SEO TESTS PASSED (${n})`);
} finally { srv.close(); TD.done(); }
