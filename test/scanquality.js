// Scan-quality fixes found in the first real live scan: grammatical questions, no clarifying-question answers,
// parser ignores non-business items, Gemini redirect links never reported as a cited source, progress UI never stalls.
import assert from 'node:assert/strict'; import fs from 'node:fs';
const { buildQuestions, TEMPLATES } = await import('../src/questions.js');
let n = 0; const ok = m => { n++; console.log('  ✓', m); };

// 1. Question templates
{
  assert.equal(TEMPLATES.he.length, 15); assert.equal(TEMPLATES.en.length, 15);
  const jew = buildQuestions({ name: 'מייסון מאנא', category: 'תכשיטים', city: 'Tel Aviv-Yafo' }, 5);
  assert.equal(jew.length, 5);
  assert.equal(jew[0], 'מי העסקים הטובים ביותר בתחום תכשיטים בתל אביב-יפו?'); assert.equal(jew[1], 'תמליץ לי על עסק אמין בתחום תכשיטים בתל אביב-יפו.');
  for (const q of jew) { assert.ok(!/מי התכשיטים|ה\{|\{/.test(q), q); assert.ok(!/(^|\s)ה(תכשיטים|אינסטלטור)\s/.test(q), q); }
  const sing = buildQuestions({ name: 'א', category: 'מספרה', city: 'חיפה' }, 15); assert.ok(sing.every(q => /בתחום מספרה/.test(q) && !q.includes('{'))); assert.ok(sing.every(q => q.includes('בחיפה') || q.includes('באזור חיפה')));
  const latin = buildQuestions({ name: 'א', category: 'מספרה', city: 'Dubai', lang: 'he' }, 15); assert.ok(latin.filter(q => q.includes('ב-Dubai')).length >= 10); assert.ok(latin.every(q => !/בDubai/.test(q)));
  const en = buildQuestions({ name: 'Acme', category: 'Plumbing', city: 'Austin, TX' }, 15); assert.ok(en.every(q => !/Plumbings|\{/.test(q))); assert.equal(buildQuestions({ name: 'a', category: 'Jewelry', city: 'Austin' }, 5).length, 5);
  ok('Hebrew/English question templates are grammatical for any category (plural or singular) and city prefix; still 5 per engine on free');
}
console.log(`ALL SCAN-QUALITY TESTS PASSED (${n})`); process.exit(0);
