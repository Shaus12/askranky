// Monthly email digest for PAYING customers (POST /api/internal/cron/digest, CRON_SECRET; NOT scheduled by the app).
// Inert unless MONTHLY_DIGEST_ENABLED=1. Reads stored scans only (never scans, no AI cost). Per account: score change over the
// last month, competitors that are new since then, and the top fix of the latest scan, per business; HE/EN by account language.
// Idempotent: a.digestMonth = 'YYYY-MM' is written BEFORE sending, so a month never gets two digests (even if a send fails or the
// endpoint is triggered twice). Skips comp accounts, accounts without an ACTIVE subscription, and anyone opted out of 'digest'.
import { getDb, save } from './store.js'; import { canSend, unsubUrl, unsubHeaders } from './consent.js'; import { autoScanEligible } from './rescan.js'; import { renderDigestEmail } from './email/digest.js';
export const digestEnabled = () => process.env.MONTHLY_DIGEST_ENABLED === '1';
const DAY = 864e5; const month = d => d.toISOString().slice(0, 7);
// Pure: compare the newest scan with the newest scan at least ~28 days older (else the oldest one).
export function digestFor(business, scans, now = new Date()) {
  const list = (business.scanIds || []).map(i => scans[i]).filter(s => s && s.summary).sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
  if (!list.length) return null; const cur = list.at(-1); const cutoff = Date.parse(cur.at) - 28 * DAY;
  const base = [...list].reverse().find(s => s !== cur && Date.parse(s.at) <= cutoff) || (list.length > 1 ? list[0] : null);
  const names = s => (s?.summary?.topCompetitors || []).map(c => String(c.name));
  const before = new Set(names(base).map(n => n.toLowerCase()));
  return { business: { id: business.id, name: business.name }, scanId: cur.id, at: cur.at, score: cur.summary.score, prevScore: base ? base.summary.score : null, prevAt: base?.at || null,
    newCompetitors: base ? names(cur).filter(n => !before.has(n.toLowerCase())).slice(0, 3) : [], topFix: cur.fixes?.[0] ? { title: cur.fixes[0].title, why: cur.fixes[0].why } : null, scans: list.length };
}
export async function runDigest({ base = process.env.BASE_URL || 'http://localhost:3000', now = new Date(), send } = {}) {
  const db = getDb(); const out = { sent: 0, skipped: {} }; const skip = r => { out.skipped[r] = (out.skipped[r] || 0) + 1; }; const m = month(now);
  for (const a of Object.values(db.accounts).filter(a => autoScanEligible(a, +now))) {
    if (a.digestMonth === m) { skip('already_sent'); continue; }
    if (!canSend(a, 'digest')) { skip('opted_out'); continue; }
    const items = Object.values(db.businesses).filter(b => b.accountId === a.id).map(b => digestFor(b, db.scans, now)).filter(Boolean);
    if (!items.length) { skip('no_scans'); continue; }
    const lang = a.lang === 'he' ? 'he' : 'en'; const u = unsubUrl(base, a, 'digest', lang);
    const msg = renderDigestEmail({ items, lang, base, accountId: a.id, unsubscribeUrl: u, month: m });
    a.digestMonth = m; save(); // at most once per calendar month (UTC), recorded before the send
    const ok = await send({ to: a.email, kind: 'digest', headers: unsubHeaders(u), subject: msg.subject, html: msg.html });
    db.events.push({ at: now.toISOString(), type: ok ? 'email.digest_sent' : 'email.digest_failed', account: a.id, businesses: items.length }); save();
    if (ok) out.sent++; else skip('send_failed');
  }
  return out;
}
