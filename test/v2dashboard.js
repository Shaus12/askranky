// v2: comp accounts (COMP_ACCOUNTS), dashboard insights + CSV (key guard, no cross-account leaks), USD flag states, "coming soon" engines row.
// Mock only: no engine, payment or email provider is called.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('v2dash');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES', 'ENABLE_USD_BILLING', 'SUMIT_USD_VERIFIED', 'WEEKLY_EMAILS_ENABLED']) delete process.env[k];
process.env.UNSUBSCRIBE_SECRET = 'test-unsub-secret-0123456789';
// Pre-existing paying account in the store before startup: COMP_ACCOUNTS must never touch it.
fs.writeFileSync(TD.dir + '/db.json', JSON.stringify({ accounts: { paid1: { id: 'paid1', key: 'k'.repeat(43), email: 'payer@t.test', plan: 'starter', subscriptionRef: 'SO-1', status: 'active', createdAt: '2026-10-01T00:00:00Z', usage: {} } }, businesses: {}, scans: {}, spend: {}, events: [] }));
process.env.COMP_ACCOUNTS = 'Owner@T.test:pro, payer@t.test:pro, bad-entry, x@y.z:nosuchplan';
const realFetch = globalThis.fetch; globalThis.fetch = async (u, o) => { if (String(u).startsWith('http://127.0.0.1')) return realFetch(u, o); throw new Error('outbound fetch blocked: ' + u); };
const { default: app, hasActiveSubscription, needsPaidLogin } = await import('../server.js'); const { getDb } = await import('../src/store.js');
const { applyCompAccounts, parseCompAccounts, isComp } = await import('../src/comp.js'); const { buildStatus } = await import('../src/status.js'); const { runWeekly } = await import('../src/weekly.js');
const C = await import('../src/currency.js'); const { PLANS } = await import('../src/plans.js'); const { legalDoc } = await import('../src/legal.js'); const D = await import('../src/dashboard.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const db = getDb(); const owner = Object.values(db.accounts).find(a => a.email === 'owner@t.test');

// ---- comp accounts ----
assert.ok(owner && owner.plan === 'pro' && owner.comp === true && !owner.subscriptionRef && owner.key.length >= 32); ok('COMP_ACCOUNTS creates missing account: plan pro, comp:true, no subscriptionRef');
assert.equal(db.accounts.paid1.plan, 'starter'); assert.ok(!db.accounts.paid1.comp); ok('account with a real subscription is never touched');
assert.deepEqual(parseCompAccounts('a@b.co:pro,bad,c@d.co:free,e@f.co:nope'), [{ email: 'a@b.co', plan: 'pro' }]); ok('parser: only valid email + paid plan');
const before = JSON.stringify(owner), evs = db.events.length; applyCompAccounts(process.env.COMP_ACCOUNTS); assert.equal(JSON.stringify(owner), before); assert.equal(db.events.length, evs); assert.equal(Object.values(db.accounts).filter(a => a.email === 'owner@t.test').length, 1); ok('idempotent: second apply changes nothing, no duplicate account/event');
assert.equal(db.events.filter(e => e.type === 'account.comp').length, 1); assert.ok(!JSON.stringify(db.events).includes('owner@t.test')); ok('one account.comp event, without the email');
assert.equal(hasActiveSubscription(owner), false); assert.equal(needsPaidLogin(owner), true); assert.ok(isComp(owner)); ok('comp: checkout not blocked by hasActiveSubscription; scans still need the account session');
const st = buildStatus({ db }); assert.equal(st.subscribers.paying, 1); assert.equal(st.subscribers.byPlan.pro, 0); assert.equal(st.subscribers.mrrIls, 79); ok('status: comp not counted as paying / MRR');
db.businesses.ob = { id: 'ob', accountId: owner.id, name: 'Owner Biz', category: 'cafe', city: 'Tel Aviv', scanIds: [] };
const scansBefore = Object.keys(db.scans).length; await runWeekly({ base: B }); assert.equal(db.businesses.ob.scanIds.length, 0); assert.equal(Object.keys(db.scans).length, scansBefore); ok('weekly cron: no auto scan for comp accounts');
let r = await realFetch(`${B}/api/dashboard/${owner.id}/rescan`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-dashboard-key': owner.key }, body: JSON.stringify({ businessId: 'ob' }) });
assert.equal(r.status, 200); assert.equal(db.businesses.ob.scanIds.length, 1); assert.ok(db.scans[db.businesses.ob.scanIds[0]].mock); ok('manual "Run scan now" works for comp (mock), within plan caps');
r = await (await realFetch(`${B}/api/dashboard/${owner.id}`, { headers: { 'x-dashboard-key': owner.key } })).json(); assert.equal(r.account.comp, true); assert.equal(r.account.active, false); ok('dashboard marks the account complimentary');

// ---- dashboard insights ----
const res = (q, e, mentioned, rank, comps, hosts, answer = `${q} answer by ${e}`) => ({ question: q, engine: e, answer, mentioned, rank, competitors: comps, citations: hosts.map(h => ({ url: `https://${h}/x`, host: h, isOwnSite: h === 'mybiz.co.il' })) });
const mk = (id, bid, acc, at, results, score) => { db.scans[id] = { id, businessId: bid, accountId: acc, at, mock: true, summary: { score, byEngine: {}, engines: { ran: ['chatgpt', 'gemini'], skipped: [] }, topCompetitors: [] }, results }; db.businesses[bid].scanIds.push(id); };
const A = { id: 'accA', key: 'a'.repeat(43), email: 'a@t.test', plan: 'pro', createdAt: 'x', usage: {} }, Bx = { id: 'accB', key: 'b'.repeat(43), email: 'b@t.test', plan: 'pro', createdAt: 'x', usage: {} }; db.accounts.accA = A; db.accounts.accB = Bx;
db.businesses.ba = { id: 'ba', accountId: 'accA', name: 'My Biz', category: 'cafe', city: 'Haifa', scanIds: [] }; db.businesses.bb = { id: 'bb', accountId: 'accB', name: 'Secret B', category: 'gym', city: 'Eilat', scanIds: [] };
mk('s1', 'ba', 'accA', '2026-10-01T10:00:00Z', [res('Q1', 'chatgpt', false, null, ['Rival', 'Other'], ['easy.co.il']), res('Q1', 'gemini', true, 3, ['Rival'], ['b144.co.il'])], 30);
mk('s2', 'ba', 'accA', '2026-10-08T10:00:00Z', [res('Q1', 'chatgpt', true, 1, ['Rival'], ['mybiz.co.il']), res('Q1', 'gemini', true, 2, ['Rival', 'Third'], ['b144.co.il']), res('Q2', 'chatgpt', false, null, ['Rival'], ['easy.co.il', 'easy.co.il']), { question: 'Q2', engine: 'gemini', error: 'boom' }], 60);
mk('sb', 'bb', 'accB', '2026-10-05T10:00:00Z', [res('BQ', 'chatgpt', false, null, ['SecretRival'], ['secret-host.com'], 'TOPSECRET answer')], 0);
const ins = D.dashboardData(db, A)[0];
assert.equal(ins.engineTrend.length, 2); assert.equal(ins.engineTrend[1].byEngine.chatgpt.score, 65); assert.equal(ins.engineTrend[0].byEngine.chatgpt.score, 0); ok('per-engine trend (same score formula, per engine)');
assert.equal(ins.competitors[0].name, 'Rival'); assert.deepEqual(ins.competitors[0].counts, [2, 3]); assert.equal(ins.competitors[0].scans, 2); ok('competitor leaderboard across scans with per-scan counts');
const q1 = ins.questions.find(q => q.question === 'Q1'); assert.equal(q1.engines.chatgpt.change.delta, 1); assert.equal(q1.engines.gemini.change.delta, 1); assert.equal(ins.questions.find(q => q.question === 'Q2').engines.chatgpt.change, null); assert.equal(ins.questions.find(q => q.question === 'Q2').engines.gemini.error, true); ok('question explorer: per-engine answer, mention/rank, change since last scan, errors');
assert.deepEqual(ins.sources.map(s => s.host), ['easy.co.il']); assert.equal(ins.sources[0].missing, 1); ok('source gaps: only hosts cited where the business is missing; own site and duplicates excluded');
const one = D.dashboardData({ businesses: { x: { id: 'x', accountId: 'z', scanIds: ['y'] } }, scans: { y: { id: 'y', businessId: 'x', at: '2026-10-01T00:00:00Z', summary: { score: 5, engines: { ran: ['chatgpt'] } }, results: [] } } }, { id: 'z' })[0];
assert.equal(one.scanCount, 1); assert.deepEqual(one.questions, []); assert.equal(one.engineTrend.length, 1); ok('one scan / empty results handled');
assert.deepEqual(D.dashboardData(db, { id: 'nobody' }), []); ok('account without businesses → empty');
r = await realFetch(`${B}/api/dashboard/accA`, { headers: { 'x-dashboard-key': A.key } }); const ja = await r.text();
assert.equal(r.status, 200); assert.ok(!ja.includes('TOPSECRET') && !ja.includes('Secret B') && !ja.includes('secret-host') && !ja.includes('SecretRival')); ok('API: account A never sees account B data');
assert.equal((await realFetch(`${B}/api/dashboard/accA`, { headers: { 'x-dashboard-key': Bx.key } })).status, 403); assert.equal((await realFetch(`${B}/api/dashboard/accA`)).status, 403); ok('API: wrong/missing key → 403');
r = await realFetch(`${B}/api/dashboard/accA/export.csv?businessId=bb`, { headers: { 'x-dashboard-key': A.key } }); assert.equal(r.status, 404); ok('CSV: other account\'s business → 404');
assert.equal((await realFetch(`${B}/api/dashboard/accA/export.csv?businessId=ba`, { headers: { 'x-dashboard-key': Bx.key } })).status, 403); ok('CSV: wrong key → 403');
r = await realFetch(`${B}/api/dashboard/accA/export.csv?businessId=ba`, { headers: { 'x-dashboard-key': A.key } }); const csv = await r.text();
assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/csv/); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(csv.trim().split('\r\n').length, 7); assert.ok(csv.includes('s2,2026-10-08T10:00:00Z,60,Q1,chatgpt,yes,1')); ok('CSV export: one row per stored result');
db.scans.s2.results[0].competitors = ['=HYPERLINK("x")']; assert.ok(D.dashboardCsv(db, db.businesses.ba).includes(`"'=HYPERLINK(""x"")"`)); ok('CSV: formula injection neutralized');

// ---- USD flag states ----
const fake = h => ({ get: k => h[k.toLowerCase()] });
assert.equal(C.detectCurrency(fake({ 'cf-ipcountry': 'IL' }), 'en').currency, 'ILS'); assert.deepEqual(C.billingFor(PLANS.pro, C.detectCurrency(fake({}), 'en').currency).currency, 'ILS'); ok('flag off: /en charges ILS (unchanged)');
let p = await (await realFetch(`${B}/api/pricing?lang=en`)).json(); assert.equal(p.usdBilling, false); assert.ok(p.plans.filter(x => x.billing).every(x => x.billing.currency === 'ILS')); ok('flag off: /api/pricing bills ILS');
assert.match(legalDoc('terms', 'en').markdown, /charged in ILS at the ILS list price/); ok('flag off: terms text unchanged');
process.env.ENABLE_USD_BILLING = '1'; process.env.PAYMENTS_PROVIDER = 'sumit';
assert.equal(C.usdBillingEnabled(), false); assert.equal(C.detectCurrency(fake({ 'cf-ipcountry': 'IL' }), 'en').currency, 'ILS'); ok('ENABLE_USD_BILLING alone with SUMIT stays off (needs SUMIT_USD_VERIFIED)');
process.env.SUMIT_USD_VERIFIED = '1';
assert.deepEqual(C.detectCurrency(fake({ 'cf-ipcountry': 'IL' }), 'en'), { currency: 'USD', source: 'locale' }); assert.equal(C.detectCurrency(fake({}), 'he').currency, 'ILS'); assert.equal(C.detectCurrency(fake({ cookie: 'ranky_currency=ILS' }), 'en').currency, 'ILS');
assert.deepEqual(C.billingFor(PLANS.pro, 'USD'), { currency: 'USD', amount: 49, displayCurrency: 'USD', displayAmount: 49, fallback: false }); ok('flag on: /en defaults to USD and charges USD; /he ILS; manual toggle wins');
assert.match(legalDoc('terms', 'en').markdown, /English site in US dollars/); assert.match(legalDoc('terms', 'he').markdown, /באנגלית בדולר/); ok('flag on: terms 4.3 USD/FX wording (en + he)');
for (const k of ['ENABLE_USD_BILLING', 'PAYMENTS_PROVIDER', 'SUMIT_USD_VERIFIED']) delete process.env[k];

// ---- coming-soon engines row (source; the exported page is checked when built) ----
const hero = fs.readFileSync(new URL('../web/components/Hero.tsx', import.meta.url), 'utf8');
assert.match(hero, /Perplexity · Copilot · Claude/); assert.match(hero, /\{ name: "ChatGPT" \}, \{ name: "Gemini" \}, \{ name: "Perplexity", soon: true \}, \{ name: "Claude", soon: true \}, \{ name: "Copilot", soon: true \}/); ok('hero: rotator = live ChatGPT/Gemini + Perplexity/Claude/Copilot tagged soon, plus muted coming-soon row');
srv.close(); TD.done(); console.log(`v2dashboard: ${n} passed`);
