// Weekly job: re-scan every paid business, email report. Run via cron: `npm run weekly`.
// Every weekly email carries a signed unsubscribe link (+ List-Unsubscribe headers); opted-out accounts are skipped.
import { getDb, flush } from './store.js'; import { runScan } from './scan.js'; import { renderWeeklyEmail } from './email/report.js'; import { sendEmail } from './email/send.js'; import { BRAND } from './brand.js';
import { canSend, unsubUrl, unsubHeaders } from './consent.js';
export async function runWeekly({ base = process.env.BASE_URL || 'http://localhost:3000' } = {}) {
  const db = getDb(); let sent = 0, skipped = 0;
  for (const a of Object.values(db.accounts).filter(a => a.plan !== 'free')) {
    if (!canSend(a, 'weekly')) { skipped++; continue; }
    for (const b of Object.values(db.businesses).filter(b => b.accountId === a.id)) {
      try { const prev = db.scans[b.scanIds?.at(-1)]; const scan = await runScan(a, b); const u = unsubUrl(base, a, 'all', a.lang || 'en');
        await sendEmail({ to: a.email, kind: 'weekly', headers: unsubHeaders(u), subject: `${BRAND.name} weekly: ${b.name} ${scan.summary.score}/100`, html: renderWeeklyEmail({ business: b, scan, prev, reportUrl: `${base}/r/${scan.id}`, unsubscribeUrl: u }) }); sent++;
      } catch (e) { console.error(b.name, e.message); }
    }
  }
  return { sent, skipped };
}
if (process.argv[1]?.endsWith('weekly.js')) { const r = await runWeekly(); await flush(); console.log(`weekly done: ${r.sent} reports, ${r.skipped} opted out`); }
