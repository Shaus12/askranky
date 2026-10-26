// COMP_ACCOUNTS on an account whose stored subscription has ENDED (e.g. the owner's old 1 ILS test order): converted to comp, ref moved
// to previousSubscriptionRef. Live / in-grace / unsynced subscriptions are never touched. Mock only: no engine, payment or email provider.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('compinactive');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'LIVE_ENGINES', 'ENABLE_USD_BILLING', 'SUMIT_USD_VERIFIED', 'WEEKLY_EMAILS_ENABLED']) delete process.env[k];
process.env.DISABLE_IP_LIMIT = '1'; process.env.UNSUBSCRIBE_SECRET = 'test-unsub-secret-0123456789';
const past = '2026-10-01T00:00:00Z', future = new Date(Date.now() + 10 * 864e5).toISOString();
const acc = (id, email, extra) => ({ id, key: id.padEnd(43, 'k'), email, createdAt: '2026-09-01T00:00:00Z', usage: {}, ...extra });
fs.writeFileSync(TD.dir + '/db.json', JSON.stringify({ accounts: {
  ended: acc('ended', 'ended@t.test', { plan: 'free', previousPlan: 'starter', subscriptionRef: 'SO-T1', status: 'cancelled_ended', testSubscription: true, adminTest: true, paidThrough: past, cancelledAt: past }),
  active: acc('active', 'active@t.test', { plan: 'starter', subscriptionRef: 'SO-A', status: 'active', paidThrough: future }),
  pastdue: acc('pastdue', 'pastdue@t.test', { plan: 'starter', subscriptionRef: 'SO-P', status: 'past_due', pastDueSince: new Date().toISOString(), paidThrough: past }),
  cancin: acc('cancin', 'cancin@t.test', { plan: 'starter', subscriptionRef: 'SO-C', status: 'cancelled', paidThrough: future }),
  unsynced: acc('unsynced', 'unsynced@t.test', { plan: 'starter', subscriptionRef: 'SO-U', status: 'active', testSubscription: true, adminTest: true, paidThrough: past }),
}, businesses: {}, scans: {}, spend: {}, events: [] }));
process.env.COMP_ACCOUNTS = 'ended@t.test:pro,active@t.test:pro,pastdue@t.test:pro,cancin@t.test:pro,unsynced@t.test:pro';
const realFetch = globalThis.fetch; globalThis.fetch = async (u, o) => { if (String(u).startsWith('http://127.0.0.1')) return realFetch(u, o); throw new Error('outbound fetch blocked: ' + u); };
const logs = []; const ol = console.log; console.log = (...a) => { logs.push(a.join(' ')); ol(...a); };
const { default: app, hasActiveSubscription } = await import('../server.js'); const { getDb } = await import('../src/store.js');
const { applyCompAccounts, isComp } = await import('../src/comp.js'); const { buildStatus } = await import('../src/status.js'); const { syncAll } = await import('../src/jobs/billing-sync.js');
const srv = app.listen(0); await new Promise(r => srv.once('listening', r)); const B = 'http://127.0.0.1:' + srv.address().port;
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
const db = getDb(); const A = db.accounts;
try {
  assert.ok(logs.some(l => l.includes('[comp] 1 comp account(s) applied (0 created, 4 skipped: real subscription)'))); ok('startup log: 1 applied, 4 skipped (same log line)');
  const e = A.ended; assert.equal(e.plan, 'pro'); assert.equal(e.comp, true); assert.ok(e.compSince); assert.equal(e.subscriptionRef, undefined); assert.equal(e.previousSubscriptionRef, 'SO-T1');
  assert.equal(e.testSubscription, undefined); assert.equal(e.adminTest, undefined); assert.ok(isComp(e)); ok('ended subscription → comp pro, ref moved to previousSubscriptionRef');
  const ev = db.events.filter(x => x.type === 'account.comp'); assert.equal(ev.length, 1); assert.equal(ev[0].note, 'from inactive subscription'); assert.equal(ev[0].account, 'ended'); assert.ok(!JSON.stringify(db.events).includes('@t.test')); ok('account.comp event with note, no email address');
  for (const [id, ref, plan] of [['active', 'SO-A', 'starter'], ['pastdue', 'SO-P', 'starter'], ['cancin', 'SO-C', 'starter'], ['unsynced', 'SO-U', 'starter']]) { assert.equal(A[id].subscriptionRef, ref); assert.equal(A[id].plan, plan); assert.ok(!A[id].comp); assert.ok(!A[id].previousSubscriptionRef); }
  ok('active / past_due in grace / cancelled within paidThrough / unsynced test order: untouched');
  const snap = JSON.stringify(A), evs = db.events.length; applyCompAccounts(process.env.COMP_ACCOUNTS); applyCompAccounts(process.env.COMP_ACCOUNTS); assert.equal(JSON.stringify(A), snap); assert.equal(db.events.length, evs); ok('repeated startup apply: idempotent');
  const st = buildStatus({ db }); assert.equal(st.subscribers.byPlan.pro, 0); ok('status: converted comp not counted as subscriber / MRR');
  const calls = []; const payments = { sync: async a => { calls.push(['sync', a.id, a.subscriptionRef]); return { active: true }; }, cancel: async a => { calls.push(['cancel', a.id]); } };
  await syncAll({ payments }); assert.ok(!calls.some(c => c[1] === 'ended')); assert.ok(!calls.some(c => String(c[2]).includes('SO-T1'))); assert.equal(A.ended.plan, 'pro'); assert.equal(A.ended.comp, true); ok('billing sync: never syncs/cancels/charges the previous ref, comp plan kept');
  assert.equal(hasActiveSubscription(A.ended), false); ok('comp account not blocked from a real checkout');
  const post = (p, body) => realFetch(B + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const ident = new URL(B + (await post('/checkout', { plan: 'starter', email: 'ended@t.test' })).headers.get('location')).searchParams.get('account');
  const r = await realFetch(`${B}/billing/return?Valid=1&Token=tok&Identifier=${encodeURIComponent(ident)}`, { redirect: 'manual' }); assert.equal(r.status, 200);
  assert.equal(A.ended.plan, 'starter'); assert.ok(A.ended.subscriptionRef && A.ended.subscriptionRef !== 'SO-T1'); assert.equal(A.ended.status, 'active'); assert.ok(!A.ended.comp && !A.ended.compSince); assert.ok(!isComp(A.ended)); assert.equal(hasActiveSubscription(A.ended), true);
  ok('later real checkout (mock) clears comp, new subscription active');
  const snap2 = JSON.stringify(A.ended); applyCompAccounts(process.env.COMP_ACCOUNTS); assert.equal(JSON.stringify(A.ended), snap2); ok('after paying: COMP_ACCOUNTS no longer touches it');
  console.log(`compinactive: ${n} checks passed`);
} finally { srv.close(); }
process.exit(0);
