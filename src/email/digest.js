// Monthly digest email (HE + EN). Every value from the store is HTML-escaped; links go through safeUrl. Channel 'digest' (one-click unsubscribe).
import { BRAND } from '../brand.js'; import { esc, safeUrl } from '../security/html.js'; import { footer } from './templates.js';
const T = {
  en: { subject: m => `${BRAND.name} monthly summary (${m})`, h: 'Your monthly AI visibility summary', score: 'Score', was: 'was', first: 'first scan, nothing to compare yet', same: 'no change',
    newComp: 'New competitors named by AI', noneNew: 'No new competitors this month.', fix: 'Top fix', report: 'Open the latest report', dash: 'Open your dashboard',
    why: 'You get this monthly summary because it is part of your paid plan.', unsub: 'Stop monthly summaries' },
  he: { subject: m => `סיכום חודשי מ־${BRAND.name} (${m})`, h: 'סיכום הנראות שלך ב־AI החודש', score: 'ציון', was: 'היה', first: 'סריקה ראשונה, עוד אין למה להשוות', same: 'ללא שינוי',
    newComp: 'מתחרים חדשים שה־AI מזכיר', noneNew: 'אין מתחרים חדשים החודש.', fix: 'התיקון הכי חשוב', report: 'לדוח האחרון', dash: 'לדשבורד',
    why: 'הסיכום החודשי נשלח כי הוא חלק מהמסלול בתשלום שלך.', unsub: 'הפסקת הסיכומים החודשיים' },
};
const color = s => (s >= 70 ? '#16a34a' : s >= 40 ? '#d97706' : '#dc2626'); // red / amber / green score scale
export function renderDigestEmail({ items, lang, base, accountId, unsubscribeUrl, month }) {
  const l = lang === 'he' ? 'he' : 'en', t = T[l], he = l === 'he', dir = he ? 'rtl' : 'ltr';
  const delta = i => i.prevScore == null ? t.first : i.score === i.prevScore ? t.same : `${i.score > i.prevScore ? '+' : '−'}${Math.abs(i.score - i.prevScore)} (${t.was} ${i.prevScore})`;
  const blocks = items.map(i => `<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin:0 0 14px">
<h3 style="margin:0 0 6px">${esc(i.business.name)}</h3>
<p style="margin:0 0 8px">${t.score}: <b style="color:${color(i.score)}">${esc(i.score)}</b>/100 · <span dir="auto">${esc(delta(i))}</span></p>
<p style="margin:0 0 8px"><b>${t.newComp}:</b> ${i.newCompetitors.length ? i.newCompetitors.map(esc).join(', ') : t.noneNew}</p>
${i.topFix ? `<p style="margin:0 0 8px"><b>${t.fix}:</b> ${esc(i.topFix.title)}<br><span style="color:#555">${esc(i.topFix.why)}</span></p>` : ''}
<p style="margin:0"><a href="${safeUrl(`${base}/r/${encodeURIComponent(i.scanId)}`)}">${t.report}</a></p></div>`).join('');
  const html = `<!doctype html><html lang="${l}" dir="${dir}"><body dir="${dir}" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111;text-align:${he ? 'right' : 'left'}">
<h2 style="color:${esc(BRAND.color)}">${t.h}</h2>${blocks}
<p><a href="${safeUrl(`${base}/${l}/dashboard/${encodeURIComponent(accountId)}`)}">${t.dash}</a></p>
<p style="color:#888;font-size:12px">${t.why} ${footer(l)} · <a href="${safeUrl(unsubscribeUrl)}">${t.unsub}</a></p></body></html>`;
  return { subject: t.subject(month), html };
}
