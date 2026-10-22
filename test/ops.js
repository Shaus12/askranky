// Daily spend guard + startup config check + ILS-only enforcement for SUMIT.
import assert from 'node:assert/strict'; import { useTempData } from './helpers.js'; const TD = useTempData('ops');
for (const k of ['DAILY_SPEND_CAP_USD', 'SCAN_MODE', 'PAYMENTS_PROVIDER', 'ENABLE_USD_BILLING', 'SUMIT_USD_VERIFIED']) delete process.env[k];
const C = await import('../src/costs.js'); const { getDb, flush } = await import('../src/store.js'); const { checkConfig } = await import('../src/config-check.js'); const { usdBillingEnabled } = await import('../src/currency.js');
const { runScan } = await import('../src/scan.js');
let n = 0; const ok = m => { n++; console.log('  ✓', m); }; const day = new Date().toISOString().slice(0, 10);
try {
  assert.equal(C.dailyCapUsd(), 10); process.env.DAILY_SPEND_CAP_USD = '2.5'; assert.equal(C.dailyCapUsd(), 2.5); process.env.DAILY_SPEND_CAP_USD = 'abc'; assert.equal(C.dailyCapUsd(), 10); ok('DAILY_SPEND_CAP_USD default 10, read per call');
  process.env.DAILY_SPEND_CAP_USD = '1'; const acct = { id: 'a', plan: 'pro', usage: {} }; getDb().spend[day] = 0.99;
  let b = C.checkBudget(acct, ['chatgpt', 'gemini'], 5, ['chatgpt', 'gemini']); assert.equal(b.ok, false); assert.equal(b.capped, true); assert.match(b.reason, /try again tomorrow/i); assert.match(b.reasonHe, /מחר/); ok('live scan over the cap is refused with a friendly HE/EN message');
  b = C.checkBudget(acct, ['chatgpt', 'gemini'], 5, []); assert.equal(b.ok, true); ok('mock-only scans are never capped');
  getDb().spend[day] = 0; b = C.checkBudget(acct, ['chatgpt'], 5, ['chatgpt']); assert.equal(b.ok, true); C.recordSpend(acct, 5, 0.07); assert.equal(getDb().spend[day], 0.07); ok('under the cap: allowed; recorded cost accumulates per UTC day');
  getDb().spend[day] = 5; const s = await runScan({ id: 'm', plan: 'free', usage: {} }, { id: 'b', name: 'X', category: 'Plumber', city: 'Haifa' }); assert.ok(s.id); assert.equal(getDb().spend[day], 5); ok('mock runScan ignores the cap and records $0 spend');
  delete process.env.DAILY_SPEND_CAP_USD;
  // config check
  let r = checkConfig({}); assert.equal(r.ok, true); assert.deepEqual([r.modes.SCAN_MODE, r.modes.PAYMENTS_PROVIDER, r.modes.EMAIL_MODE, r.modes.DATABASE], ['mock', 'mock', 'mock', 'json']); ok('defaults: all mock, JSON store, no errors');
  const SECRET = 'sk-live-SHOULD-NOT-APPEAR';
  r = checkConfig({ SCAN_MODE: 'live', OPENAI_API_KEY: SECRET, PAYMENTS_PROVIDER: 'sumit', SUMIT_API_KEY: SECRET, EMAIL_MODE: 'resend', NODE_ENV: 'production' });
  assert.equal(r.ok, false); const all = JSON.stringify(r); assert.ok(!all.includes(SECRET)); for (const k of ['GEMINI_API_KEY', 'SUMIT_COMPANY_ID', 'SUMIT_WEBHOOK_SECRET', 'BASE_URL', 'RESEND_API_KEY']) assert.ok(r.errors.some(e => e.startsWith(k)), k); ok('missing vars reported by name only; values never printed');
  r = checkConfig({ PAYMENTS_PROVIDER: 'sumit', ENABLE_USD_BILLING: 'true', SUMIT_COMPANY_ID: '1', SUMIT_API_KEY: 'x', SUMIT_PUBLIC_API_KEY: 'x', SUMIT_WEBHOOK_SECRET: 'x', BASE_URL: 'https://askranky.com' }); assert.ok(r.errors.some(e => /ENABLE_USD_BILLING must be false/.test(e))); ok('ENABLE_USD_BILLING=true with SUMIT is a config error');
  { const e = checkConfig({ SCAN_MODE: 'bogus', EMAIL_MODE: 'smtp' }).errors; assert.ok(e.some(x => x.startsWith('SCAN_MODE must'))); assert.ok(e.some(x => x.startsWith('EMAIL_MODE must'))); } ok('invalid mode values rejected');
  process.env.ENABLE_USD_BILLING = 'true'; process.env.PAYMENTS_PROVIDER = 'sumit'; assert.equal(usdBillingEnabled(), false); process.env.SUMIT_USD_VERIFIED = '1'; assert.equal(usdBillingEnabled(), true);
  delete process.env.SUMIT_USD_VERIFIED; delete process.env.PAYMENTS_PROVIDER; assert.equal(usdBillingEnabled(), true); delete process.env.ENABLE_USD_BILLING; ok('SUMIT billing stays ILS-only even if ENABLE_USD_BILLING is flipped (until SUMIT_USD_VERIFIED=1)');
  console.log(`ALL OPS TESTS PASSED (${n})`);
} finally { await flush(); TD.done(); }
