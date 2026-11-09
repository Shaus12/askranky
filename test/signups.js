// status.signups uses the same signup definition as funnel.signup: guests, OWNER_EMAILS and admin-test accounts are not signups.
import assert from 'node:assert/strict';
import { useTempData } from './helpers.js';
const TD = useTempData('signups');
process.env.OWNER_EMAILS = 'owner@t.test';
const { buildStatus } = await import('../src/status.js');
const { buildFunnel } = await import('../src/funnel.js');
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
try {
  const now = new Date('2026-11-09T06:10:00.000Z');
  const iso = now.toISOString();
  const db = { accounts: {
    real: { id: 'real', email: 'real@t.test', plan: 'free', createdAt: iso, usage: {} },
    guest: { id: 'guest', email: null, guest: true, plan: 'free', createdAt: iso, usage: {} },
    own: { id: 'own', email: 'owner@t.test', plan: 'free', createdAt: iso, usage: {} },
    adm: { id: 'adm', email: 'adm@t.test', plan: 'starter', adminTest: true, createdAt: iso, usage: {} },
    tst: { id: 'tst', email: 'tst@t.test', plan: 'starter', testSubscription: true, createdAt: iso, usage: {} },
    pend: { id: 'pend', email: 'pend@t.test', plan: 'free', pendingTest: { at: iso }, createdAt: iso, usage: {} },
    oldie: { id: 'oldie', email: 'old@t.test', plan: 'free', createdAt: '2026-10-01T00:00:00.000Z', usage: {} },
  }, businesses: {}, scans: {}, spend: {}, events: [] };
  const st = buildStatus({ db, now });
  const funnel = buildFunnel(db, now);
  assert.equal(st.signups.total, 2, 'real + older account; guest, owner, adminTest, testSubscription and pendingTest excluded');
  assert.equal(st.signups.today, 1);
  assert.equal(st.signups.last24h, 1);
  assert.equal(funnel.today.signup, 1);
  assert.equal(funnel.total.signup, 2);
  assert.equal(funnel.last30Days.signup, 1, '2026-10-01 is outside the rolling 30 days before 2026-11-09');
  assert.equal(st.sources.direct.signups, 2);
  assert.equal(Object.values(st.sources).reduce((s, r) => s + r.signups, 0), st.signups.total);
  ok('signups.today/total match funnel.signup for guests, owners and admin-test accounts');
  console.log(`signups: ${n} passed`);
} finally { delete process.env.OWNER_EMAILS; TD.done(); }
