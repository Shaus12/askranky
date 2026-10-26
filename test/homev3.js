// v3 home (Profound-style sections): agent demo, jobs tabs, context bento, feature grid, dashboard preview.
// Guards the honesty rules: every mock is labelled as an illustration/example, live engines only, no weekly-report claim, no testimonials.
import assert from 'node:assert/strict'; import fs from 'node:fs'; let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const copy = fs.readFileSync('web/lib/home-v3.ts', 'utf8').replace(/^\s*\/\/.*$/gm, '');
assert.ok(!/perplexity|copilot|claude/i.test(copy)); ok('copy names only the live engines (ChatGPT, Gemini)');
assert.ok(!/weekly|every week|מעקב שבועי|שבועי/i.test(copy)); ok('copy makes no weekly-report claim');
assert.ok(!/testimonial|\bour customers|הלקוחות שלנו|[$₪]/i.test(copy)); ok('copy has no testimonials, customer claims or prices');
for (const l of ['he', 'en']) {
  const html = fs.readFileSync(`web/out/${l}.html`, 'utf8');
  const demo = html.slice(html.indexOf('class="v3-win"'), html.indexOf('id="v3-demo-cap"') + 400);
  assert.ok(demo.includes(l === 'he' ? 'המחשה · עסק פיקטיבי' : 'Illustration · fictional business')); ok(`${l}: hero demo is labelled as an illustration`);
  assert.equal((demo.match(/data-demo-project=/g) || []).length, 3); assert.match(demo, /aria-pressed="true"/); ok(`${l}: demo renders 3 Recents projects as toggle buttons`);
  assert.equal((html.match(/role="tab"/g) || []).length, 6); assert.equal((html.match(/role="tabpanel"/g) || []).length, 6); assert.equal((html.match(/aria-selected="true"/g) || []).length, 1); ok(`${l}: jobs section has 6 tabs + 6 server-rendered panels, one selected`);
  for (const id of ['v3-ctx-t', 'v3-feat-t', 'v3-cc-t']) assert.ok(html.includes(`id="${id}"`)); ok(`${l}: bento, feature grid and dashboard preview sections render`);
  const cc = html.slice(html.indexOf('id="v3-cc-t"'), html.indexOf('id="scan-form"'));
  assert.ok(cc.includes(l === 'he' ? 'המחשה עם מספרים לדוגמה' : 'illustration with example numbers')); ok(`${l}: dashboard preview says it is an illustration with example numbers`);
  assert.ok(html.indexOf('id="v3-cc-t"') < html.indexOf('id="sample"')); ok(`${l}: new sections sit before the sample report (sample → pricing block unchanged)`);
}
console.log(`ALL HOME V3 TESTS PASSED (${n})`);
