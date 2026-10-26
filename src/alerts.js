// Alert emails: re-scan paid businesses on a schedule and email the alerts each new scan produced (detection: src/alert-detect.js).
// Driven by POST /api/internal/cron/alerts (NOT scheduled anywhere) and inert unless ALERTS_ENABLED=1, because it re-scans (AI cost).
import { getDb, save } from './store.js'; import { runScan } from './scan.js'; import { isComp } from './comp.js'; import { hasActiveSubscription } from './subscription.js';
import { canSend, unsubUrl, unsubHeaders } from './consent.js'; import { renderAlertEmail } from './email/alerts.js';
export { detectAlerts } from './alert-detect.js';

export const alertsEnabled = () => process.env.ALERTS_ENABLED === '1';
const DAY = 864e5;
// Re-scan paid businesses whose last scan is older than ALERT_SCAN_DAYS (default 7) and email the alerts that scan produced.
// Same account rules as the weekly job: paid plan with an ACTIVE subscription (an ended/unpaid one is not re-scanned at our cost), not comp (no unattended spend), not unsubscribed from 'alerts'. Budget caps still apply (runScan).
export async function runAlerts({ base = process.env.BASE_URL || 'http://localhost:3000', now = new Date(), send, allow = () => true, days = Number(process.env.ALERT_SCAN_DAYS || 7) } = {}) {
  const db = getDb(); const out = { scanned: 0, alerted: 0, skipped: {} }; const skip = r => { out.skipped[r] = (out.skipped[r] || 0) + 1; };
  for (const a of Object.values(db.accounts).filter(a => a.plan !== 'free' && !isComp(a) && hasActiveSubscription(a, +now))) {
    if (!canSend(a, 'alerts')) { skip('opted_out'); continue; }
    for (const b of Object.values(db.businesses).filter(b => b.accountId === a.id)) {
      const last = db.scans[b.scanIds?.at(-1)];
      if (last && now - Date.parse(last.at) < days * DAY) { skip('fresh'); continue; }
      let scan; try { scan = await runScan(a, b); out.scanned++; } catch (e) { skip(e.code === 'CAP' ? 'cap' : e.code === 'NO_ENGINE' ? 'no_engine' : 'scan_failed'); continue; }
      if (!scan.alerts?.length) continue;
      if (!allow(a)) { skip('rate_limited'); continue; }
      const lang = a.lang === 'he' || a.lang === 'en' ? a.lang : last?.lang === 'he' ? 'he' : 'en'; const u = unsubUrl(base, a, 'alerts', lang);
      const m = renderAlertEmail({ business: b, scan, alerts: scan.alerts, lang, base, accountId: a.id, unsubscribeUrl: u });
      scan.alertsSentAt = now.toISOString(); save(); // at most once per scan
      const sent = await send({ to: a.email, kind: 'alerts', headers: unsubHeaders(u), subject: m.subject, html: m.html });
      db.events.push({ at: now.toISOString(), type: sent ? 'email.alerts_sent' : 'email.alerts_failed', account: a.id, business: b.id, alerts: scan.alerts.length }); save();
      if (sent) out.alerted++; else skip('send_failed');
    }
  }
  return out;
}
