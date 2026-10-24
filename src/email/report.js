import { engineNote } from '../engine-note.js'; import { zeroNotice } from '../summary.js'; import { BRAND } from '../brand.js'; import { esc, safeUrl } from '../security/html.js';
// Text for the scan-report / weekly emails, HE + EN. All values are escaped where they are interpolated.
const T = {
  en: { h2: { report: 'AI visibility report', weekly: 'weekly report' }, subject: { report: (b, sc) => `Your ${BRAND.name} report: ${b} scored ${sc}/100`, weekly: (b, sc) => `${BRAND.name} weekly: ${b} ${sc}/100` },
    mention: (pct, n, rank) => `Mentioned in <b>${pct}%</b> of ${n} AI answers. Average position: <b>${rank ?? 'not ranked'}</b>.`, th: ['Engine', 'Mentions', 'Avg rank'], instead: 'Who AI recommends instead', times: 'x',
    fixes: { report: 'Your 3 fixes', weekly: "This week's 3 fixes" }, full: 'See the full report →', disclaimer: "Results come from the engines' APIs and can differ from the consumer apps.", mock: '[MOCK DATA] ', unsub: 'Unsubscribe' },
  he: { h2: { report: 'דוח נראות ב-AI', weekly: 'הדוח השבועי' }, subject: { report: (b, sc) => `הדוח שלך מ-${BRAND.name}: ${b} קיבל ${sc}/100`, weekly: (b, sc) => `הדוח השבועי של ${BRAND.name}: ${b} ${sc}/100` },
    mention: (pct, n, rank) => `העסק הוזכר ב-<b>${pct}%</b> מתוך ${n} תשובות AI. מיקום ממוצע: <b>${rank ?? 'ללא דירוג'}</b>.`, th: ['מנוע', 'אזכורים', 'דירוג ממוצע'], instead: 'את מי ה-AI ממליץ במקומך', times: '×',
    fixes: { report: '3 התיקונים שלך', weekly: '3 התיקונים של השבוע' }, full: 'לדוח המלא ←', disclaimer: 'התוצאות מגיעות מה-API של המנועים ועשויות להיות שונות מהאפליקציות הצרכניות.', mock: '[נתוני דמו] ', unsub: 'הסרה מהרשימה' },
};
const L = lang => (lang === 'he' ? 'he' : 'en');
export const reportSubject = ({ variant = 'weekly', lang, business, scan }) => T[L(lang)].subject[variant === 'report' ? 'report' : 'weekly'](business.name, +scan.summary.score);
// variant 'weekly' (default, the paid-plan weekly job) or 'report' (the one-off report right after a scan). lang: 'he' (RTL) or 'en' (default).
export function renderWeeklyEmail({ business, scan, prev, reportUrl, unsubscribeUrl, variant = 'weekly', lang }) {
  const l = L(lang), t = T[l], he = l === 'he', v = variant === 'report' ? 'report' : 'weekly';
  const s = scan.summary; const delta = prev ? s.score - prev.summary.score : null;
  const eng = Object.entries(s.byEngine).map(([e, x]) => `<tr><td>${esc(e)}</td><td><span dir="ltr">${+x.mentions}/${+x.checks}</span></td><td>${esc(x.avgRank ?? '–')}</td></tr>`).join('');
  const entity = he ? BRAND.legalEntityHe : BRAND.legalEntity, addr = he ? BRAND.addressHe : BRAND.address;
  return `<!doctype html><html lang="${l}" dir="${he ? 'rtl' : 'ltr'}"><body dir="${he ? 'rtl' : 'ltr'}" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111;text-align:${he ? 'right' : 'left'}">
<h2 style="color:${esc(BRAND.color)}">${he ? `${t.h2[v]} של ${esc(BRAND.name)}` : `${esc(BRAND.name)} ${t.h2[v]}`}: ${esc(business.name)}</h2>
<p style="font-size:40px;margin:0"><span dir="ltr"><b>${+s.score}</b>/100</span> ${delta === null ? '' : `<span dir="ltr" style="font-size:18px;color:${delta >= 0 ? 'green' : 'red'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}</span>`}</p>
<p>${t.mention(Math.round(s.mentionRate * 100), +s.checks, s.avgRank === undefined || s.avgRank === null ? null : esc(s.avgRank))}</p>
<p style="color:#555;font-size:13px">${esc(engineNote(s, l))}</p>
${zeroNotice(s, business, l) ? `<p data-zero-notice style="background:#fff7e6;border:1px solid #f0c36d;padding:10px;border-radius:6px">${esc(zeroNotice(s, business, l))}</p>` : ''}
<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>${t.th[0]}</th><th>${t.th[1]}</th><th>${t.th[2]}</th></tr>${eng}</table>
<h3>${t.instead}</h3><ol>${s.topCompetitors.map(c => `<li>${esc(c.name)} (<span dir="ltr">${+c.count}${t.times}</span>)</li>`).join('')}</ol>
<h3>${t.fixes[v]}</h3>${scan.fixes.map((f, i) => `<p dir="auto"><b>${i + 1}. ${esc(f.title)}</b><br>${esc(f.why)}</p><pre dir="auto" style="background:#f4f4f5;padding:8px;white-space:pre-wrap">${esc(f.copy)}</pre>`).join('')}
<p><a href="${safeUrl(reportUrl)}">${t.full}</a></p>
<p style="color:#888;font-size:12px">${scan.mock ? t.mock : ''}${t.disclaimer} ${esc(BRAND.name)} · ${esc(entity)} · ${esc(addr)} · ${unsubscribeUrl ? `<a href="${safeUrl(unsubscribeUrl)}">${t.unsub}</a>` : ''}</p>
</body></html>`;
}
