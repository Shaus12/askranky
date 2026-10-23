// Scan-quality fixes found in the first real live scan: grammatical questions, no clarifying-question answers,
// parser ignores non-business items, Gemini redirect links never reported as a cited source, progress UI never stalls.
import assert from 'node:assert/strict'; import fs from 'node:fs';
const { buildQuestions, TEMPLATES } = await import('../src/questions.js');
const { extractNamedEntities, analyzeAnswer, isNonBusiness } = await import('../src/extract.js'); const { groundingCitations, geminiProvider } = await import('../src/providers/gemini.js');
const { openaiProvider } = await import('../src/providers/openai.js'); const { ANSWER_INSTRUCTION } = await import('../src/providers/prompt.js'); const { buildFixes } = await import('../src/fixes.js');
const FX = JSON.parse(fs.readFileSync(new URL('./fixtures/live-jewelry-scan.json', import.meta.url), 'utf8')); // real answers from the first live scan (public report 4DzOYB5kbFaj)
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

// 1b. Competitor extraction (real engine answers from the live scan)
{
  const biz = FX.business; const res = FX.results.map(r => ({ r, a: analyzeAnswer({ text: r.text, citations: [] }, biz) }));
  const clar = res.filter(x => x.a.clarifying); assert.equal(clar.length, 3); assert.ok(clar.every(x => x.r.engine === 'chatgpt' && x.a.competitors.length === 0 && !x.a.mentioned && x.a.rank === null));
  assert.ok(res.filter(x => !x.a.clarifying).every(x => x.a.competitors.length >= 4));
  const all = res.flatMap(x => x.a.competitors);
  for (const bad of ['טווח מחיר רצוי ?', 'חנות תכשיטים לקנייה ?', 'תכשיטי יוקרה ויהלומים (High-End)', 'תכשיטי יוקרה ויהלומים', 'עיצוב אמנותי וייחודי', 'מעצבים עצמאיים וטרנדיים', 'טלפון', 'איפה הכי כדאי להסתובב?', 'רחוב דיזנגוף', 'רחוב שבזי', 'מחפש/ת', 'מה התקציב המשוער ?', 'אם המחיר חשוב במיוחד', 'אמינות ומחיר', 'חוויית יוקרה בסטנדרט בינלאומי', 'מתנה עם טכנולוגיה ומקוריות', 'ציין בתקציב שלך כשאתה מתקשר', 'טבעות אירוסין ונישואין (Engagement)', 'התכשיטים הכי טובים'])
    assert.ok(!all.some(c => /[?]|High-End/.test(c) || ['טווח','טלפון','מחפש/ת','רחוב דיזנגוף','רחוב שבזי'].includes(c) || c.startsWith('תכשיטי יוקרה') || c === bad), `still counted: ${bad}`);
  for (const good of ['JB Jewelers', 'Franco Oro', 'Yaniv Fine Jewelry', 'Fabrica', 'Noam Nadiv', 'דני אליאב', 'ענבר תכשיטים', 'שלומית אופיר', 'Hotcrown', 'Baz & Lutra']) assert.ok(all.includes(good), `lost real business: ${good}`);
  assert.ok(!all.some(c => /^(טווח|סגנון|רחוב|שוק|מדרחוב|כיכר)/.test(c) || /[?]/.test(c)));
  // unit rules
  const NB = ['מה התקציב המשוער ?', 'Which style do you prefer?', 'סגנונות:', 'Premium (High-End)', 'טווח מחיר', 'סגנון', 'תכשיטי יוקרה', 'Price range', 'Budget options']; for (const x of NB) assert.ok(isNonBusiness(x, 'תכשיטים'), x);
  for (const x of ['ענבר תכשיטים', 'תכשיטי הוד והדר', 'Acme Plumbing', 'אינסטלציה אקמה', 'The Private Room', 'סטיל סטודיו']) assert.ok(!isNonBusiness(x, 'תכשיטים'), x);
  assert.deepEqual(extractNamedEntities('Which are you after?\n- Budget option?\n- Style (modern/classic)?\n- **Acme Plumbing** – good'), ['Acme Plumbing']);
  assert.deepEqual(extractNamedEntities('### 1. **Luxury & Diamonds (High-End)**\n* **Alpha Jewelers (Main St):** great\n* **Beta Gems:** ok\n### Budget picks:\n* **Gamma Silver:** cheap'), ['Alpha Jewelers', 'Beta Gems', 'Gamma Silver']);
  // a clarifying reply that merely quotes the business name must not count as a mention; a normal answer ending with an offer still does
  assert.equal(analyzeAnswer({ text: 'Quick question first: do you mean Acme Plumbing in Austin or Acme in Dallas?\n- Residential?\n- Commercial?' }, { name: 'Acme Plumbing' }).mentioned, false);
  const normal = analyzeAnswer({ text: '1. **Acme Plumbing** – fast\n2. **Other Co** – ok\n\nWant me to search more?' }, { name: 'Acme Plumbing' }); assert.equal(normal.mentioned, true); assert.equal(normal.rank, 1); assert.ok(!normal.clarifying);
  ok('parser: questions, headings, field labels, advice fragments, streets/markets are not competitors; clarifying-question answers are flagged and never count as a mention; real businesses kept (real live-scan fixtures)');
  const inst = ANSWER_INSTRUCTION; assert.match(inst, /Never ask clarifying questions/); assert.match(inst, /concrete, real businesses/); assert.match(inst, /same language/);
  const realFetch = globalThis.fetch; const seen = [];
  globalThis.fetch = async (u, o) => { seen.push({ u: String(u), body: JSON.parse(o.body) }); return String(u).includes('openai') ? { ok: true, json: async () => ({ output: [], usage: {} }) } : { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'x' }] } }] }) }; };
  try { process.env.OPENAI_API_KEY = 'k'; process.env.GEMINI_API_KEY = 'k'; await openaiProvider.ask('q'); await geminiProvider.ask('q'); } finally { globalThis.fetch = realFetch; delete process.env.OPENAI_API_KEY; delete process.env.GEMINI_API_KEY; }
  assert.equal(seen[0].body.instructions, inst); assert.equal(seen[0].body.max_tool_calls, 1); assert.equal(seen[0].body.input, 'q'); assert.equal(seen[1].body.systemInstruction.parts[0].text, inst); assert.deepEqual(seen[1].body.tools, [{ google_search: {} }]); assert.equal(seen.length, 2);
  ok('ChatGPT (instructions) and Gemini (systemInstruction) get the answer-directly prompt; same single call and 1-search cap, so cost estimates are unchanged');
}

