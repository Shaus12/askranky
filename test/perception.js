// Sentiment ("How AI talks about you") and fact check ("What AI gets wrong"): rule-based, English + Hebrew, quotes kept, no extra engine calls.
import assert from 'node:assert/strict';
const { sentimentFor, summarizeSentiment, aboutSentences } = await import('../src/sentiment.js');
const { factCheck, summarizeFacts } = await import('../src/factcheck.js');
const { summarizeResults } = await import('../src/summary.js');
const { sentimentTrend, latestFacts, dashboardCsv } = await import('../src/dashboard.js');
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const en = { name: 'Sample Dental', city: 'Holon', website: 'https://sample-dental.co.il', category: 'Dentist' };
const he = { name: 'שן לדוגמה', city: 'חולון', website: '', category: 'רופא שיניים' };

// sentiment
assert.equal(sentimentFor('1. **Clinic A** – great.', en, false), null); ok('no sentiment when the business is not mentioned');
let s = sentimentFor('Options:\n1. **Clinic A** – excellent and friendly.\n2. **Sample Dental** – highly recommended, friendly staff.', en, true);
assert.equal(s.tone, 'positive'); assert.equal(s.phrases.length, 1); assert.ok(s.phrases[0].text.startsWith('Sample Dental')); assert.ok(s.phrases[0].cues.includes('highly recommended')); ok('only sentences that name the business are scored; cue words are kept');
assert.equal(sentimentFor('1. **Sample Dental** – not recommended, many complaints.', en, true).tone, 'negative'); ok('negation: "not recommended" counts as negative');
assert.equal(sentimentFor('1. **Sample Dental** – no complaints so far.', en, true).tone, 'positive'); ok('negation: "no complaints" counts as positive');
assert.equal(sentimentFor('Sample Dental is great but some reviews mention long wait times.', en, true).tone, 'mixed'); ok('praise + criticism in one sentence = mixed');
assert.equal(sentimentFor('1. **Sample Dental** – a dental clinic on Main Street.', en, true).tone, 'neutral'); ok('no cue words = neutral');
assert.equal(sentimentFor('‏1. **שן לדוגמה** – לא מומלץ, יש תלונות.', he, true).tone, 'negative'); assert.equal(sentimentFor('‏1. **שן לדוגמה** – מומלצת ומקצועית.', he, true).tone, 'positive'); ok('Hebrew cues, prefixes and "לא" negation');
assert.equal(sentimentFor('‏1. **שן לדוגמה** – מקום יקר לליבי, צוות יקר.', he, true).tone, 'neutral'); assert.equal(sentimentFor('‏1. **שן לדוגמה** – יקר מדי.', he, true).tone, 'negative'); ok('Hebrew: "יקר" (dear) is not negative, "יקר מדי" is');
assert.ok(aboutSentences('Sample Dental (sample-dental.co.il) is open.', en).length === 1); ok('prose mention counts as a sentence about the business');

// fact check
assert.deepEqual(factCheck('1. **Sample Dental** – located in Bat Yam.', en, false), []); ok('no fact check when not mentioned');
let f = factCheck('1. **Sample Dental** – located in Bat Yam, call 03-555-1234, open from 8:00 am. Visit sampledental.com.', en, true);
const by = t => f.find(x => x.type === t);
assert.equal(by('city').status, 'conflict'); assert.equal(by('city').said, 'Bat Yam'); assert.equal(by('city').expected, 'Holon');
assert.equal(by('website').status, 'conflict'); assert.equal(by('website').said, 'sampledental.com');
assert.equal(by('phone').status, 'check'); assert.equal(by('hours').status, 'check'); ok('wrong city + wrong website = conflicts; phone + hours = please check');
f = factCheck('1. **Sample Dental** – a favourite in Holon, see sample-dental.co.il or yelp.com.', en, true);
assert.ok(f.every(x => x.status === 'match')); assert.ok(!f.some(x => x.said === 'yelp.com')); ok('matching city/website are confirmations; directories are ignored');
assert.equal(factCheck('1. **שן לדוגמה** – נסגרה לצמיתות, בתל אביב.', he, true).filter(x => x.status === 'conflict').map(x => x.type).sort().join(), 'city,status'); ok('Hebrew: "נסגרה לצמיתות" and a different city (תל אביב) are conflicts');
assert.equal(factCheck('1. **Sample Dental** – in Austin, open late.', { name: 'Sample Dental', city: 'Austin, TX' }, true).find(x => x.type === 'city').status, 'match'); ok('non-Israeli city ("Austin, TX") matches its first part');

