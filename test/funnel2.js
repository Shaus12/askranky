// Funnel scanStarted is recorded inside runScan, so every scan path counts it (free form, dashboard re-scans, weekly, alerts) and
// scanStarted >= scanDoneSinceTracking. Auto re-scans and Fix-up scans are excluded on both sides. Mock engines only: no AI spend.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import { useTempData } from './helpers.js'; const TD = useTempData('funnel2');
for (const k of ['PRELAUNCH', 'PAYMENTS_PROVIDER', 'SCAN_MODE', 'EMAIL_MODE', 'LIVE_ENGINES']) delete process.env[k];
const { getDb, save, flush } = await import('../src/store.js'); const { runScan } = await import('../src/scan.js'); const { buildFunnel } = await import('../src/funnel.js'); const { PRODUCTS } = await import('../src/plans.js');
let n = 0; const ok = m => { n++; console.log('  ✓', m); };
try {
  const db = getDb(); const old = new Date(Date.now() - 3 * 864e5).toISOString();
  db.events.push({ at: new Date(Date.now() - 2 * 864e5).toISOString(), type: 'funnel.visits', day: old.slice(0, 10), n: 1, u: 1 });
  db.accounts.p1 = { id: 'p1', email: 'p1@t.test', plan: 'agency', usage: {}, createdAt: old }; db.businesses.b1 = { id: 'b1', accountId: 'p1', name: 'Cafe', category: 'Cafe', city: 'Haifa' };
  db.scans.old1 = { id: 'old1', businessId: 'b1', accountId: 'p1', at: old, summary: { score: 1 } }; save(); // backfilled scan from before trackingSince
  const s1 = await runScan(db.accounts.p1, db.businesses.b1); // e.g. a logged-in dashboard re-scan (no funnel event in the route itself)
  db.accounts.p1.usage = {}; const s2 = await runScan(db.accounts.p1, db.businesses.b1, { auto: true }); s2.auto = true;
  db.accounts.p1.usage = {}; const s3 = await runScan(db.accounts.p1, db.businesses.b1, { planOverride: PRODUCTS.fixup }); s3.fixupOrder = 'o1'; save();
  const f = buildFunnel(getDb()).total;
  assert.equal(f.scanStarted, 1); assert.equal(f.scanDone, 2); assert.equal(f.scanDoneSinceTracking, 1); ok('runScan records scan_started for non-auto, non-Fix-up scans; auto + Fix-up excluded on both sides');
  assert.ok(f.scanStarted >= f.scanDoneSinceTracking); ok('scanStarted >= scanDoneSinceTracking; backfilled older scans count only in scanDone');
  const src = fs.readFileSync('server.js', 'utf8'); assert.ok(!src.includes("'funnel.scan_started'")); assert.ok(fs.readFileSync('src/scan.js', 'utf8').includes("'funnel.scan_started'")); ok('scan_started is recorded in one place (src/scan.js), not per route');
  assert.match(fs.readFileSync('src/rescan.js', 'utf8'), /scan\(a, b, \{ auto: true \}\)/); ok('automatic re-scans pass auto: true');
  console.log(`funnel2: ${n} checks passed`);
} finally { await flush?.(); TD.done(); }
