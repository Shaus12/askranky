// review1 (honesty + offer): no "Most popular" badge, hero rotates live engines only, paid lists have no "coming soon" items,
// Agency questions >= Pro (config, UI and scan use the same number), hero variant switch (A = real Tel Aviv sample, B = no numbers,
// default B), Fix-up is the first card on pricing with the exact refunds §1A wording, founder block hidden until a real photo.
import assert from 'node:assert/strict'; import fs from 'node:fs';
const ok = m => console.log('ok -', m);
const { PLANS, PRODUCTS } = await import('../src/plans.js');
const i18n = fs.readFileSync('web/lib/i18n.ts', 'utf8'); const pc = fs.readFileSync('web/lib/i18n-pricing.ts', 'utf8');
assert.ok(!/popular|פופולרי/i.test(i18n + fs.readFileSync('web/components/Pricing.tsx', 'utf8'))); ok('no "Most popular" badge');
const hero = fs.readFileSync('web/components/Hero.tsx', 'utf8'); assert.match(hero, /const ENGINES = \[\{ name: "ChatGPT" \}, \{ name: "Gemini" \}\];/); ok('hero rotator: ChatGPT + Gemini only');
const planLines = i18n.split('\n').filter(l => /\{ id: "(starter|pro|agency)", name:/.test(l)); assert.equal(planLines.length, 6);
for (const l of planLines) assert.ok(!/coming soon|בקרוב|digest|סיכום חודשי|Perplexity|Claude|Copilot/i.test(l), l.slice(0, 80)); ok('paid plan lists (he/en) name only what runs today');
assert.ok(!/data-row|k: "more"/.test(pc) || !/k: "more"/.test(pc)); assert.ok(!/coming soon|בקרוב/i.test(pc.replace(/\/\/.*$/gm, ''))); ok('compare table: no "coming soon" engine row or cells');
assert.ok(PLANS.agency.questionsPerBusiness >= PLANS.pro.questionsPerBusiness); assert.equal(PLANS.agency.questionsPerBusiness, 20); assert.equal(PLANS.agency.monthlyCheckBudget, 10 * 20 * 3 * 5);
assert.ok(/"10 businesses", "20 questions each/.test(i18n) && /"10 עסקים", "20 שאלות לכל עסק/.test(i18n)); assert.ok(/"20 each", "20 each"/.test(pc) && /"20 לכל עסק", "20 לכל עסק"/.test(pc));
const scan = fs.readFileSync('src/scan.js', 'utf8'); assert.match(scan, /plan\.questionsPerBusiness/); ok('Agency 20 questions/business in config, UI and the scan pipeline (reads plan.questionsPerBusiness)');
assert.deepEqual(Object.keys(PLANS).map(k => PLANS[k].prices.ILS), [0, 79, 179, 549]); assert.equal(PRODUCTS.fixup.prices.ILS, 390); ok('prices unchanged');
const home = fs.readFileSync('web/lib/home.ts', 'utf8'); assert.match(home, /export const HERO_VARIANT: HeroVariant = "B";/);
const B = home.slice(home.indexOf('  B: {')); assert.ok(!/\d+%|\d+ מתוך|\d+ of \d+/.test(B.slice(0, B.indexOf('} as const')))); assert.match(home, /11 מתוך 12 מרפאות שיניים/); assert.match(home, /1 מתוך 12 מרפאות הוזכרה בשם \(8%\)/); assert.match(home, /לא מחקר/);
const R = '../research/scans/day1-rerun/results-IL-1.md'; if (fs.existsSync(R)) assert.match(fs.readFileSync(R, 'utf8').replace(/\s+/g, ' '), /k_named \| 1 \|.*pct_mentioned_chatgpt \| 8/); ok('hero variant: default B (no numbers); A cites the real Tel Aviv sample (1/12, 8%) as directional');
const ref = fs.readFileSync('legal/refunds.md', 'utf8'); const refHe = fs.readFileSync('legal/refunds.he.md', 'utf8');
const g = [...i18n.matchAll(/guarantee: "(Deliver-or-refund: if we have not[^"]*|מסירה או החזר: אם לא מסרנו את שלושת[^"]*)"/g)].map(m => m[1]); assert.equal(g.length, 2);
assert.ok(ref.includes(g[0].replace('Deliver-or-refund:', '**Deliver-or-refund:**'))); assert.ok(refHe.includes(g[1].replace('מסירה או החזר:', '**מסירה או החזר:**'))); ok('Fix-up guarantee = exact refunds §1A wording (he/en)');
const pr = fs.readFileSync('web/components/Pricing.tsx', 'utf8'); assert.ok(pr.indexOf('data-main-offer') < pr.indexOf('t.pricing.plans.map')); assert.match(pr, /checkout\?plan=fixup/); ok('Fix-up is the first (main) card, same checkout link');
const outDir = 'web/out'; if (fs.existsSync(outDir)) for (const l of ['he', 'en']) { const h = fs.readFileSync(`${outDir}/${l}.html`, 'utf8'); assert.ok(!h.includes('data-founder')); const p = fs.readFileSync(`${outDir}/${l}/pricing.html`, 'utf8'); assert.ok(p.indexOf('data-main-offer') > 0 && p.indexOf('data-main-offer') < p.indexOf('data-plan="starter"')); assert.ok(!/Most popular|הכי פופולרי/.test(p + h)); }
ok('built HTML: founder block hidden, Fix-up above monthly plans, no popular badge');
