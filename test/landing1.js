// landing-restore-light: /he home is back on the light layout of 3326ff5 (Hero + v3 sections), with only the kept text fixes from landing-redesign-dark.
import assert from 'node:assert/strict'; import fs from 'node:fs'; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const html = fs.readFileSync('web/out/he.html', 'utf8'); const en = fs.readFileSync('web/out/en.html', 'utf8');
const vis = h => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const all = vis(html); const main = vis(html.slice(html.indexOf('class="vx-hero'), html.indexOf('<footer')));
assert.ok(main.length > 2000);
for (const l of [html, en]) { assert.ok(/class="vx-hero hm-hero/.test(l) && l.includes('class="v3-win"') && l.includes('id="scan-form"') && l.includes('id="pricing"') && l.includes('id="faq"')); assert.ok(!/class="lpd|lpd-/.test(l)); }
assert.ok(!fs.existsSync('web/components/HeLanding.tsx') && !fs.existsSync('web/components/landing-dark.css')); ok('he + en: light 3326ff5 layout (hero, demo, scan form, pricing, FAQ); no dark landing component, CSS or classes anywhere');
assert.ok(main.includes('בואו לראות איך העסק שלכם יכול להופיע ב־ChatGPT וב־Gemini.') && main.includes('3 צעדים') && main.includes('בלי מייל ובלי מנוי') && !main.includes('לקוחות מבקשים המלצה')); assert.ok(/<title>Ranky: איך העסק שלכם יכול להופיע/.test(html) && html.includes('3 צעדים מעשיים לעשות היום')); assert.ok(!/מּ|data-engines-soon/.test(html)); ok('he: headline is static text (no rotator, no dangling "מ־")');
assert.ok(!/perplexity|copilot|claude|dentist|שיניים/i.test(all)); assert.ok(en.includes('Not measured yet, coming soon:')); ok('he: no "coming soon" engines line; en keeps it');
assert.ok(!/אוסטין|Austin|מלון ███████|\b33%|25%-33%/.test(main) && html.includes('data-home-sample="placeholder"') && html.includes('id="sample"')); ok('he: invented sample report and Austin block gone; numberless HomeSample kept (#sample anchor on it)');
const bi = html.indexOf('class="hm-blogh"'); const bs = html.lastIndexOf('<section', bi), be = html.indexOf('</section>', bi); const body = vis(html.slice(html.indexOf('class="vx-hero'), bs) + html.slice(be, html.indexOf('<footer'))); assert.ok(!/\bGEO\b|\bAEO\b|Fix-up|60 שניות/.test(body) && main.includes('בערך דקה')); ok('he: no GEO/AEO/Fix-up jargon or "60 שניות" in the home body (blog article titles excluded); "בערך דקה"');
assert.ok(!/how-we-score/.test(html)); ok('he: no link to /he/how-we-score');
const src = [...html.matchAll(/<a [^>]*data-source[^>]*>/g)].map(m => m[0]); assert.equal(src.length, 3);
for (const a of src) { assert.match(a, /href="https:\/\/www\.(brightlocal\.com\/research\/lcrs-ai-trust\/|theverge\.com\/ai-artificial-intelligence\/1002265\/)/); assert.match(a, /rel="noopener noreferrer nofollow"/); assert.match(a, /target="_blank"/); }
assert.ok(main.includes('45%') && main.includes('31%') && main.includes('נתונים מארה"ב, עם מקור') && main.includes('הנתונים נאספו בארה"ב')); assert.ok(!/testimonial|לקוחות מרוצים/i.test(main)); ok('he: sourced US proof in the #data band, source links with rel/target');
const fsec = html.slice(html.indexOf('data-note="founder"'), html.indexOf('id="faq"')); const fvis = vis(fsec);
assert.ok(fvis.includes('בניתי את Ranky כי ראיתי שאנשים שואלים את ChatGPT על עסקים, ובעלי העסקים לא יודעים מה הוא עונה.') && fvis.includes('— שי, בת ים') && fvis.includes('מי עומד מאחורי Ranky') && !/<img/.test(fsec));
assert.ok(html.indexOf('data-note="founder"') > html.indexOf('id="pricing"')); assert.ok(!en.includes('data-note="founder"')); ok('he: founder note between pricing and FAQ (light card); not on en');
for (const p of ['fixup', 'starter', 'pro', 'agency']) assert.ok(html.includes(`href="/he/checkout?plan=${p}"`), p); assert.ok(html.includes('href="/he/legal/refunds"')); ok('he: checkout + refunds links');
assert.ok(html.includes('name="trade"') && html.includes('name="city"')); const form = fs.readFileSync('web/components/ScanForm.tsx', 'utf8'); for (const e of ['form_submit_attempted', 'turnstile_missing']) assert.ok(form.includes(e)); ok('he: trade + city form and funnel hooks');
assert.ok(/<link rel="canonical" href="https:\/\/askranky.com\/he"/.test(html) && /hreflang="en"/i.test(html) && html.includes('"@type":"FAQPage"')); ok('he: canonical, hreflang, FAQ JSON-LD');
assert.ok(!fs.readFileSync('web/components/Pricing.tsx', 'utf8').match(/<Link[^>]*legal\//)); ok('legal links are plain <a>');
console.log(`ALL LANDING1 TESTS PASSED (${n})`);
