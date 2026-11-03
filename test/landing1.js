// landing-redesign-dark: /he homepage in plain Hebrew + dark style (copy: marketing/landing-page-copy-20261103.md).
// Guards: new copy present, banned words absent, no jargon, no invented numbers, sourced proof with rel attributes, checkout links, form hooks kept.
import assert from 'node:assert/strict'; import fs from 'node:fs'; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const html = fs.readFileSync('web/out/he.html', 'utf8'); const en = fs.readFileSync('web/out/en.html', 'utf8');
const vis = h => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const all = vis(html); const main = vis(html.slice(html.indexOf('class="lpd"'), html.indexOf('<footer')));
assert.ok(main.length > 2000);
for (const s of ['שואלים את ChatGPT על עסק כמו שלכם. האם הוא ממליץ עליכם?', 'אנחנו בודקים אם אתם ביניהם, ומי מופיע במקומכם', 'בדקו את העסק שלי בחינם', 'בחינם · בערך דקה · בלי כרטיס אשראי',
  'כותבים מה העסק ואיפה.', 'אנחנו שואלים את ChatGPT ו-Gemini', 'מקבלים תשובה ברורה:', 'מתחילים בבדיקה חינם. משלמים רק אם רוצים שנמשיך לבדוק בשבילכם.', 'בדיקה חינם: האם ChatGPT ו-Gemini ממליצים עליכם?', 'מה אנחנו לא מבטיחים'])
  assert.ok(main.includes(s), s);
ok('he: headline, subhead, CTA, 3 steps, pricing intro, form title and honesty block present');
assert.equal((html.match(/<details[^>]*class="lpd-card lpd-q"/g) || []).length, 8); for (const q of ['מה זה בעצם?', 'אילו מנועים נבדקים?', 'אתם מבטיחים שאופיע?', 'אפשר לבטל?']) assert.ok(main.includes(q));
const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema.org","@type":"FAQPage"[\s\S]*?)<\/script>/)[1]); assert.equal(ld.mainEntity.length, 8); assert.equal(ld.mainEntity[0].name, 'מה זה בעצם?');
ok('he: 8-question FAQ rendered and the FAQPage JSON-LD matches it');
assert.ok(!/dentist|שיניים|perplexity|copilot|claude/i.test(all)); ok('he: no dentist / Perplexity / Copilot / Claude anywhere on the page (no "coming soon" line)');
assert.ok(!/\bGEO\b|\bAEO\b|Fix-up|סריקת AI|ציון נראות/.test(main)); ok('he: no GEO / AEO / Fix-up / "סריקת AI" jargon in the page body (blog titles in the nav menu are article titles, kept)');
assert.ok(!/how-we-score/.test(html)); ok('he: no link to /he/how-we-score (404 live)');
assert.ok(!/אוסטין|Austin|מלון ███████|data-sample-badge="?example|\b34\b|33%|25%/.test(main)); assert.ok(main.includes('data-home-sample') || html.includes('data-home-sample="placeholder"'));
ok('he: invented sample numbers and the Austin data block are gone; numberless HomeSample kept');
assert.ok(!/מּ|מ־ ChatGPT|EngineRotator|data-engines-soon/.test(html)); assert.ok(!/class="hm-h1/.test(html)); ok('he: old rotating headline (dangling "מ־") removed');
const src = [...html.matchAll(/<a [^>]*data-source[^>]*>/g)].map(m => m[0]); assert.equal(src.length, 3);
for (const a of src) { assert.match(a, /href="https:\/\/www\.(brightlocal\.com\/research\/lcrs-ai-trust\/|theverge\.com\/ai-artificial-intelligence\/1002265\/)/); assert.match(a, /rel="noopener noreferrer nofollow"/); assert.match(a, /target="_blank"/); }
assert.ok(main.includes('45%') && main.includes('31%') && main.includes('נתונים מארה"ב, עם מקור') && main.includes('הנתונים נאספו בארה"ב')); assert.ok(!/openai\.com/.test(html)); assert.ok(!/testimonial|ממליצים עלינו|לקוחות מרוצים|\+500|500\+/i.test(main));
ok('he: 3 proof items labelled as US data, visible source links (BrightLocal, The Verge) with rel/target, no logos, no testimonials');
for (const p of ['fixup', 'starter', 'pro', 'agency']) assert.ok(html.includes(`href="/he/checkout?plan=${p}"`), p); assert.ok(html.includes('href="/he/legal/refunds"'));
for (const s of ['₪79', '₪179', '₪549', '₪390', 'להתחיל ב-₪79', 'לחבילת הסוכנויות', 'להזמין תיקון']) assert.ok(main.includes(s), s);
ok('he: pricing buttons link to the working checkout (fixup, starter, pro, agency) + refund policy');
assert.ok(html.includes('id="scan-form"') && html.includes('name="trade"') && html.includes('name="city"')); const form = fs.readFileSync('web/components/ScanForm.tsx', 'utf8'); for (const e of ['form_submit_attempted', 'turnstile_missing']) assert.ok(form.includes(e));
ok('he: trade + city scan form on the page, funnel hooks intact');
assert.ok(/<link rel="canonical" href="https:\/\/askranky.com\/he"/.test(html) && /hreflang="en"/i.test(html)); ok('he: canonical + hreflang kept');
const css = fs.readFileSync('web/components/landing-dark.css', 'utf8'); assert.match(css, /prefers-reduced-motion/); assert.match(css, /focus-visible/); assert.ok(!/@import|url\(http/.test(css));
assert.ok(!fs.readFileSync('web/components/HeLanding.tsx', 'utf8').includes('"use client"')); ok('dark style scoped to .lpd, CSS-only aurora, reduced-motion + focus-visible, no external CSS; server component');
assert.ok(en.includes('Not measured yet, coming soon:') && en.includes('class="v3-win"') && !en.includes('class="lpd"')); ok('en: home unchanged (old layout, "coming soon" line kept)');
const fsec = html.slice(html.indexOf('data-note="founder"'), html.indexOf('id="faq"')); const fvis = vis(fsec);
assert.ok(fvis.includes('בניתי את Ranky כי ראיתי שאנשים שואלים את ChatGPT על עסקים, ובעלי העסקים לא יודעים מה הוא עונה.') && fvis.includes('— שי, בת ים')); assert.ok(!/<img/.test(fsec));
assert.ok(html.indexOf('data-note="founder"') > html.indexOf('id="pricing"') && html.indexOf('data-note="founder"') < html.indexOf('id="faq"'));
const NAME = /(^|[\s,—(])שי([\s,.)]|$)|שוטשוילי|Shai|Shotashvili/; assert.ok(!NAME.test(vis(html.slice(html.indexOf('class="lpd"'), html.indexOf('<footer')).replace(fsec, ' '))), 'founder name outside the founder note');
ok('he: founder note with the exact draft text (no photo), between pricing and FAQ; founder name nowhere else in the page body');
assert.ok(!fs.readFileSync('web/components/HeLanding.tsx', 'utf8').match(/<Link[^>]*legal\//)); assert.ok(!fs.readFileSync('web/components/Pricing.tsx', 'utf8').match(/<Link[^>]*legal\//));
ok('legal links are plain <a> (no next/link RSC prefetch of server-rendered legal pages, which 404ed)');
console.log(`ALL LANDING1 TESTS PASSED (${n})`);