// roll-ups
const rs = [
  { engine: 'chatgpt', question: 'q1', mentioned: true, competitors: [], citations: [], sentiment: { tone: 'negative', phrases: [{ text: 'A', tone: 'negative', cues: ['slow'] }] }, facts: [{ type: 'city', status: 'conflict', said: 'Bat Yam', expected: 'Holon', quote: 'x' }] },
  { engine: 'gemini', question: 'q1', mentioned: true, competitors: [], citations: [], sentiment: { tone: 'positive', phrases: [{ text: 'B', tone: 'positive', cues: ['great'] }] }, facts: [{ type: 'city', status: 'conflict', said: 'bat yam', expected: 'Holon', quote: 'y' }, { type: 'city', status: 'match', said: 'Holon', quote: 'z' }] },
  { engine: 'gemini', question: 'q2', mentioned: false, competitors: [], citations: [] },
];
const ss = summarizeSentiment(rs, ['chatgpt', 'gemini']); assert.equal(ss.answers, 2); assert.equal(ss.net, 0); assert.equal(ss.examples[0].tone, 'negative'); assert.equal(ss.byEngine.gemini.positive, 1); ok('sentiment roll-up: counts, per engine, net, worst example first');
const fs2 = summarizeFacts(rs); assert.equal(fs2.conflicts.length, 1); assert.equal(fs2.conflicts[0].count, 2); assert.deepEqual(fs2.conflicts[0].engines, ['chatgpt', 'gemini']); assert.equal(fs2.matches, 1); ok('fact roll-up: duplicates merged across engines, matches counted');
const sum = summarizeResults(rs, { plan: { competitors: 3 }, engines: ['chatgpt', 'gemini'] }); assert.ok(sum.sentiment && sum.facts); ok('scan summary carries sentiment + facts');
const old = summarizeResults(rs.map(({ sentiment, facts, ...r }) => r), { plan: { competitors: 3 }, engines: ['chatgpt'] }); assert.ok(!('sentiment' in old) && !('facts' in old)); ok('older scans without the fields get no invented sentiment or facts');

// "closed": only explicit permanent-closure phrases
const st = (t, b) => factCheck(t, b, true).some(x => x.type === 'status');
for (const t of ['1. **Sample Dental** – permanently closed.', '1. **Sample Dental** – went out of business in 2024.', '1. **Sample Dental** – no longer in business.', '1. **Sample Dental** has closed down for good.']) assert.ok(st(t, en), t);
for (const t of ['1. **שן לדוגמה** – נסגר לצמיתות.', '1. **שן לדוגמה** – העסק נסגר בשנה שעברה.', '1. **שן לדוגמה** – נסגרה סופית.']) assert.ok(st(t, he), t);
ok('closed: explicit permanent-closure phrases (EN + HE) are flagged');
for (const t of ['1. **Sample Dental** – closes at 8 pm, temporarily closed for renovation.', '1. **Sample Dental** – the old branch shut down, the Holon clinic is open.', '1. **Sample Dental** – closed on Saturdays.']) assert.ok(!st(t, en), t);
for (const t of ['1. **שן לדוגמה** – נסגר ב־20:00.', '1. **שן לדוגמה** – נסגרת בשבת, העסק סגור בחגים.', '1. **שן לדוגמה** – נסגר מוקדם בימי שישי.']) assert.ok(!st(t, he), t);
ok('closed: opening hours / temporary closures ("נסגר ב־20:00", "temporarily closed", "shut down") are not flagged');
// dashboard + CSV
const scan = { id: 's1', at: '2026-10-20T10:00:00Z', businessId: 'b', summary: sum, results: rs };
assert.equal(sentimentTrend([scan])[0].net, 0); assert.equal(latestFacts([scan]).conflicts.length, 1); ok('dashboard: sentiment per scan + latest fact flags');
const csv = dashboardCsv({ scans: { s1: scan } }, { id: 'b', scanIds: ['s1'] }); assert.ok(csv.split('\r\n')[0].endsWith(',sentiment,fact_flags')); assert.ok(csv.includes('negative,conflict:city:Bat Yam')); ok('CSV export adds sentiment and fact_flags columns');
console.log(`ALL PERCEPTION TESTS PASSED (${n})`);
