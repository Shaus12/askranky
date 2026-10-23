// Day-1 scan script + offline analyzer. NO network, NO real keys: engines are stubbed at fetch level, the "production" store is pg-mem.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { newDb } from 'pg-mem';
// Scrub anything real the box environment may carry BEFORE importing app modules.
for (const k of Object.keys(process.env)) if (/KEY|SECRET|TOKEN|DATABASE_URL|PASSWORD|PERPLEXITY/i.test(k)) delete process.env[k];
import { useTempData } from './helpers.js'; const TD = useTempData('day1');
Object.assign(process.env, { SCAN_MODE: 'live', LIVE_ENGINES: 'chatgpt,gemini', OPENAI_API_KEY: 'sk-test-not-real', GEMINI_API_KEY: 'gm-test-not-real', DAILY_SPEND_CAP_USD: '10', GEMINI_RESOLVE_REDIRECTS: '0', DATABASE_URL: 'postgres://prod-fake/db' });
const prodUrl = process.env.DATABASE_URL; delete process.env.DATABASE_URL;   // the app store must never see it (as the CLI does)
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const C = await import('../scripts/lib/day1-common.js'); const L = await import('../scripts/lib/day1-scan-lib.js'); const A = await import('../scripts/lib/day1-analysis.js');
const { runScan } = await import('../src/scan.js'); const store = await import('../src/store.js'); const { dailyCapUsd } = await import('../src/costs.js'); const { buildQuestions } = await import('../src/questions.js'); const { COST_PER_CHECK } = await import('../src/plans.js'); const S = await import('../src/store-pg.js');
const day = C.utcDay(); const tmp = p => fs.mkdtempSync(path.join(os.tmpdir(), p));

// ---- stub engines (fetch level; real providers + real runScan run on top of it) ----
const calls = []; const realFetch = globalThis.fetch; let failGemini = false, failAll = false;
const ANSWER = '1. **Zeta Dental** – great\n2. **Eta Dental** – good\n3. **Theta Dental** – fine';
globalThis.fetch = async (url, init) => {
  calls.push(String(url)); const u = String(url);
  if (u.startsWith('https://api.openai.com/v1/responses')) return new Response(JSON.stringify({ output: [{ type: 'web_search_call' }, { type: 'message', content: [{ text: ANSWER, annotations: [{ url: 'https://www.yelp.com/biz/zeta' }] }] }], usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200 });
  if (u.includes('generativelanguage.googleapis.com')) { if (failAll || failGemini) return new Response('boom', { status: 500 }); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: ANSWER }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/x', title: 'healthgrades.com' } }], webSearchQueries: ['q'] } }], usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 40 } }), { status: 200 }); }
  throw new Error('unexpected network call: ' + u);
};
const openaiOnly = () => { const f = globalThis.fetch; return f; };
// ---- fake production DB (the app's real migrations on pg-mem) ----
async function prodDb(spend = {}) {
  const mem = newDb(); const { Pool } = mem.adapters.createPg(); for (const m of S.MIGRATIONS) await mem.public.none(m);
  for (const [d, u] of Object.entries(spend)) mem.public.none(`INSERT INTO spend (day, usd) VALUES ('${d}', ${u})`);
  const prod = await L.openProdSpend('postgres://u@h/db?sslmode=disable', { Pool }); return { mem, prod };
}
const cnt = (mem, t) => mem.public.many(`SELECT count(*)::int AS n FROM ${t}`)[0].n;
const baseDeps = (prod, over = {}) => ({ runScan, buildQuestions, costPerCheck: COST_PER_CHECK, dailyCap: dailyCapUsd, prod, store: { BACKEND: store.BACKEND, DB_FILE: store.DB_FILE }, tempDir: TD.dir, tempSpend: d => store.getDb().spend[d] || 0, env: { ...process.env, DATABASE_URL: prodUrl }, appCommit: 'abc1234', models: { chatgpt: 'm1', gemini: 'm2' }, log: () => {}, ...over });
const opts = (dir, o) => ({ dir, usageChecked: false, rerun: false, ...o });
const fresh = () => { const d = tmp('day1-out-'); calls.length = 0; return d; };

// 1. Spec table + question assertion
{
  assert.equal(C.MARKETS['IL-1'].questions.length, 5); for (const id of ['IL-1', 'US-1']) assert.deepEqual(C.questionProblems(id, buildQuestions(C.probeBusiness(id), 5)), []);
  assert.equal(C.MARKETS['IL-1'].questions[0], 'מי העסקים הטובים ביותר בתחום רופא שיניים בתל אביב-יפו?'); assert.equal(C.MARKETS['US-1'].questions[3], 'I need affordable dentist in Austin, TX, who should I call?');
  const changed = buildQuestions(C.probeBusiness('US-1'), 5).map((q, i) => i === 1 ? q.replace('Recommend', 'Suggest') : q); assert.equal(C.questionProblems('US-1', changed).length, 1);
  const { mem, prod } = await prodDb(); const out = fresh();
  const r = await L.runDay1Scan(opts(out, { market: 'US-1', run: 1, usageChecked: true }), baseDeps(prod, { buildQuestions: (b, k) => buildQuestions(b, k).map(q => q.replace('best', 'finest')), })); // IL-1 first is required, so use a market without prerequisite
  assert.equal(r.ok, false); assert.equal(calls.length, 0);
  const r2 = await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1 }), baseDeps(prod, { buildQuestions: (b, k) => buildQuestions(b, k).map(q => q.replace('בתחום', 'בתחומי')) }));
  assert.equal(r2.code, 'QUESTIONS'); assert.equal(calls.length, 0); assert.equal(await prod.read(day), 0); await prod.close(); ok('generated questions must equal the spec table, otherwise abort before any engine call or spend');
}

