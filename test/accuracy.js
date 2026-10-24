// Scan accuracy (Ritz-Carlton Herzliya scanned as "Tel Aviv-Yafo", report KoLtrTpBrKq-): required city + city hint, other names and
// name variants (cross-script skeleton, domain stem), category question sets, and the 0-score notice. All mock: no engine/email calls.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('accuracy');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES']) delete process.env[k];
process.env.DISABLE_IP_LIMIT = '1'; process.env.SCAN_RATE_MAX = '1000'; process.env.UNSUBSCRIBE_SECRET = 'test-unsub-secret-0123456789';
const { cityHint, ISRAELI_CITIES, findCity } = await import('../src/cities.js');
const { nameVariants, parseOtherNames, domainStem, skeleton } = await import('../src/names.js');
const { analyzeAnswer, sameBusiness } = await import('../src/extract.js');
const { buildQuestions, categorySet, SETS, TEMPLATES } = await import('../src/questions.js');
const { zeroNotice, showZeroNotice } = await import('../src/summary.js');
const { renderWeeklyEmail } = await import('../src/email/report.js');
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');

// 1) City
assert.ok(ISRAELI_CITIES.length >= 80); assert.equal(findCity('הרצליה פיתוח').en, 'Herzliya');
assert.equal(cityHint({ name: 'The Ritz-Carlton Herzliya', city: 'תל אביב-יפו' }).en, 'Herzliya');
assert.equal(cityHint({ name: 'ritz carlton', website: 'https://www.ritzcarlton.com/en/hotels/tlvrz-the-ritz-carlton-herzliya/', city: 'תל אביב' }).he, 'הרצליה');
assert.equal(cityHint({ name: 'פיצה בחיפה', city: 'תל אביב' }).en, 'Haifa');
assert.equal(cityHint({ name: 'The Ritz-Carlton Herzliya', city: 'הרצליה' }), null); assert.equal(cityHint({ name: 'The Ritz-Carlton Herzliya', city: 'Herzliya' }), null);
assert.equal(cityHint({ name: 'אינסטלציה אקמה', website: 'https://acme.co.il', city: 'חיפה' }), null); assert.equal(cityHint({ name: 'Acme', city: '' }), null);
ok('city list (he/en, 80 localities + aliases); name/website city hint: "The Ritz-Carlton Herzliya" + Tel Aviv -> Herzliya, none when it matches or nothing hints');
const form = read('../web/components/ScanForm.tsx'), i18n = read('../web/lib/i18n.ts');
assert.ok(/data-city-confirm/.test(form) && /cityHint\(/.test(form) && /a\.cityRequired/.test(form) && /name="otherNames"/.test(form));
assert.ok(!/city: "תל אביב-יפו"/.test(i18n) && !/city: "Austin, TX", email/.test(i18n), 'no value-like city placeholder');
assert.equal(read('../web/lib/city-hint.ts').includes('EXTRA'), true);
ok('form: city required (own message), confirm before submit when the name/website hints another city, optional other-names field; no city placeholder that looks like a default');

// server: missing city -> clear 400; other names stored (capped)
const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
const post = (p, body) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
try {
  for (const city of [undefined, '', '   ', 5]) { const r = await post('/api/scan', { name: 'X', category: 'Hotel', city, email: 'c@t.test', lang: 'he' }); assert.equal(r.status, 400); const j = await r.json(); assert.equal(j.code, 'city_required'); assert.equal(j.error, 'נא להזין את העיר שבה העסק נמצא.'); }
  const en = await (await post('/api/scan', { name: 'X', category: 'Hotel', email: 'c@t.test', lang: 'en' })).json(); assert.equal(en.error, 'Please enter the city where the business is located.');
  const form400 = await fetch(B + '/scan', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=X&category=Hotel&email=c%40t.test' }); assert.equal(form400.status, 400); assert.ok((await form400.text()).includes('Please enter the city'));
  assert.equal(Object.keys(getDb().businesses).length, 0);
  ok('server: missing/blank/non-string city -> 400 {code:"city_required"} (he/en), also on the HTML /scan form; nothing stored, no scan');
  const r = await post('/api/scan', { name: 'The Ritz-Carlton Herzliya', otherNames: 'Ritz Carlton, ריץ קרלטון, <b>x</b>, a, b2, c3, d4, e5', category: 'Hotel', city: 'Herzliya', email: 'r@t.test', lang: 'en' }); assert.equal(r.status, 200);
  const b = Object.values(getDb().businesses)[0]; assert.deepEqual(b.aliases, ['Ritz Carlton', 'ריץ קרלטון', 'bx/b', 'b2', 'c3']); assert.equal(b.city, 'Herzliya');
  assert.deepEqual(parseOtherNames('x'.repeat(100)), ['x'.repeat(60)]); assert.deepEqual(parseOtherNames(''), []);
  ok('other names: comma separated, max 5, 60 chars each, <> stripped, stored as business.aliases and used by the scan');
} finally { srv.close(); }

// 2) Matching
const ritz = { name: 'The Ritz-Carlton Herzliya', website: 'https://www.ritzcarlton.com/en/hotels/tlvrz/', category: 'Hotel', city: 'Herzliya' };
assert.deepEqual(nameVariants(ritz), ['the ritz carlton herzliya', 'ritz carlton herzliya', 'ritz carlton']);
assert.equal(skeleton('ritz carlton'), skeleton('ריץ קרלטון')); assert.equal(domainStem(ritz.website), 'ritzcarlton');
for (const [w, s] of [['https://acme.co.il', null], ['https://www.booking.com/x', null], ['https://dan.co.il', null], ['https://shop.danhotels.com', 'danhotels'], ['acme-plumbing.com', 'acmeplumbing'], ['', null]]) assert.equal(domainStem(w), s, w);
const A = (text, citations = []) => analyzeAnswer({ text, citations }, ritz);
const pos = [
  ['1. **The Norman** – boutique\n2. **Ritz-Carlton Herzliya** – marina views', 2],
  ['1. **ריץ קרלטון הרצליה** – מלון יוקרה במרינה\n2. **דן אכדיה** – על החוף', 1],
  ['1. **מלון דן אכדיה** – חוף\n2. **בריץ קרלטון** יש ספא', null],
  ['The best pick is The Ritz Carlton in the marina.', null],
  ['Look at ritzcarlton.com for rates.', null],
];
for (const [t, rank] of pos) { const a = A(t); assert.equal(a.mentioned, true, t); if (rank) assert.equal(a.rank, rank, t); assert.ok(!a.competitors.some(c => /ritz|ריץ/i.test(c)), t); }
const cit = A('1. **Dan Accadia** – beach', [{ url: 'https://www.ritzcarlton.com/en/hotels/tlvrz/', host: 'ritzcarlton.com' }]); assert.equal(cit.mentioned, true); assert.equal(cit.ownSiteCited, true);
const neg = [
  '1. **מלון קרלטון תל אביב** – על החוף\n2. **The Norman** – בוטיק',
  '1. **Carlton Tel Aviv** – beachfront\n2. **Ritz Hotel Paris** – classic',
  'Hotels in the area are rated highly; the marina is lovely.',
  '1. **Hotel** – x\n2. **מלון** – y',
];
for (const t of neg) assert.equal(A(t).mentioned, false, t);
assert.equal(sameBusiness('Carlton', nameVariants(ritz)), false); assert.equal(sameBusiness('קרלטון', nameVariants(ritz)), false);
const gen = { name: 'Zvulun Suites', website: 'https://www.booking.com/hotel/il/x', category: 'Hotel', city: 'Herzliya' };
assert.equal(analyzeAnswer({ text: '1. **Dan** – the best hotel option on booking.com', citations: [{ url: 'https://www.booking.com/a', host: 'booking.com' }] }, gen).ownSiteCited, false);
const he = { name: 'דנטל פלוס', aliases: ['Dental Plus'], category: 'רופא שיניים', city: 'תל אביב' };
assert.equal(analyzeAnswer({ text: '1. **Dental Plus Clinic** – מצוין' }, he).mentioned, true); assert.equal(analyzeAnswer({ text: '1. **מרפאת דנטל** – טוב' }, he).mentioned, false);
ok('matching: variants (no "the"/hyphens/city/type words), Hebrew<->Latin skeleton (ריץ קרלטון = Ritz Carlton), Hebrew prefixes, domain stem in text/citation hosts; negatives: "Carlton Tel Aviv"/"קרלטון" alone, "Ritz Hotel Paris", generic words, generic/short domains (booking.com, dan.co.il)');

// Offline repro of KoLtrTpBrKq- with the stored public answers
const fx = JSON.parse(read('./fixtures/ritz-KoLtrTpBrKq-.json'));
const old = fx.results.map(r => analyzeAnswer({ text: r.answer, citations: r.citations }, fx.business));
assert.equal(old.filter(a => a.mentioned).length, 0, 'stored answers are about Tel Aviv: the hotel is not in them');
const withAliases = fx.results.map(r => analyzeAnswer({ text: r.answer, citations: r.citations }, { ...fx.business, aliases: ['The Ritz-Carlton Herzliya', 'ריץ קרלטון'] }));
assert.equal(withAliases.filter(a => a.mentioned).length, 0, '"מלון קרלטון תל אביב" (a different hotel) must not count');
assert.equal(fx.results.filter(r => /קרלטון/.test(r.answer)).length, 3);
assert.equal(categorySet(fx.business.category), 'hospitality'); assert.ok(showZeroNotice({ score: 0, topCompetitors: [{ name: 'The Norman Tel Aviv', count: 11 }] }));
ok('KoLtrTpBrKq- offline: 0/30 answers mention the Ritz-Carlton even with the new matching (they were about Tel Aviv; the 3 "מלון קרלטון תל אביב" hits are a different hotel and stay unmatched) -> the fix is the city (hint + required) and the 0-score notice');

// 3) Question sets
for (const [cat, set] of [['מלונאות', 'hospitality'], ['Hotel', 'hospitality'], ['צימרים', 'hospitality'], ['B&B', 'hospitality'], ['מסעדה', 'food'], ['Cafe', 'food'], ['בית קפה', 'food'], ['תכשיטים', 'retail'], ['Jewelry', 'retail'], ['רופא שיניים', 'health'], ['dentist', 'health'], ['מספרה', 'health'], ['אינסטלטור', 'services'], ['Plumber', 'services'], ['עורך דין', 'services'], ['ספרים', 'retail'], ['משהו אחר', 'generic'], ['', 'generic']]) assert.equal(categorySet(cat), set, cat);
for (const [k, v] of Object.entries(SETS)) { assert.equal(v.en.length, 15, k); assert.equal(v.he.length, 15, k); for (const l of ['en', 'he']) assert.ok(v[l].every(q => q.includes('{city}') || q.includes('{inCity}')), `${k}/${l} city`); }
assert.deepEqual(TEMPLATES, { en: SETS.generic.en, he: SETS.generic.he });
for (const l of ['he', 'en']) for (const c of ['מלונאות', 'Hotel']) { const qs = buildQuestions({ name: 'R', category: c, city: 'Herzliya', lang: l }, 15); assert.equal(buildQuestions({ name: 'R', category: c, city: 'Herzliya', lang: l }, 5).length, 5);
  assert.ok(qs.every(q => !/consultation|who should i hire|hire|emergency|ייעוץ|לשכור|חירום/i.test(q)), qs.join('\n')); assert.ok(qs.every(q => /Herzliya|הרצליה/.test(q))); }
assert.equal(buildQuestions({ name: 'R', category: 'מלונאות', city: 'הרצליה' }, 1)[0], 'מהם המלונות ומקומות הלינה הטובים ביותר בהרצליה?');
assert.deepEqual(buildQuestions({ name: 'R', category: 'רופא שיניים', city: 'תל אביב' }, 5), TEMPLATES.he.slice(0, 5).map(t => t.replaceAll('{cat}', 'רופא שיניים').replaceAll('{inCity}', 'בתל אביב-יפו').replaceAll('{city}', 'תל אביב-יפו')));
ok('6 question sets (hospitality, food, retail, health, services, generic) x 15 he/en, city in every question, 5 per free scan; hotels never get consultation/hire/emergency; health+services keep the first 5 generic templates (day1 spec questions unchanged)');

// 4) 0-score notice
const sum = { score: 0, mentionRate: 0, checks: 10, byEngine: {}, topCompetitors: [{ name: 'The Norman Tel Aviv', count: 11 }], engines: { ran: ['chatgpt'], skipped: [] } };
const biz = { name: 'ritz carlton', category: 'מלונאות', city: 'תל אביב-יפו' };
assert.equal(zeroNotice(sum, biz, 'he'), 'כדאי לבדוק את העיר והתחום שהזנת: התשובות עסקו במלונאות בתל אביב-יפו. אם העסק נמצא במקום אחר או בתחום אחר, הריצו את הסריקה שוב עם הפרטים הנכונים.');
assert.ok(zeroNotice(sum, { ...biz, category: 'Hotel', city: 'Tel Aviv' }, 'en').includes('the answers were about Hotel in Tel Aviv'));
assert.equal(zeroNotice({ ...sum, score: 5 }, biz, 'he'), null); assert.equal(zeroNotice({ ...sum, topCompetitors: [] }, biz, 'he'), null);
const mail = l => renderWeeklyEmail({ business: { ...biz, name: '<x>' }, scan: { summary: sum, fixes: [] }, reportUrl: 'https://askranky.com/r/x', variant: 'report', lang: l });
assert.ok(mail('he').includes('data-zero-notice') && mail('he').includes('התשובות עסקו במלונאות')); assert.ok(mail('en').includes('the answers were about'));
assert.ok(!renderWeeklyEmail({ business: biz, scan: { summary: { ...sum, score: 40 }, fixes: [] }, reportUrl: 'https://askranky.com/r/x', variant: 'report', lang: 'he' }).includes('data-zero-notice'));
const rv = read('../web/components/ReportView.tsx'); assert.ok(/data-zero-notice/.test(rv) && /r\.score === 0 && r\.competitors\?\.length > 0/.test(rv));
ok('0-score notice when score is 0 and competitors appear (not otherwise): report page + report email, he/en, escaped');

TD.done(); console.log(`ALL ACCURACY TESTS PASSED (${n})`); process.exit(0);
