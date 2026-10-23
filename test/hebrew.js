// Hebrew support: question templates, Israeli cities, extraction from Hebrew/RTL answers, full mock-provider scan.
import assert from 'node:assert/strict'; import { useTempData } from './helpers.js';
const T = useTempData('he');
const { analyzeAnswer, extractNamedEntities } = await import('../src/extract.js');
const { buildQuestions, businessLang, TEMPLATES } = await import('../src/questions.js');
const { ISRAELI_CITIES, findCity, localizeCity } = await import('../src/cities.js');
const { mockProvider } = await import('../src/providers/mock.js'); const { runScan } = await import('../src/scan.js'); const store = await import('../src/store.js');
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const biz = { name: 'אינסטלציה אקמה', category: 'אינסטלטור', city: 'תל אביב', website: 'https://acme.co.il' };

assert.equal(TEMPLATES.he.length, TEMPLATES.en.length); assert.equal(businessLang(biz), 'he'); assert.equal(businessLang({ name: 'Acme', category: 'Plumber', city: 'Austin' }), 'en');
const qs = buildQuestions(biz, 15); assert.equal(qs.length, 15); assert.ok(qs.every(q => /[\u05D0-\u05EA]/.test(q) && !q.includes('{'))); assert.equal(qs[0], 'מי העסקים הטובים ביותר בתחום אינסטלטור בתל אביב-יפו?'); ok('15 Hebrew templates, filled with category + localized city');
assert.equal(buildQuestions({ name: 'Acme', category: 'Plumber', city: 'Haifa', lang: 'he' }, 1)[0], 'מי העסקים הטובים ביותר בתחום Plumber בחיפה?'); ok('lang:"he" forces Hebrew templates; English city name localized to Hebrew');
assert.ok(ISRAELI_CITIES.length >= 40); assert.equal(findCity('Tel Aviv').he, 'תל אביב-יפו'); assert.equal(findCity('באר-שבע').en, 'Beersheba'); assert.equal(localizeCity('Austin, TX', 'he'), 'Austin, TX'); ok(`${ISRAELI_CITIES.length} Israeli cities with he/en lookup + aliases`);

// Hand-written Hebrew answers in the shapes real engines return.
const A1 = '\u200fהנה האינסטלטורים המומלצים בתל אביב:\n\u200f1. **שרברבות הכרמל** – זמינים 24/7\n\u200f2. **אינסטלציה אקמה** – מחירים הוגנים\n\u200f3. **י.ש. צנרת בע"מ**: ותיקים\nלסיכום: מומלץ להשוות הצעות.';
let a = analyzeAnswer({ text: A1, citations: ['https://www.midrag.co.il/x', 'https://acme.co.il/about'] }, biz);
assert.equal(a.mentioned, true); assert.equal(a.rank, 2); assert.deepEqual(a.competitors, ['שרברבות הכרמל', 'י.ש. צנרת בע"מ']); assert.equal(a.ownSiteCited, true); ok('numbered bold list with RLM marks → rank 2, competitors (incl. gershayim), own site');
a = analyzeAnswer({ text: 'א. דוד שירותי צנרת - מהיר\nב. אינסטלציה אַקְמֶה - אמין\nג. Pipe Pros TLV - זול', citations: [] }, biz);
assert.equal(a.rank, 2); assert.deepEqual(a.competitors, ['דוד שירותי צנרת', 'Pipe Pros TLV']); ok('Hebrew-letter numbering, " - " separator, niqqud stripped, mixed LTR name');
a = analyzeAnswer({ text: 'מומלץ לפנות לאינסטלציה אקמה, שנחשבת לאחת הטובות בעיר.', citations: [] }, biz);
assert.equal(a.mentioned, true); assert.equal(a.rank, null); ok('prose mention with Hebrew prefix letter ("לאינסטלציה") detected, no rank');
a = analyzeAnswer({ text: '1. **שרברבות הכרמל**\n2. **צנרת הצפון**', citations: [] }, biz);
assert.equal(a.mentioned, false); assert.equal(a.rank, null); assert.equal(a.competitors.length, 2); ok('absent business → not mentioned');
assert.deepEqual(extractNamedEntities('הנה: כמה אפשרויות\n- טיפ: תבדקו ביקורות\n- **מוסך אבי**'), ['מוסך אבי']); ok('Hebrew stop words ("טיפ") not treated as businesses');
a = analyzeAnswer({ text: '1. **Bright Plumber** – good\n2. **Acme Plumbing** – great', citations: [] }, { name: 'Acme Plumbing' }); assert.equal(a.rank, 2); ok('English extraction unchanged');

// Mock provider answers in Hebrew for Hebrew businesses, and the full pipeline scores them.
const ans = await mockProvider('gemini').ask(qs[0], { business: biz }); assert.ok(ans.text.includes('\u200f') && /\.co\.il|google|facebook/.test(ans.citations.join()));
const acct = { id: 'he1', plan: 'starter', usage: {} }; const scan = await runScan(acct, { id: 'b1', ...biz });
assert.equal(scan.results.length, 45); assert.ok(scan.results.every(r => /[\u05D0-\u05EA]/.test(r.question)));
assert.ok(scan.summary.mentionRate > 0, 'mock mentions the business'); assert.ok(scan.results.filter(r => r.rank).length > 0); assert.ok(scan.summary.topCompetitors.every(c => /[\u05D0-\u05EA]/.test(c.name)));
ok(`full mock scan in Hebrew: score ${scan.summary.score}, mention ${scan.summary.mentionRate}, competitors ${scan.summary.topCompetitors.map(c => c.name).join(' / ')}`);
await store.flush(); T.done(); console.log(`ALL ${n} HEBREW TESTS PASSED`);