// 2. Default is a DRY RUN: prints plan + cost, no engine/DB access, nothing written (subprocess, fake env, unroutable DB)
{
  const out = fresh(); const env = { PATH: process.env.PATH, HOME: process.env.HOME, DAY1_DIR: out, SCAN_MODE: 'live', LIVE_ENGINES: 'chatgpt,gemini', OPENAI_API_KEY: 'sk-secret-VALUE', GEMINI_API_KEY: 'gm-secret-VALUE', DATABASE_URL: 'postgres://u:pw-secret@127.0.0.1:1/db', DAILY_SPEND_CAP_USD: '10' };
  for (const args of [[], ['--market', 'IL-1', '--run', '1'], ['--market', 'IL-1', '--run', '1', '--usage-checked']]) {
    const p = spawnSync(process.execPath, ['scripts/day1-scan.js', ...args], { env, encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '..'), timeout: 30000 });
    assert.equal(p.status, 0, p.stderr); assert.match(p.stdout, /DRY RUN/); assert.match(p.stdout, /\$0\.17 per scan/); assert.doesNotMatch(p.stdout + p.stderr, /secret|VALUE/); assert.equal(fs.readdirSync(out).length, 0);
  }
  assert.match(spawnSync(process.execPath, ['scripts/day1-scan.js'], { env: { PATH: process.env.PATH, DAY1_DIR: out }, encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '..') }).stdout, /\$0\.68 for 4 scans/);
  const bad = spawnSync(process.execPath, ['scripts/day1-scan.js', '--market', 'XX-9'], { env: { PATH: process.env.PATH }, encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '..') }); assert.equal(bad.status, 2);
  assert.equal(L.parseArgs([]).confirm, false); assert.equal(L.parseArgs(['--confirm-spend', '--market', 'IL-1', '--run', '2']).confirm, true);
  // --confirm-spend without market/run never spends
  const { prod } = await prodDb(); assert.equal((await L.runDay1Scan(opts(out, {}), baseDeps(prod))).code, 'ARGS'); await prod.close(); assert.equal(calls.length, 0);
  ok('default is a dry run (plan + $0.17/scan, $0.68 total); no network, no files, no secret values printed; --confirm-spend needs --market/--run');
}

