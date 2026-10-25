// Home page growth funnel: prominent free-scan CTAs (hero, sample card, floating) and a clearly labelled, name-masked sample report.
import assert from 'node:assert/strict'; import fs from 'node:fs'; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const src = fs.readFileSync('web/lib/sample-home.ts', 'utf8');
for (const l of ['he', 'en']) {
  const html = fs.readFileSync(`web/out/${l}.html`, 'utf8'); const sec = html.slice(html.indexOf('id="sample"'), html.indexOf('id="pricing"')); assert.ok(sec.length > 500);
  assert.ok(sec.includes(l === 'he' ? 'דוגמה לדוח' : 'Sample report') && sec.includes('data-sample-badge')); ok(`${l}: sample section carries the "Sample report / דוגמה לדוח" badge`);
  assert.ok(sec.includes(l === 'he' ? 'מלון ███████' : 'H█████ Hotel')); assert.ok(sec.includes(l === 'he' ? 'לא לקוח אמיתי ולא סריקה אמיתית' : 'not a real customer or a real scan')); ok(`${l}: business name masked + "example data, not a real customer" note`);
  assert.ok(sec.includes('ChatGPT') && sec.includes('Gemini') && !/perplexity/i.test(sec)); assert.ok(!/[$₪]|\bUSD\b|testimonial|לקוחות שלנו|our customers/i.test(sec)); ok(`${l}: only ChatGPT + Gemini, no prices, no testimonials / customer claims`);
  assert.ok((sec.match(/<li/g) || []).length >= 6, 'competitors + 3 fixes'); ok(`${l}: score, engine rows, 3 competitors and 3 fixes rendered`);
  for (const c of ['hero', 'sample', 'sticky']) assert.match(html, new RegExp(`href="/${l}/scan"[^>]*data-cta="${c}"|data-cta="${c}"[^>]*href="/${l}/scan"`)); ok(`${l}: free-scan CTAs (hero, sample, floating) link to /${l}/scan`);
}
assert.ok(!/perplexity|\$|₪/i.test(src.replace(/\/\/.*$/gm, ''))); ok('sample data file: no Perplexity, no prices');
const sm = fs.readFileSync('src/seo.js', 'utf8'); assert.ok(!/['"`]\/report['"`]|\/\$\{l\}\/report|\/(he|en)\/report/.test(sm.replace(/\/\/.*$/gm, ''))); ok('sitemap code does not list /report');
console.log(`ALL GROWTH HOME TESTS PASSED (${n})`);
