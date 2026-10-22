// Weekly job: re-scan every paid business, email report. Run via cron: `npm run weekly`.
import { getDb } from './store.js'; import { runScan } from './scan.js'; import { renderWeeklyEmail } from './email/report.js'; import { sendEmail } from './email/send.js'; import { BRAND } from './brand.js';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const db = getDb(); let n = 0;
for (const a of Object.values(db.accounts).filter(a => a.plan !== 'free')) for (const b of Object.values(db.businesses).filter(b => b.accountId === a.id)) {
  try { const prev = db.scans[b.scanIds?.at(-1)]; const scan = await runScan(a, b);
    await sendEmail({ to: a.email, subject: `${BRAND.name} weekly: ${b.name} ${scan.summary.score}/100`, html: renderWeeklyEmail({ business: b, scan, prev, reportUrl: `${BASE}/r/${scan.id}` }) }); n++;
  } catch (e) { console.error(b.name, e.message); }
}
console.log(`weekly done: ${n} reports`);
