// One automatic follow-up email ~24h after a scan ("Three things that will lift you in ChatGPT answers"). Commercial message (Communications Law s.30A):
// sent ONLY to addresses that ticked the optional, unticked-by-default marketing box on the scan form (canSend(a,'marketing')), subject starts with
// "פרסומת", carries sender identity + postal address + a one-click unsubscribe link. Driven by POST /api/internal/cron/followup (NOT scheduled anywhere),
// inert unless FOLLOWUP_EMAILS_ENABLED=1. Rules per scan: 24h <= age <= 72h, no followupSentAt yet, account not paying, not unsubscribed, and the
// address never got a follow-up before (account.followupSentAt: max ONE per address, ever). The content is that scan's own top 3 fixes (no invented data).
// Discount: NONE by default. The billing layer charges exactly the plan price every month (sumit.js buildChargeRequest refuses any other amount), so a
// discounted first month cannot be honoured today; FOLLOWUP_OFFER_TEXT_HE / _EN (default empty) is an optional line, shown only to addresses whose consent
// text included offers (OFFER_CONSENT_VERSIONS), and must only be set once billing can really charge it.
import { getDb, save } from './store.js'; import { BRAND } from './brand.js'; import { esc, safeUrl } from './security/html.js'; import { footer } from './email/templates.js';
import { canSend, unsubUrl, unsubHeaders } from './consent.js'; import { PLANS, isPaid } from './plans.js';
const HOUR = 36e5; export const FOLLOWUP_MIN_H = 24, FOLLOWUP_MAX_H = 72;
export const followupEmailsEnabled = () => process.env.FOLLOWUP_EMAILS_ENABLED === '1';
export const OFFER_CONSENT_VERSIONS = ['scan-form-2026-10-25'];
const isPaying = a => { if (a?.comp) return true; // comp accounts never get the upgrade follow-up
   const p = PLANS[a?.plan]; return !!p && isPaid(p) && !!a.subscriptionRef && a.status !== 'cancelled'; };
export const offerText = l => String(process.env[l === 'he' ? 'FOLLOWUP_OFFER_TEXT_HE' : 'FOLLOWUP_OFFER_TEXT_EN'] || '').trim().slice(0, 300);
const T = {
  en: { subject: 'פרסומת | Ad: Three things that will lift you in ChatGPT answers', h: b => `Three things that will lift ${b} in ChatGPT answers`,
    intro: sc => `Your recent scan scored <b dir="ltr">${sc}/100</b>. These are the top 3 fixes from that scan:`, report: 'See your full report', plans: 'See plans and start tracking',
    why: 'You get this one-time email because you ticked "send me tips" on the scan form.', unsub: 'Unsubscribe' },
  he: { subject: 'פרסומת: שלושה דברים שיקדמו אותך בתשובות של ChatGPT', h: b => `שלושה דברים שיקדמו את ${b} בתשובות של ChatGPT`,
    intro: sc => `הסריקה האחרונה שלך קיבלה <b dir="ltr">${sc}/100</b>. אלה 3 התיקונים המובילים מהסריקה הזו:`, report: 'לדוח המלא שלך', plans: 'למסלולים ולמעקב שוטף',
    why: 'המייל החד-פעמי הזה נשלח כי סימנת בטופס הסריקה שתרצה לקבל טיפים.', unsub: 'הסרה מרשימת התפוצה' },
};
export function renderFollowup({ business, scan, lang, base, unsubscribeUrl, offer = '' }) {
  const l = lang === 'he' ? 'he' : 'en', t = T[l], he = l === 'he'; const fixes = (scan.fixes || []).slice(0, 3);
  const html = `<!doctype html><html lang="${l}" dir="${he ? 'rtl' : 'ltr'}"><body dir="${he ? 'rtl' : 'ltr'}" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111;text-align:${he ? 'right' : 'left'}">
<h2 style="color:${esc(BRAND.color)}">${esc(t.h(business.name))}</h2>
<p>${t.intro(+scan.summary.score)}</p>
${fixes.map((f, i) => `<p dir="auto"><b>${i + 1}. ${esc(f.title)}</b><br>${esc(f.why)}</p>`).join('')}
<p><a href="${safeUrl(`${base}/r/${encodeURIComponent(scan.id)}`)}">${t.report}</a> · <a href="${safeUrl(`${base}/${l}/checkout?plan=starter`)}">${t.plans}</a></p>
${offer ? `<p data-offer style="background:#fff7e6;border:1px solid #f0c36d;padding:10px;border-radius:6px">${esc(offer)}</p>` : ''}
<p style="color:#888;font-size:12px">${t.why} ${footer(l)} · <a href="${safeUrl(unsubscribeUrl)}">${t.unsub}</a></p></body></html>`;
  return { subject: t.subject, html, fixes: fixes.length };
}
// allow(account) = the shared per-address email rate limit (server.js reportEmailAllowed); send = sendEmailSoft.
export async function runFollowup({ base = process.env.BASE_URL || 'http://localhost:3000', now = new Date(), send, allow = () => true } = {}) {
  const db = getDb(); const T0 = now.getTime(); const out = { sent: 0, skipped: {} }; const skip = r => { out.skipped[r] = (out.skipped[r] || 0) + 1; };
  const scans = Object.values(db.scans || {}).filter(s => s && !s.followupSentAt).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const s of scans) {
    const age = (T0 - Date.parse(s.at)) / HOUR; if (!(age >= FOLLOWUP_MIN_H)) continue; if (age > FOLLOWUP_MAX_H) { skip('window'); continue; }
    const a = db.accounts?.[s.accountId], b = db.businesses?.[s.businessId]; if (!a || !b) { skip('missing'); continue; }
    if (a.followupSentAt) { skip('already_sent'); continue; } if (!canSend(a, 'marketing')) { skip('no_consent'); continue; }
    if (isPaying(a)) { skip('paying'); continue; } if (!(s.fixes || []).length) { skip('no_fixes'); continue; }
    if (!allow(a)) { skip('rate_limited'); continue; }
    const lang = s.lang === 'he' ? 'he' : s.lang === 'en' ? 'en' : a.lang === 'he' ? 'he' : 'en'; const u = unsubUrl(base, a, 'marketing', lang);
    const offer = OFFER_CONSENT_VERSIONS.includes(a.marketingConsent?.version) ? offerText(lang) : '';
    const m = renderFollowup({ business: b, scan: s, lang, base, unsubscribeUrl: u, offer });
    // Mark first (at-most-once): a crash after this line never causes a second email to the same address.
    s.followupSentAt = a.followupSentAt = now.toISOString(); save();
    const ok = await send({ to: a.email, kind: 'marketing', headers: unsubHeaders(u), subject: m.subject, html: m.html });
    db.events.push({ at: now.toISOString(), type: ok ? 'email.followup_sent' : 'email.followup_failed', account: a.id }); save(); if (ok) out.sent++; else skip('send_failed');
  }
  return out;
}
