// free-3-actions: the deterministic 3-step generator (src/actions.js) + the free view API (no email) for named / not-named businesses.
import assert from 'node:assert/strict'; import { useTempData } from './helpers.js'; const TD = useTempData('actions');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES', 'DAILY_SPEND_CAP_USD', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY', 'DATABASE_URL']) delete process.env[k];
process.env.SCAN_RATE_MAX = '1000'; process.env.UNLOCK_RATE_MAX = '1000'; process.env.DISABLE_IP_LIMIT = '1';
const { buildActions } = await import('../src/actions.js');
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const sum = (o = {}) => ({ checks: 10, mentionRate: 0, topCompetitors: [{ name: 'Rival Alpha', count: 3 }, { name: 'Rival Beta', count: 2 }], engines: { ran: ['chatgpt', 'gemini'] }, byEngine: { chatgpt: { checks: 5, mentions: 0 }, gemini: { checks: 5, mentions: 0 } }, ownSiteCited: false, ...o });
const plumber = { name: 'אינסטלציה לדוגמה', city: 'חיפה', category: 'אינסטלטור' }; const lawyer = { name: 'Sample Law', city: 'Ramat Gan', category: 'Lawyer', website: 'https://sample-law.example' };
const BAD = /dent|שיניים|perplexity|claude|copilot|guarantee|מובטח|נבטיח|Rival Alpha|Rival Beta|\d+%/i;
const check = (acts, lang) => { assert.equal(acts.length, 3); assert.equal(new Set(acts.map(a => a.id)).size, 3); for (const a of acts) { for (const k of ['title', 'what', 'why', 'effort']) assert.ok(a[k] && a[k].length > 3, k); assert.ok(!BAD.test(JSON.stringify(a)), JSON.stringify(a)); assert.match(a.effort, lang === 'he' ? /דקות/ : /minutes/); } };
// 1) not named, no website, Hebrew
const a1 = buildActions({ summary: sum() }, plumber); check(a1, 'he');
assert.deepEqual(a1.map(a => a.id), ['google-profile', 'reviews', 'web-page']); assert.ok(a1[0].what.includes('אינסטלטור') && a1[0].what.includes('חיפה') && a1[0].why.includes('10')); assert.ok(a1[1].why.includes('2 עסקים אחרים'));
ok('not named, no website (he): google profile, reviews, simple web page; personalized with trade + city; other businesses counted, never named');
// 2) named in one engine only, has a site that was not cited, English
const a2 = buildActions({ summary: sum({ mentionRate: 0.3, byEngine: { chatgpt: { checks: 5, mentions: 3 }, gemini: { checks: 5, mentions: 0 } } }) }, lawyer); check(a2, 'en');
assert.deepEqual(a2.map(a => a.id), ['engine-gap', 'reviews', 'city-page']); assert.ok(a2[0].why.includes('ChatGPT mentioned') && a2[0].why.includes('Gemini did not')); assert.ok(a2[2].title.includes('Lawyer in Ramat Gan'));
ok('named by ChatGPT only (en): engine gap first, then reviews, then a "Lawyer in Ramat Gan" page');
// 3) detail conflict wins; clarifying answers show up; well-named business gets keep-fresh
const a3 = buildActions({ summary: sum({ mentionRate: 0.8, topCompetitors: [], ownSiteCited: true, clarifyingAnswers: 2, facts: { conflicts: [{ type: 'city', said: 'Tel Aviv' }] }, byEngine: { chatgpt: { checks: 5, mentions: 4 }, gemini: { checks: 5, mentions: 4 } } }) }, lawyer); check(a3, 'en');
assert.deepEqual(a3.map(a => a.id), ['fix-details', 'clarity', 'consistent']); assert.ok(a3[0].why.includes('Tel Aviv'));
const a4 = buildActions({ summary: sum({ mentionRate: 0.8, topCompetitors: [], ownSiteCited: true, byEngine: { chatgpt: { checks: 5, mentions: 4 }, gemini: { checks: 5, mentions: 4 } } }) }, lawyer); check(a4, 'en'); assert.deepEqual(a4.map(a => a.id), ['consistent', 'keep-fresh', 'reviews']);
ok('detail conflict ranks first; clarifying answers -> one-sentence step; a well-named business still gets exactly 3');
// 4) deterministic + personalization differs across trades/cities; empty input still 3
assert.deepEqual(buildActions({ summary: sum() }, plumber), a1);
const e1 = buildActions({ summary: sum() }, { name: 'Bright Sparks', city: 'Haifa', category: 'Electrician' }); const e2 = buildActions({ summary: sum() }, { name: 'Bright Sparks', city: 'Eilat', category: 'Locksmith' });
assert.notDeepEqual(e1, e2); assert.ok(JSON.stringify(e1).includes('Electrician in Haifa') && JSON.stringify(e2).includes('Locksmith in Eilat'));
check(buildActions({}, { name: 'X', city: 'Y', category: '' }), 'en'); check(buildActions({ summary: sum() }, plumber, 'en'), 'en');
ok('deterministic; different trade/city -> different text; empty scan data still yields 3; lang override works');
// 5) API: free view carries the 3 steps with no email, for a named and a not-named mock scan
const realFetch = globalThis.fetch; const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
globalThis.fetch = async (u, o) => { u = String(u); if (u.startsWith(B)) return realFetch(u, o); throw new Error('outbound fetch blocked in tests'); };
const post = (p, body) => realFetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
try {
  const seen = { named: 0, notNamed: 0 }; const texts = [];
  for (const [name, trade, city, lang] of [['Sample Pipes', 'plumber', 'חיפה', 'he'], ['Volt Demo', 'electrician', 'Eilat', 'en'], ['Sample Law', 'lawyer', 'רמת גן', 'he'], ['Key Demo', 'locksmith', 'Haifa', 'en']]) {
    const j = await post('/api/scan', { name, trade, city, lang }); const s = getDb().scans[j.reportId]; assert.ok(s.mock);
    const p = await realFetch(`${B}/api/report/${j.reportId}`).then(r => r.json()); assert.equal(p.locked, true); check(p.actions, /[\u05D0-\u05EA]/.test(city) ? 'he' : 'en');
    assert.ok(JSON.stringify(p.actions).includes(city)); texts.push(JSON.stringify(p.actions)); if (s.summary.mentionRate > 0) seen.named++; else seen.notNamed++;
    // a scan stored before this change (no s.actions) still gets 3 steps on read
    const saved = s.actions; delete s.actions; const p2 = await realFetch(`${B}/api/report/${j.reportId}`).then(r => r.json()); assert.deepEqual(p2.actions, saved); s.actions = saved;
  }
  assert.equal(new Set(texts).size, texts.length); console.log('    mock mix:', JSON.stringify(seen));
  ok('API free view (no email, mock scans): 3 steps in the JSON, personalized per trade/city; old scans computed on read');
  // force both cases explicitly through partialReport
  const { partialReport } = await import('../server.js'); const base = { id: 'x', at: '2026-11-04', results: [], fixes: [] };
  const pn = partialReport({ ...base, summary: sum() }, { name: 'Sample Pipes', city: 'Haifa', category: 'Plumber' }); const py = partialReport({ ...base, summary: sum({ mentionRate: 0.6, byEngine: { chatgpt: { checks: 5, mentions: 3 }, gemini: { checks: 5, mentions: 3 } } }) }, { name: 'Sample Pipes', city: 'Haifa', category: 'Plumber' });
  check(pn.actions, 'en'); check(py.actions, 'en'); assert.equal(pn.actions[0].id, 'google-profile'); assert.ok(!py.actions.some(a => a.id === 'google-profile' && a.why.includes('did not mention')) && py.actions.some(a => a.id === 'keep-fresh'));
  ok('partial view: not-named business -> profile step first; named business -> keep-fresh step, no "not mentioned" claim');
  console.log(`ALL ACTIONS TESTS PASSED (${n})`);
} finally { srv.close(); TD.done(); }
