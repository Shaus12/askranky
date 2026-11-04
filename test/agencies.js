// /{lang}/agencies: informational agency/partner page. Served + indexable, numbers match src/plans.js, contact path,
// manual/no-white-label statement, no banned framing or claims, and the draft's [TO VERIFY] items are not shown.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('agencies');
process.env.DISABLE_IP_LIMIT = '1';
const { PLANS, PRODUCTS } = await import('../src/plans.js');
const { default: app } = await import('../server.js'); const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const agencyLd = l => { const h = fs.readFileSync(`web/out/${l}/agencies.html`, 'utf8'); return (h.match(/application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g) || []).join(''); };
const vis = h => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
try {
  const A = PLANS.agency; assert.equal(A.prices.ILS, 549);
  const lib = fs.readFileSync('web/lib/agencies.ts', 'utf8'); const m = /AGENCY = \{ price: PRICES\.agency\.ILS, businesses: (\d+), questions: (\d+), competitors: (\d+), fixup: (\d+) \}/.exec(lib); assert.ok(m);
  assert.deepEqual(m.slice(1).map(Number), [A.businesses, A.questionsPerBusiness, A.competitors, PRODUCTS.fixup.prices.ILS]); assert.equal(A.cadence, 'weekly');
  ok('agency numbers on the page equal src/plans.js (₪549, 10 businesses, 20 questions, 5 competitors, weekly; Fix-up ₪390)');
  for (const l of ['he', 'en']) {
    assert.ok(fs.existsSync(`web/out/${l}/agencies.html`), l);
    const r = await fetch(`${B}/${l}/agencies`); assert.equal(r.status, 200); assert.match(r.headers.get('cache-control'), /public/); const h = await r.text(); const v = vis(h.slice(h.indexOf('<main'), h.indexOf('</main>')));
    assert.ok(h.includes(`<link rel="canonical" href="https://askranky.com/${l}/agencies"/>`) && !/noindex/.test(h) && h.includes('hrefLang="he" href="https://askranky.com/he/agencies"'));
    assert.ok(h.includes('"@type":"FAQPage"'));
    assert.ok(v.includes('₪549')); assert.ok(!/\$149|₪190|190|₪290|290 ₪|₪100\b|100 ₪|12 חודשים|12 months/.test(v));
    assert.ok(l === 'he' ? /הפיילוט חינם/.test(v) && /עמלה של 30%/.test(v) : /The pilot is free/.test(v) && /30% commission/.test(v), 'pilot free + 30%');
    assert.ok(l === 'he' ? /מופק ידנית/.test(v) && /אין עדיין white-label אוטומטי/.test(v) : /prepared manually/.test(v) && /no automatic white-label yet/.test(v));
    assert.ok(/href="mailto:shaysho1111@gmail.com\?subject=/.test(h) && h.includes(`href="/${l}/scan"`));
    assert.ok(!/dentist|dental|שיניים|Perplexity|Copilot|Claude/i.test(v), 'banned words');
    assert.ok(!/שוטשווילי|Shotashvili|(?<![א-ת])שי |Shai|מייסד|Founder|TO VERIFY|refund|החזר|Fix-up סיטונאי|wholesale/i.test(v), 'TO VERIFY items');
    assert.ok(l === 'he' ? v.includes('סריקה חוזרת מהדשבורד, במסגרת תקציב בדיקות חודשי') && !/שבוע/.test(v) : v.includes('Re-scan from the dashboard within a monthly check budget') && !/\bweekly\b|every week|automatic weekly/i.test(v), 'dashboard rescan frequency, no weekly claims');
    assert.ok(!/data-autosoon/.test(h) && !/soon:/.test(fs.readFileSync('web/lib/agencies.ts', 'utf8')), 'no autosoon coming-soon note');
    assert.ok(l === 'he' ? v.includes('התשובות משתנות בין הרצות, לכן אנחנו סורקים מחדש ומציגים את המגמה') : v.includes('Answers vary between runs, so we re-scan and show the trend'), 'disclaimer');
    assert.ok(!/weekly|שבוע/i.test(JSON.stringify(agencyLd(l))), 'FAQ JSON-LD');
    assert.ok(l === 'he' ? /ידנית/.test(v.slice(v.indexOf('פיילוט'))) : /by hand/.test(v), 'pilot re-check by hand');
    ok(`/${l}/agencies: Growth dashboard-budget frequency, no weekly/autosoon, disclaimer + pilot by hand`);
    ok(`/${l}/agencies: built + served 200, canonical/hreflang, indexable, FAQPage, ₪549, manual/no-white-label, mailto + scan CTA, pilot free + 30%, no ₪190/₪100/₪290/founder, no banned or unverified items`);
  }
  const sm = await (await fetch(B + '/sitemap.xml')).text(); assert.ok(sm.includes('/he/agencies</loc>') && sm.includes('/en/agencies</loc>'));
  assert.ok(fs.readFileSync('web/out/en.html', 'utf8').includes('href="/en/agencies"')); ok('sitemap + footer link');
  console.log(`ALL AGENCIES TESTS PASSED (${n})`);
} finally { srv.close(); TD.done(); }
process.exit(0);
