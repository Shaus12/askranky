// Scans included in a paid one-time Fix-up order (account.orders[], written by completeProductOrder in server.js):
// 1) the full report (20 questions, PRODUCTS.fixup) right after payment, 2) one re-scan ~30 days later (order.rescanDueAt).
// POST /api/internal/cron/fixup (CRON_SECRET; NOT scheduled by the app), inert unless FIXUP_SCANS_ENABLED=1 (AI cost). Budget caps apply
// (runScan with the product's own check budget + DAILY_SPEND_CAP_USD). The 3 fixes are handed over by a person (status endpoint lists open orders).
// The scan runs on the account's most recent business; an order without one is skipped ('no_business') for manual follow-up. Each step runs once.
import { getDb, save } from './store.js'; import { runScan } from './scan.js'; import { PRODUCTS } from './plans.js';
export const fixupScansEnabled = () => process.env.FIXUP_SCANS_ENABLED === '1';
export async function runFixupScans({ now = new Date(), scan = runScan } = {}) {
  const db = getDb(); const out = { full: 0, rescan: 0, skipped: {} }; const skip = r => { out.skipped[r] = (out.skipped[r] || 0) + 1; };
  for (const a of Object.values(db.accounts)) for (const o of (a.orders || []).filter(o => o.product === 'fixup' && o.status === 'paid')) {
    const step = !o.fullScanId ? 'full' : !o.rescanId && Date.parse(o.rescanDueAt) <= +now ? 'rescan' : null; if (!step) continue;
    const b = Object.values(db.businesses).filter(x => x.accountId === a.id).sort((x, y) => (db.scans[y.scanIds?.at(-1)]?.at || '').localeCompare(db.scans[x.scanIds?.at(-1)]?.at || ''))[0];
    if (!b) { skip('no_business'); continue; }
    try { const s = await scan(a, b, { planOverride: PRODUCTS.fixup }); s.fixupOrder = o.id;
      if (step === 'full') { o.fullScanId = s.id; o.fullScanAt = now.toISOString(); } else { o.rescanId = s.id; o.rescanAt = now.toISOString(); o.status = 'rescanned'; }
      out[step]++; db.events.push({ at: now.toISOString(), type: `order.fixup_${step}`, account: a.id }); save();
    } catch (e) { skip(e.code === 'CAP' ? 'cap' : e.code === 'NO_ENGINE' ? 'no_engine' : 'scan_failed'); }
  }
  return out;
}
