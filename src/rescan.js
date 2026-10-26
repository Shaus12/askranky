// Scheduled automatic re-scans for paying accounts (POST /api/internal/cron/rescan, CRON_SECRET; NOT scheduled by the app).
// Inert unless AUTO_RESCAN_ENABLED=1 (every re-scan costs AI credits). Cadence per plan (src/plans.js rescanDays): Starter monthly
// (30 days), Pro and Agency weekly (7 days). Same account rules as the alerts job: paid plan with an ACTIVE subscription
// (hasActiveSubscription), never comp accounts (no unattended spend; they keep manual "Run scan now"). runScan's per-plan monthly
// check budget and the global DAILY_SPEND_CAP_USD still apply, so a cap stops the run without overspending. Sends NO email itself:
// the alerts job (ALERTS_ENABLED) and the monthly digest (MONTHLY_DIGEST_ENABLED) read the scans this job stores.
import { getDb } from './store.js'; import { runScan } from './scan.js'; import { isComp } from './comp.js'; import { hasActiveSubscription } from './subscription.js'; import { PLANS } from './plans.js';
export const autoRescanEnabled = () => process.env.AUTO_RESCAN_ENABLED === '1';
const DAY = 864e5;
export const rescanDaysFor = plan => Number(PLANS[plan]?.rescanDays) || 0;
// Accounts eligible for unattended re-scans (also used by the digest and the dashboard "next scan" date).
export const autoScanEligible = (a, now = Date.now()) => !!a && a.plan !== 'free' && !isComp(a) && hasActiveSubscription(a, now) && rescanDaysFor(a.plan) > 0;
// When the next automatic scan of a business is due (ISO), or null when the account is not eligible.
export function nextScanAt(a, b, db = getDb(), now = Date.now()) {
  if (!autoScanEligible(a, now)) return null; const last = db.scans[b?.scanIds?.at(-1)];
  const t = last ? Date.parse(last.at) + rescanDaysFor(a.plan) * DAY : now; return new Date(Math.max(t, now)).toISOString();
}
export async function runRescans({ now = new Date(), scan = runScan, maxScans = Number(process.env.AUTO_RESCAN_MAX_PER_RUN || 50) } = {}) {
  const db = getDb(); const out = { scanned: 0, skipped: {} }; const skip = r => { out.skipped[r] = (out.skipped[r] || 0) + 1; };
  for (const a of Object.values(db.accounts).filter(a => autoScanEligible(a, +now))) {
    const days = rescanDaysFor(a.plan);
    for (const b of Object.values(db.businesses).filter(b => b.accountId === a.id)) {
      const last = db.scans[b.scanIds?.at(-1)];
      if (last && now - Date.parse(last.at) < days * DAY - 36e5) { skip('not_due'); continue; } // 1h slack so a daily trigger never drifts a day
      if (out.scanned >= maxScans) { skip('run_limit'); continue; }
      try { const s = await scan(a, b); s.auto = true; out.scanned++; db.events.push({ at: now.toISOString(), type: 'scan.auto', account: a.id, business: b.id }); }
      catch (e) { skip(e.code === 'CAP' ? 'cap' : e.code === 'NO_ENGINE' ? 'no_engine' : 'scan_failed'); }
    }
  }
  return out;
}