// 3. Spend accounting: cost lands in the PRODUCTION counter; scan data only in the temp store + output file; no accounts/businesses/scans in production
{
  const { mem, prod } = await prodDb({ [day]: 1.0 }); const out = fresh();
  const r = await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1 }), baseDeps(prod));
  assert.equal(r.ok, true, r.message); assert.equal(calls.length, 10); assert.ok(calls.every(u => /api\.openai\.com|generativelanguage/.test(u)));
  assert.equal(r.incurred, 0.17); assert.equal(await prod.read(day), 1.17); assert.equal(+mem.public.many(`SELECT usd FROM spend WHERE day = '${day}'`)[0].usd, 1.17);
  for (const t of ['accounts', 'businesses', 'scans', 'waitlist']) assert.equal(cnt(mem, t), 0, `production ${t} must stay empty`);
  const ev = mem.public.many('SELECT data FROM events').map(x => x.data); assert.deepEqual(ev.map(e => e.type), ['spend.day1_scan']); assert.deepEqual([ev[0].id, ev[0].run, ev[0].usd], ['IL-1', 1, 0.17]);
  assert.equal(Object.keys(store.getDb().scans).length, 1, 'scan data is in the temp store'); assert.ok(store.DB_FILE.startsWith(TD.dir));
  const f = JSON.parse(fs.readFileSync(C.runFile(out, 'IL-1', 1), 'utf8')); assert.equal(f.meta.valid, true); assert.equal(f.meta.recordedInDailyCounter, true); assert.equal(f.meta.questionsAsserted, true); assert.deepEqual(f.meta.models, { chatgpt: 'm1', gemini: 'm2' }); assert.match(f.meta.startedAt, /[+-]\d\d:\d\d$/); assert.equal(f.scan.results.length, 10); assert.ok(f.scan.results.every(x => !x.mock && x.usage));
  assert.doesNotMatch(JSON.stringify(f), /sk-test|gm-test/); assert.equal(L.ledgerTotal(out), 0.17);
  // second scan in order: needs --usage-checked for US-1 run 1 (the pause), adds to the same counter
  const blocked = await L.runDay1Scan(opts(out, { market: 'US-1', run: 1 }), baseDeps(prod)); assert.equal(blocked.code, 'ORDER'); assert.match(blocked.message, /usage-checked/);
  assert.equal((await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1 }), baseDeps(prod))).code, 'ORDER', 'a valid run is never silently repeated');
  assert.equal((await L.runDay1Scan(opts(out, { market: 'IL-1', run: 2 }), baseDeps(prod))).code, 'ORDER', 'order: IL-1 run 2 only after US-1 run 1');
  const r2 = await L.runDay1Scan(opts(out, { market: 'US-1', run: 1, usageChecked: true }), baseDeps(prod)); assert.equal(r2.ok, true, r2.message); assert.equal(await prod.read(day), 1.34); assert.equal(L.ledgerTotal(out), 0.34);
  // alert event when >= 80% of the cap
  const hot = await prodDb({ [day]: 7.7 }); const o2 = fresh(); const rr = await L.runDay1Scan(opts(o2, { market: 'IL-1', run: 1 }), baseDeps(hot.prod, { dailyCap: () => 9 })); assert.equal(rr.ok, true); assert.deepEqual(hot.mem.public.many('SELECT data FROM events').map(x => x.data.type), ['spend.alert', 'spend.day1_scan']);
  await prod.close(); await hot.prod.close(); ok('cost (+$0.17 per scan) is added to the production spend[UTC day] row; accounts/businesses/scans stay empty in production; scan data only in temp store + output file; audit + 80% alert events; order and pause gates');
}

// 4. Hard stops: own $0.85 and the production daily cap (>= $1 headroom); both refuse BEFORE any engine call
{
  const { prod } = await prodDb(); let out = fresh();
  fs.writeFileSync(L.ledgerPath(out), JSON.stringify({ entries: [{ id: 'IL-1', run: 1, usd: 0.51 }, { id: 'US-1', run: 1, usd: 0.17 }] }));   // 0.68 so far
  fs.writeFileSync(C.runFile(out, 'IL-1', 1), JSON.stringify({ scan: {} })); // invalid file = not a valid predecessor, so also remove ordering from the picture:
  fs.rmSync(C.runFile(out, 'IL-1', 1));
  let r = await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1, rerun: true }), baseDeps(prod)); assert.equal(r.ok, true, r.message);                      // 0.68 + 0.17 = 0.85: allowed (not above)
  assert.equal(L.ledgerTotal(out), 0.85); calls.length = 0;
  r = await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1, rerun: true }), baseDeps(prod)); assert.equal(r.code, 'OWN_LIMIT'); assert.equal(calls.length, 0);   // 0.85 + 0.17 > 0.85
  out = fresh(); const hi = await prodDb({ [day]: 8.9 }); r = await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1 }), baseDeps(hi.prod)); assert.equal(r.code, 'DAILY_CAP'); assert.equal(calls.length, 0); assert.equal(await hi.prod.read(day), 8.9);   // 8.9 + 0.17 > 10 - 1
  const edge = await prodDb({ [day]: 8.83 }); r = await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1 }), baseDeps(edge.prod)); assert.equal(r.ok, true, r.message);                      // 8.83 + 0.17 = 9.00 = cap - 1: allowed
  const broken = { read: async () => { throw new Error('connection refused'); }, add: async () => 0, event: async () => {}, close() {} }; calls.length = 0; out = fresh();
  r = await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1 }), baseDeps(broken)); assert.equal(r.code, 'PROD_READ'); assert.equal(calls.length, 0);
  for (const p of [prod, hi.prod, edge.prod]) await p.close(); ok('hard stop above $0.85 own spend (0.85 allowed, more refused); refuses when production spend + estimate > cap - $1; refuses when the production counter cannot be read');
}

