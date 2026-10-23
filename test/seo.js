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
  // footer + client no longer fetches legal text
  { const ft = fs.readFileSync('web/components/Footer.tsx', 'utf8'); assert.ok(!ft.includes('legal?doc=')); assert.match(ft, /\/legal\/\$\{doc\}/); const lg = fs.readFileSync('web/components/Legal.tsx', 'utf8'); assert.ok(!/useEffect|api\(/.test(lg)); ok('footer links to /legal/{doc}; legal components no longer fetch text client-side'); }
  console.log(`ALL SEO TESTS PASSED (${n})`);
} finally { srv.close(); TD.done(); }
