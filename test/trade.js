// trade1: trade + city form. The ~20-trade list (src/trades.js, mirrored in web/lib/trades.ts) feeds POST /api/scan as `trade`; the scan
// questions then use that trade's field term and question set instead of the generic "עסק מקומי". Old API shape (free-text category or
// none) still works. Mock engines only, outbound fetch blocked.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('trade');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES', 'DISABLE_IP_LIMIT', 'DAILY_SPEND_CAP_USD', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY']) delete process.env[k];
process.env.SCAN_RATE_MAX = '1000'; process.env.UNLOCK_RATE_MAX = '1000'; process.env.DISABLE_IP_LIMIT = '1';
const realFetch = globalThis.fetch;
const { default: app } = await import('../server.js'); const { getDb } = await import('../src/store.js'); const { TRADES, categoryFromBody } = await import('../src/trades.js'); const { buildQuestions } = await import('../src/questions.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
const outbound = []; globalThis.fetch = async (u, o) => { u = String(u); if (u.startsWith(B)) return realFetch(u, o); outbound.push(u); throw new Error('outbound fetch blocked in tests'); };
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const post = (p, body, ip) => realFetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) });
try {
  assert.ok(TRADES.length >= 18 && TRADES.length <= 24); assert.equal(new Set(TRADES.map(t => t.id)).size, TRADES.length);
  assert.ok(!JSON.stringify(TRADES).match(/dent|שיניים/i)); for (const t of TRADES) assert.ok(t.he && t.en && t.heQ && t.enQ && t.set);
  ok(`${TRADES.length} unique trades, each with HE/EN labels + question terms; no dentist`);
  const mirror = fs.readFileSync('web/lib/trades.ts', 'utf8'); const m = JSON.parse(mirror.slice(mirror.indexOf('= [') + 2, mirror.lastIndexOf(']') + 1));
  assert.deepEqual(m, TRADES.map(({ id, he, en }) => ({ id, he, en }))); ok('web/lib/trades.ts mirrors src/trades.js');
  const qs = buildQuestions({ name: 'X', category: 'אינסטלטור', trade: 'plumber', city: 'חיפה', lang: 'he' }, 5);
  assert.equal(qs.length, 5); assert.ok(qs.every(q => q.includes('אינסטלציה') && q.includes('חיפה'))); assert.ok(!qs.join().includes('עסק מקומי'));
  const qe = buildQuestions({ name: 'X', category: 'Restaurant', trade: 'restaurant', city: 'Haifa', lang: 'en' }, 3); assert.ok(qe.every(q => /restaurant/.test(q) && q.includes('Haifa'))); assert.match(qe[1], /dinner/);
  ok('trade questions use the field term + its own set (HE "בתחום אינסטלציה בחיפה"; EN restaurant -> food set)');
  assert.deepEqual(categoryFromBody({ trade: 'lawyer', lang: 'en' }), { category: 'Lawyer', trade: 'lawyer' }); assert.deepEqual(categoryFromBody({ trade: 'nope', category: ' Florist ' }), { category: 'Florist', trade: null });
  assert.deepEqual(categoryFromBody({ trade: 'lawyer' }), { category: 'עורך דין', trade: 'lawyer' }); ok('categoryFromBody: known id -> label; unknown id falls back to free-text category (old shape)');
  const r = await post('/api/scan', { name: 'Sample Pipes', trade: 'plumber', city: 'חיפה', lang: 'he' }, '203.0.113.81'); assert.equal(r.status, 200); const j = await r.json();
  const db = getDb(); const s = db.scans[j.reportId]; const b = db.businesses[s.businessId]; assert.equal(b.trade, 'plumber'); assert.equal(b.category, 'אינסטלטור');
  assert.ok(s.results.every(x => x.question.includes('אינסטלציה'))); ok('guest POST /api/scan {trade}: business.trade stored, category = HE label, every question asks about the trade');
  const old = await (await post('/api/scan', { name: 'Old Shape', city: 'Haifa', lang: 'en' }, '203.0.113.82')).json(); assert.equal(db.businesses[db.scans[old.reportId].businessId].category, 'local business');
  const oc = await (await post('/api/scan', { name: 'Old Shape 2', category: 'Florist', city: 'Haifa', lang: 'en' }, '203.0.113.82')).json(); const ob = db.businesses[db.scans[oc.reportId].businessId]; assert.equal(ob.category, 'Florist'); assert.equal(ob.trade, undefined);
  ok('old API shape still works (no trade -> previous fallback; free-text category kept)');
  const em = await post('/api/scan', { name: 'Email Path', trade: 'accountant', city: 'Haifa', email: 'trade@example.test', lang: 'en' }, '203.0.113.83'); assert.equal(em.status, 200);
  const eb = Object.values(db.businesses).find(x => x.name === 'Email Path'); assert.equal(eb.trade, 'accountant'); assert.equal(eb.category, 'Accountant'); ok('email-up-front path accepts trade without a category field');
  assert.equal(outbound.length, 0);
  const form = fs.readFileSync('web/components/ScanForm.tsx', 'utf8'); assert.match(form, /name="trade"/); assert.match(form, /value="other"/); assert.match(form, /name="category"/);
  assert.ok(!/"category", "website"/.test(form)); ok('form: trade select (+ "other" free text) and city up front; category no longer hidden under more options');
  const rv = fs.readFileSync('web/components/ReportView.tsx', 'utf8'); assert.match(rv, /data-weekly-cta/); assert.match(rv, /checkout\?plan=pro/); assert.match(rv, /cfg\?\.autoRescan \?/); ok('report: weekly re-check CTA -> Pro checkout, wording depends on autoRescan');
  console.log(`trade: ${n} checks passed`);
} finally { srv.close(); TD.done(); }