// 5. Invalid output: errors / mock / skipped engine; cost of successful checks is still recorded; never a valid file
{
  const { mem, prod } = await prodDb(); let out = fresh(); failGemini = true;
  let r = await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1 }), baseDeps(prod)); failGemini = false;
  assert.equal(r.ok, false); assert.equal(r.code, 'INVALID'); assert.match(r.message, /INVALID/); assert.ok(!fs.existsSync(C.runFile(out, 'IL-1', 1))); assert.equal(fs.readdirSync(out).filter(f => /invalid/.test(f)).length, 1);
  assert.equal(r.incurred, 0.07); assert.equal(await prod.read(day), 0.07); assert.equal(L.ledgerTotal(out), 0.07);   // chatgpt 5 x 0.014; gemini all failed
  // every Gemini call failed => runScan throws; its cost is still found (temp counter) and recorded
  out = fresh(); failAll = true; r = await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1, rerun: true }), baseDeps(prod)); failAll = false; assert.equal(r.code, 'INVALID'); assert.equal(await prod.read(day), 0.14);
  assert.equal(C.validateScan(JSON.parse(JSON.stringify({ mock: false, summary: { checks: 10, errors: 0, engines: { ran: ['chatgpt', 'gemini'], skipped: [] } }, results: C.MARKETS['IL-1'].questions.flatMap(q => ['chatgpt', 'gemini'].map(e => ({ question: q, engine: e, mock: e === 'gemini' }))) })), 'IL-1').some(x => /mock/.test(x)), true);
  // prod write failure: loud, non-ok, ledger says not recorded
  out = fresh(); const failing = { read: async () => 0, add: async () => { throw new Error('db down'); }, event: async () => {}, close() {} }; const lines = [];
  r = await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1 }), baseDeps(failing, { log: s => lines.push(s) })); assert.equal(r.code, 'PROD_WRITE'); assert.ok(lines.some(s => /COST NOT RECORDED.*0\.17/.test(s))); assert.equal(JSON.parse(fs.readFileSync(L.ledgerPath(out), 'utf8')).entries[0].recordedInDailyCounter, false); assert.equal(cnt(mem, 'accounts'), 0);
  await prod.close(); ok('mock/skipped/failed engine or errors > 0 => INVALID (saved as .invalid, never a valid file), cost still recorded; failed production write is loud and non-ok');
}

// 6. Environment / store guards
{
  const good = { SCAN_MODE: 'live', LIVE_ENGINES: 'gemini,chatgpt', OPENAI_API_KEY: 'x', GEMINI_API_KEY: 'x', DATABASE_URL: 'x', DAILY_SPEND_CAP_USD: '10' };
  assert.deepEqual(L.envProblems(good), []); assert.ok(L.envProblems({ ...good, LIVE_ENGINES: 'chatgpt,gemini,perplexity' }).some(x => /exactly/.test(x))); assert.ok(L.envProblems({ ...good, SCAN_MODE: 'mock' }).length); assert.ok(L.envProblems({ ...good, GEMINI_API_KEY: '' }).some(x => /GEMINI_API_KEY/.test(x))); assert.ok(L.envProblems({ ...good, DAILY_SPEND_CAP_USD: '' }).length);
  const { prod } = await prodDb(); calls.length = 0; const out = fresh();
  assert.equal((await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1 }), baseDeps(prod, { store: { BACKEND: 'postgres', DB_FILE: undefined } }))).code, 'STORE');
  assert.equal((await L.runDay1Scan(opts(out, { market: 'IL-1', run: 1 }), baseDeps(prod, { env: { ...good, LIVE_ENGINES: 'chatgpt,gemini,perplexity' } }))).code, 'ENV'); assert.equal(calls.length, 0); await prod.close();
  ok('refuses without SCAN_MODE=live, both keys, exactly chatgpt+gemini, a production DATABASE_URL and an explicit cap; refuses if the app store is not the temp JSON store');
}

