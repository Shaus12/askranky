// Redesign stage 3: /{lang}/pricing static pages (served, public cache, metadata, sitemap), honest comparison table,
// /pricing redirect, short legal URLs (/en/privacy, /he/terms, /privacy ...) -> /{lang}/legal/{doc}, and nav/footer links.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('pricingpage');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'AUTO_RESCAN_ENABLED', 'MONTHLY_DIGEST_ENABLED']) delete process.env[k]; process.env.DISABLE_IP_LIMIT = '1';
const { default: app } = await import('../server.js'); const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
let n = 0; const ok = m => { n++; console.log('  ✓', m); }; const get = (p, h = {}) => fetch(B + p, { redirect: 'manual', headers: h });
try {
  for (const l of ['he', 'en']) { const r = await get(`/${l}/pricing`); assert.equal(r.status, 200); assert.match(r.headers.get('cache-control'), /public/); const h = await r.text();
    assert.ok(h.includes(`<link rel="canonical" href="https://askranky.com/${l}/pricing"/>`)); assert.match(h, l === 'he' ? /<title>מחירים · Ranky/ : /<title>Pricing · Ranky/); assert.ok(!/noindex/.test(h));
    assert.ok(h.includes('data-row="cad"') && !h.includes('data-row="more"')); assert.match(h, l === 'he' ? /עדיין לא פעיל: סריקה חוזרת מהדשבורד/ : /Not live yet: re-scan from the dashboard/);
    assert.ok(!/Perplexity, Claude, Copilot<\/th>/.test(h)); }
  ok('/he/pricing + /en/pricing: 200, public cache, own title + canonical, indexable; comparison table shows cadence and "coming soon" honestly');
  let r = await get('/pricing', { 'accept-language': 'he' }); assert.equal(r.headers.get('location'), '/he/pricing'); ok('/pricing → /{lang}/pricing');
  for (const [p, to] of [['/en/privacy', '/en/legal/privacy'], ['/en/terms', '/en/legal/terms'], ['/he/privacy', '/he/legal/privacy'], ['/he/terms', '/he/legal/terms'], ['/en/refunds', '/en/legal/refunds']]) { r = await get(p); assert.equal(r.status, 301, p); assert.equal(r.headers.get('location'), to); }
  r = await get('/privacy', { 'accept-language': 'en' }); assert.equal(r.headers.get('location'), '/en/legal/privacy'); r = await get('/en/nosuchpage'); assert.equal(r.status, 404); r = await get('/en/scan'); assert.equal(r.status, 200);
  ok('short legal URLs 301 to /{lang}/legal/{doc}; unknown paths still 404; other pages unaffected');
  const sm = await (await get('/sitemap.xml')).text(); assert.ok(sm.includes('<loc>https://askranky.com/he/pricing</loc>') && sm.includes('<loc>https://askranky.com/en/pricing</loc>')); ok('sitemap lists /he/pricing and /en/pricing');
  for (const f of ['web/components/Nav.tsx', 'web/components/Footer.tsx']) { const s = fs.readFileSync(f, 'utf8'); assert.ok(s.includes('${base}/pricing') && !s.includes('${base}#pricing'), f); }
  const home = fs.readFileSync('web/out/en.html', 'utf8'); assert.ok(home.includes('href="/en/pricing"')); ok('header + footer link to /{lang}/pricing');
  console.log(`ALL PRICING PAGE TESTS PASSED (${n})`);
} finally { srv.close(); TD.done(); }
process.exit(0);