// 2. Gemini redirect citations
{
  const R = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/';
  const calls = []; const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => { calls.push({ u: String(u), method: o?.method }); if (u.endsWith('boom')) throw new Error('network'); if (u.endsWith('timeout')) { const e = new Error('t'); e.name = 'TimeoutError'; throw e; }
    if (u.endsWith('same')) return { headers: { get: () => R + 'other' } }; return { headers: { get: () => 'https://www.jb-jewelers.com/contact' } }; };
  try {
    const out = await groundingCitations([{ web: { uri: R + 'a', title: 'www.Easy.co.il' } }, { web: { uri: R + 'a', title: 'easy.co.il' } }, { web: { uri: R + 'b', title: 'Some Article Title' } }, { web: { uri: R + 'boom', title: '' } }, { web: { uri: R + 'timeout' } }, { web: { uri: R + 'same' } }, { web: { uri: 'https://direct.example/x', title: 'x' } }, {}], { resolve: true });
    assert.deepEqual(out[0], { url: R + 'a', host: 'easy.co.il' }); assert.equal(out.length, 6); // duplicate uri dropped, empty chunk dropped
    assert.equal(out[1], 'https://www.jb-jewelers.com/contact'); assert.equal(out[2], R + 'boom'); assert.equal(out[3], R + 'timeout'); assert.equal(out[4], R + 'same'); assert.equal(out[5], 'https://direct.example/x');
    assert.equal(calls.length, 4); assert.ok(calls.every(c => c.method === 'HEAD')); assert.ok(!calls.some(c => c.u.endsWith('/a')), 'domain title: no request');
    calls.length = 0; const off = await groundingCitations([{ web: { uri: R + 'z', title: '' } }], { resolve: false }); assert.deepEqual(off, [R + 'z']); assert.equal(calls.length, 0);
  } finally { globalThis.fetch = realFetch; }
  // analyzeAnswer: title-host citation, redirect-only citation (opaque), own site
  const a = analyzeAnswer({ text: '1. **Beta**', citations: [{ url: R + 'a', host: 'easy.co.il' }, R + 'q', 'https://www.mason.co.il/x'] }, { name: 'Alpha', website: 'https://mason.co.il' });
  assert.deepEqual(a.citations.map(c => c.host), ['easy.co.il', 'vertexaisearch.cloud.google.com', 'mason.co.il']); assert.equal(a.citations[0].opaque, undefined); assert.equal(a.citations[1].opaque, true); assert.equal(a.ownSiteCited, true);
  ok('Gemini grounding: real domain from chunk title (no request), HEAD-resolve with timeout/fail-safe fallback, dedupe; redirect-only links flagged opaque');
}
{
  const { useTempData } = await import('./helpers.js'); const TD = useTempData('sq'); const { runScan } = await import('../src/scan.js');
  delete process.env.SCAN_MODE; const R = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/';
  // opaque host never counted nor recommended, even for a scan stored before the fix
  const mk = hosts => ({ summary: { mentionRate: 0.1, topCitedHosts: hosts, topCompetitors: [{ name: 'Beta', count: 2 }], ownSiteCited: true } });
  for (const b of [{ name: 'מייסון מאנא', category: 'תכשיטים', city: 'תל אביב-יפו' }, { name: 'Mason', category: 'Jewelry', city: 'Tel Aviv' }]) {
    const f = buildFixes(mk([{ host: 'vertexaisearch.cloud.google.com', count: 25 }, { host: 'easy.co.il', count: 3 }]), b); assert.ok(!JSON.stringify(f).includes('vertexaisearch')); assert.ok(JSON.stringify(f).includes('easy.co.il'));
    const g = buildFixes(mk([{ host: 'vertexaisearch.cloud.google.com', count: 25 }]), b); assert.ok(!JSON.stringify(g).includes('vertexaisearch'));
  }
  // end to end through runScan with a stubbed live Gemini (no real API call)
  const realFetch = globalThis.fetch; let geminiCalls = 0, heads = 0;
  globalThis.fetch = async (u, o) => { u = String(u);
    if (u.includes('generativelanguage.googleapis.com')) { geminiCalls++; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '1. **Beta Co** - ok\n2. **Gamma Co** - ok' }] }, groundingMetadata: { webSearchQueries: ['q'], groundingChunks: [{ web: { uri: R + 'one', title: 'easy.co.il' } }, { web: { uri: R + 'two', title: '' } }, { web: { uri: R + 'three', title: 'An article' } }] } }] }) }; }
    if (u.startsWith(R)) { heads++; if (u.endsWith('three')) throw new Error('down'); return { headers: { get: () => 'https://www.zap.co.il/x' } }; }
    throw new Error('unexpected fetch ' + u); };
  Object.assign(process.env, { SCAN_MODE: 'live', GEMINI_API_KEY: 'k' }); process.env.LIVE_ENGINES = 'gemini';
  try { const s = await runScan({ id: 'a1', plan: 'free', usage: {} }, { id: 'b1', name: 'Acme', category: 'Plumber', city: 'Austin' }, { engines: ['gemini'] });
    const hosts = Object.fromEntries(s.summary.topCitedHosts.map(h => [h.host, h.count])); assert.equal(hosts['easy.co.il'], 5); assert.equal(hosts['zap.co.il'], 5); assert.ok(!('vertexaisearch.cloud.google.com' in hosts)); assert.ok(!JSON.stringify(s.fixes).includes('vertexaisearch'));
    assert.equal(s.summary.checks, 5); assert.equal(geminiCalls, 5); assert.equal(heads, 10); assert.equal(s.summary.estCostUsd, 0.1); assert.equal(s.mock, false);
  } finally { globalThis.fetch = realFetch; for (const k of ['SCAN_MODE', 'GEMINI_API_KEY', 'LIVE_ENGINES']) delete process.env[k]; TD.done(); }
  ok('scan summary: redirect host excluded from topCitedHosts and from generated fixes (HE+EN, old stored scans too); checks/cost unchanged');
}
console.log(`ALL SCAN-QUALITY TESTS PASSED (${n})`); process.exit(0);