// ---------------- offline analyzer (fixtures are hand-written, tests only) ----------------
const qs = id => C.MARKETS[id].questions; const BIZ = ['Lumen Clinic', 'Orbit Smiles', 'Nova Dental', 'Kite Care', 'Pearl Point', 'Maple Dent', 'Quartz Dental', 'Ridge Smile', 'Sable Clinic', 'Tango Teeth', 'Umber Dental', 'Vista Dent'];
const mkBiz = (extra = {}) => BIZ.map((name, i) => ({ name, aliases: [], website: `https://www.biz${i}.example`, ...(extra[i] || {}) }));
// answers: { chatgpt: [a1..a5], gemini: [..] }, cites: per engine list of [url, host]
const mkRun = (id, run, answers, { cites = {}, mutate } = {}) => { const results = []; for (let q = 0; q < 5; q++) for (const e of ['chatgpt', 'gemini']) results.push({ question: qs(id)[q], engine: e, engineLabel: e, mock: false, answer: answers[e][q], usage: { input: 1, output: 1 }, searches: 1, citations: (cites[e]?.[q] || []).map(([url, host]) => ({ url, host, ...(host === 'vertexaisearch.cloud.google.com' ? { opaque: true } : {}) })), competitors: [], mentioned: false });
  const scan = { mock: false, results, summary: { checks: 10, errors: 0, engines: { ran: ['chatgpt', 'gemini'], skipped: [] }, estCostUsd: 0.17 } }; mutate?.(scan); return { meta: { id, run, startedAt: `2026-10-24T09:0${run}:00+03:00`, appCommit: 'abc', models: { chatgpt: 'a', gemini: 'b' }, questionsAsserted: true, valid: true, estCostUsd: 0.17, recordedInDailyCounter: true }, scan }; };
const none = '(no list in this answer)'; const same = a => ({ chatgpt: a, gemini: a });
{
  // mention detection: Hebrew prefixes, aliases, clarifying answers, rank
  const he = [{ name: 'דנטל פלוס', aliases: ['Dental Plus'] }, { name: 'מרפאת שן', aliases: ['Smile Clinic'] }, ...BIZ.slice(0, 10).map(name => ({ name }))];
  const ans = { chatgpt: ['מומלץ מאוד בדנטל פלוס בתל אביב', 'Smile Clinic is great', none, 'מה בדיוק אתה מחפש? דנטל פלוס?', none], gemini: [none, none, none, none, none] };
  const run = mkRun('IL-1', 1, ans); const r = A.analyzeMarket({ id: 'IL-1', runs: [run], businesses: he }); assert.equal(r.valid, true, r.invalidReasons.join());
  assert.equal(r.perBusiness[0].named, true); assert.equal(r.perBusiness[0].byEngine.chatgpt, 1, 'prefix ב glued to the name; the clarifying answer is not a mention'); assert.equal(r.perBusiness[1].named, true, 'named through its Latin alias'); assert.equal(r.placeholders.k_named, 2); assert.equal(r.placeholders.pct_mentioned, 17); assert.equal(r.placeholders.n_checks, 10);
  assert.equal(r.placeholders.pct_mentioned_chatgpt, 17); assert.equal(r.placeholders.pct_mentioned_gemini, 0); assert.equal(r.placeholders.example_question_he, qs('IL-1')[1]); assert.ok(r.perBusiness.every(b => b.name === '(private)'));
  assert.match(r.review.md, /Smile Clinic/); assert.match(r.review.md, /דנטל פלוס/);
  // override wins and is logged
  const o = A.analyzeMarket({ id: 'IL-1', runs: [run], businesses: he, overrides: [{ business: 'דנטל פלוס', engine: 'chatgpt', q: 4, named: true, reason: 'human: clarifying answer did name it' }, { business: 'מרפאת שן', named: false, reason: 'not a real mention' }] });
  assert.equal(o.overridesApplied.length > 0, true); assert.equal(o.perBusiness[1].named, false); assert.equal(o.perBusiness[0].byEngine.chatgpt, 2); assert.equal(o.perBusiness[1].overridden, true); assert.match(o.review.md, /Overrides applied/);
  ok('mention detection uses the product detector (Hebrew prefixes, aliases, clarifying answers excluded); human overrides win and are logged');
}
{
  // Jaccard overlap, variance sentence, gbp threshold, opaque/own hosts, www stripping
  assert.equal(A.jaccard(['a', 'b'], ['b', 'c']), 1 / 3); assert.equal(A.jaccard([], []), null); assert.equal(A.jaccard(['a'], ['a']), 1);
  const L1 = '1. **Zeta Dental** – great\n2. **Eta Dental** – good', L2 = '1. **Eta Dental** – good\n2. **Theta Dental** – fine';
  const run1 = mkRun('US-1', 1, { chatgpt: [L1, none, none, none, none], gemini: [L2, none, none, none, none] }, { cites: { chatgpt: [[['https://www.yelp.com/a', 'www.yelp.com'], ['https://biz0.example/x', 'biz0.example']]], gemini: [[['https://vertexaisearch.cloud.google.com/r1', 'vertexaisearch.cloud.google.com'], ['https://www.yelp.com/b', 'yelp.com'], ['https://www.google.com/maps/place/x', 'google.com'], ['https://healthgrades.com/p', 'healthgrades.com']]] } });
  const run2 = mkRun('US-1', 2, { chatgpt: ['1. **Eta Dental** – good', none, none, none, none], gemini: ['1. **Eta Dental** – good', none, none, none, none] });
  const r = A.analyzeMarket({ id: 'US-1', runs: [run1, run2], businesses: mkBiz() }); assert.equal(r.valid, true, r.invalidReasons.join());
  const p = r.placeholders; assert.equal(p.n_checks, 20); assert.equal(p.n_runs, 2); assert.equal(p.pct_overlap, Math.round(100 * (1 / 3 + 1) / 2)); assert.equal(p.example_question, qs('US-1')[4]); assert.equal(p.city, 'Austin, TX');
  assert.equal(p.variance_finding, '2 of the 3 businesses named in run 1 were not named in run 2 (same questions, same engines)');
  assert.deepEqual(p.top_cited_sites, ['yelp.com (2)', 'google.com (1)', 'healthgrades.com (1)']); assert.ok(!p.top_cited_sites.some(x => /vertexai|biz0/.test(x))); assert.equal(p.n_cited_hosts_total, 3); assert.equal(p.n_citations_counted, 4);
  assert.equal(p.gbp_share, 20, '1 of 5 non-opaque citations (own site counted) is Google Maps');
  assert.equal(A.analyzeMarket({ id: 'US-1', runs: [mkRun('US-1', 1, same([none, none, none, none, none]), { cites: { chatgpt: [[['https://www.google.com/maps/place/a', 'google.com']]] } })], businesses: mkBiz() }).placeholders.gbp_share, null, 'fewer than 5 non-opaque citations -> null'); assert.equal(p.date_range, '24 Oct 2026'); assert.equal(r.label.startsWith('Directional only: 20 checks (5 questions × 2 engines × 2 runs), 12 public businesses, one city, API answers (not the consumer apps)'), true);
  // gbp share with >= 5 non-opaque citations
  const gb = mkRun('US-1', 1, same([none, none, none, none, none]), { cites: { chatgpt: [[['https://www.google.com/maps/place/a', 'google.com'], ['https://maps.google.com/x', 'maps.google.com'], ['https://g.page/y', 'g.page'], ['https://yelp.com/1', 'yelp.com'], ['https://yelp.com/2', 'yelp.com']]] } });
  const g = A.analyzeMarket({ id: 'US-1', runs: [gb], businesses: mkBiz() }).placeholders; assert.equal(g.gbp_share, 60); assert.equal(g.variance_finding, null); assert.equal(g.n_runs, 1); assert.equal(g.n_checks, 10);
  ok('Jaccard overlap, variance sentence (Tier 2 only), top cited sites (no opaque redirectors / own sites, www stripped), gbp_share null below 5 citations');
}
{
  // fixes avoid private names; refusals
  const r = A.analyzeMarket({ id: 'US-1', runs: [mkRun('US-1', 1, same([none, none, none, none, none]))], businesses: mkBiz() }); assert.equal(r.valid, true);
  assert.equal(r.placeholders.k_named, 0); assert.ok(r.placeholders.fix_1); assert.ok([r.placeholders.fix_1, r.placeholders.fix_2, r.placeholders.fix_3].filter(Boolean).every(t => !BIZ.some(b => t.toLowerCase().includes(b.toLowerCase()))));
  const bad = (mut, re, biz = mkBiz()) => { const x = A.analyzeMarket({ id: 'US-1', runs: [mkRun('US-1', 1, same([none, none, none, none, none]), { mutate: mut })], businesses: biz }); assert.equal(x.valid, false); assert.equal(x.placeholders, null); assert.match(x.invalidReasons.join(' | '), re); };
  bad(s => { s.results[3].mock = true; }, /mock/); bad(s => { s.summary.errors = 1; }, /errors/); bad(s => { s.results[2].error = 'x'; }, /error/); bad(s => { s.summary.engines.skipped = [{ engine: 'gemini', reason: 'failed' }]; }, /skipped/);
  bad(s => { s.results[0].question = 'What are the finest businesses?'; }, /question/); bad(() => {}, /12 businesses/, mkBiz().slice(0, 11)); bad(() => {}, /12 businesses/, [...mkBiz(), { name: 'x' }]); bad(s => { s.results.push({ ...s.results[0], engine: 'perplexity' }); }, /perplexity|expected 10/);
  assert.equal(A.analyzeMarket({ id: 'US-1', runs: [mkRun('US-1', 2, same([none, none, none, none, none]))], businesses: mkBiz() }).valid, false, 'runs must be [1] or [1,2]');
  ok('fixes never contain business names; refuses on mock, errors, skipped engine, changed questions, N != 12, wrong run set');
}
{
  // CLI end to end on fixtures: public JSON has no business names; no network; analyzer imports no provider/store/scan
  for (const f of ['scripts/day1-analyze.js', 'scripts/lib/day1-analysis.js', 'scripts/lib/day1-common.js']) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /providers\/|store(-pg)?\.js|src\/scan\.js|fetch\(|OPENAI|GEMINI/, f);
  const out = fresh(); const il = mkRun('IL-1', 1, same(['1. **דנטל פלוס** – מצוין\n2. **רופא אחר** – טוב', none, none, none, none])); const biz = mkBiz({ 0: { name: 'דנטל פלוס', aliases: ['Dental Plus'] } });
  fs.writeFileSync(C.runFile(out, 'IL-1', 1), JSON.stringify(il)); fs.writeFileSync(path.join(out, 'businesses-IL-1.json'), JSON.stringify({ source: { query: 'x', at: 'y' }, businesses: biz }));
  fs.writeFileSync(C.runFile(out, 'US-1', 1), JSON.stringify({ meta: { ...il.meta, id: 'US-1' }, scan: il.scan })); // wrong questions for US-1: must be invalid
  const p = spawnSync(process.execPath, ['scripts/day1-analyze.js', '--out', out], { env: { PATH: process.env.PATH, OPENAI_API_KEY: 'sk-secret-VALUE' }, encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '..') });
  assert.equal(p.status, 1); assert.match(p.stdout, /IL-1: valid/); assert.match(p.stdout, /US-1: INVALID/); const files = fs.readdirSync(out);
  for (const f of ['results-IL-1.json', 'results-IL-1.md', 'review-IL-1.md', 'results-US-1.json', 'placeholders-all.json']) assert.ok(files.includes(f), f);
  const pubJson = fs.readFileSync(path.join(out, 'results-IL-1.json'), 'utf8') + fs.readFileSync(path.join(out, 'placeholders-all.json'), 'utf8'); for (const b of ['דנטל פלוס', 'Dental Plus', ...BIZ]) assert.ok(!pubJson.includes(b), `public json leaks ${b}`);
  const res = JSON.parse(fs.readFileSync(path.join(out, 'results-IL-1.json'), 'utf8')); assert.equal(res.valid, true); assert.equal(res.cost.recordedInDailyCounter, true); assert.equal(res.placeholders.k_named, 1); assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(out, 'placeholders-all.json'), 'utf8'))), ['IL-1']);
  assert.match(fs.readFileSync(path.join(out, 'results-IL-1.md'), 'utf8'), /דנטל פלוס/); assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'results-US-1.json'), 'utf8')).placeholders, null);
  assert.equal(calls.length, 0); ok('analyzer CLI: aggregates-only public JSON (business names only in .md), invalid market writes valid:false without placeholders, no provider imports, no network');
}
globalThis.fetch = realFetch; TD.done(); console.log(`ALL DAY-1 TESTS PASSED (${n})`);
