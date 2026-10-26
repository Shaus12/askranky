// Alert email (HE + EN): one short email per new scan that produced alerts. Part of the paid plan (channel 'alerts', default on,
// one-click unsubscribe). Every alert is a plain sentence, the evidence (quote / numbers) and one thing to do. All values HTML-escaped.
import { BRAND } from '../brand.js'; import { esc, safeUrl } from '../security/html.js'; import { footer } from './templates.js';
const ENG = { chatgpt: 'ChatGPT', gemini: 'Gemini', perplexity: 'Perplexity' };
const en = e => (e || []).map(x => ENG[x] || x).join(', ');
const FACT = { en: { city: 'city', website: 'website', status: 'status', phone: 'phone number', hours: 'opening hours' }, he: { city: 'העיר', website: 'האתר', status: 'הסטטוס', phone: 'הטלפון', hours: 'שעות הפתיחה' } };

export const ALERT_TEXT = {
  en: {
    wrong_fact: (a, b) => a.fact.type === 'status' ? `${en(a.fact.engines)} now says ${b} is "${a.fact.said}".` : `${en(a.fact.engines)} now gives the wrong ${FACT.en[a.fact.type]} for ${b}: "${a.fact.said}"${a.fact.expected ? ` (you told us ${a.fact.expected})` : ''}.`,
    score_drop: a => `Your AI visibility score dropped from ${a.from} to ${a.to}.`,
    engine_lost: a => `${ENG[a.engine] || a.engine} stopped naming you: 0 of ${a.checks} answers (it named you ${a.before} times last scan).`,
    competitor_overtook: a => `${a.name} is now named more often than you: ${a.them} answers vs your ${a.you} (last scan: ${a.themBefore} vs ${a.youBefore}).`,
    tone_drop: a => a.from - a.to >= 20 ? `The tone of answers about you fell from ${a.from > 0 ? '+' : ''}${a.from} to ${a.to > 0 ? '+' : ''}${a.to}.` : 'An answer about you is now negative.',
    todo: { wrong_fact: 'Fix it at the source: your Google Business Profile, your home page and the directories the engines cite.', score_drop: 'Open the report to see which questions you lost.', engine_lost: 'Check the questions this engine answered without you in the question explorer.', competitor_overtook: 'See which sites cite them and get listed there too.', tone_drop: 'Reply to the reviews behind it, and make sure your newest reviews are visible.' },
    subject: (b, n) => `${BRAND.name} alert: ${n === 1 ? 'something changed' : `${n} things changed`} in what AI says about ${b}`,
    h: b => `What changed in AI answers about ${b}`, intro: 'Your latest scan found changes since the previous one:', quote: 'What it said', open: 'Open your dashboard', report: 'See the full report',
    why: 'You get this because alerts are part of your plan.', unsub: 'Stop alert emails',
  },
  he: {
    wrong_fact: (a, b) => a.fact.type === 'status' ? `${en(a.fact.engines)} אומר עכשיו ש${b} „${a.fact.said}”.` : `${en(a.fact.engines)} מציג עכשיו את ${FACT.he[a.fact.type]} הלא נכון של ${b}: „${a.fact.said}”${a.fact.expected ? ` (אצלך: ${a.fact.expected})` : ''}.`,
    score_drop: a => `ציון הנראות שלך ב־AI ירד מ־${a.from} ל־${a.to}.`,
    engine_lost: a => `${ENG[a.engine] || a.engine} הפסיק להזכיר אותך: 0 מתוך ${a.checks} תשובות (בסריקה הקודמת: ${a.before}).`,
    competitor_overtook: a => `${a.name} מוזכר עכשיו יותר ממך: ${a.them} תשובות מול ${a.you} שלך (בסריקה הקודמת: ${a.themBefore} מול ${a.youBefore}).`,
    tone_drop: a => a.from - a.to >= 20 ? `הטון של התשובות עליך ירד מ־${a.from} ל־${a.to}.` : 'תשובה עליך הפכה לשלילית.',
    todo: { wrong_fact: 'תקנו במקור: הפרופיל בגוגל, דף הבית והאינדקסים שהמנועים מצטטים.', score_drop: 'פתחו את הדוח כדי לראות באילו שאלות ירדתם.', engine_lost: 'בדקו בסייר השאלות על מה המנוע הזה ענה בלעדיכם.', competitor_overtook: 'בדקו אילו אתרים מצטטים אותם, והירשמו גם שם.', tone_drop: 'הגיבו לביקורות שמאחורי זה, ודאגו שהביקורות החדשות שלכם יהיו גלויות.' },
    subject: (b, n) => `התראה מ־${BRAND.name}: ${n === 1 ? 'משהו השתנה' : `${n} דברים השתנו`} במה שה־AI אומר על ${b}`,
    h: b => `מה השתנה בתשובות ה־AI על ${b}`, intro: 'הסריקה האחרונה מצאה שינויים מאז הקודמת:', quote: 'מה נאמר', open: 'לדשבורד', report: 'לדוח המלא',
    why: 'המייל נשלח כי התראות הן חלק מהמסלול שלך.', unsub: 'הפסקת מיילים של התראות',
  },
};
export const alertSentence = (a, business, lang) => ALERT_TEXT[lang === 'he' ? 'he' : 'en'][a.type]?.(a, business.name) || '';

export function renderAlertEmail({ business, scan, alerts, lang, base, accountId, unsubscribeUrl }) {
  const l = lang === 'he' ? 'he' : 'en', t = ALERT_TEXT[l], he = l === 'he', dir = he ? 'rtl' : 'ltr';
  const quoteOf = a => a.fact?.quote || a.example?.text || '';
  const items = alerts.map(a => `<li style="margin:0 0 14px"><b style="color:${a.severity === 'high' ? '#b42318' : '#111'}">${esc(alertSentence(a, business, l))}</b>
${quoteOf(a) ? `<br><span style="color:#555">${t.quote}: “${esc(quoteOf(a))}”</span>` : ''}<br><span style="color:#333">${esc(t.todo[a.type] || '')}</span></li>`).join('');
  const html = `<!doctype html><html lang="${l}" dir="${dir}"><body dir="${dir}" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111;text-align:${he ? 'right' : 'left'}">
<h2 style="color:${esc(BRAND.color)}">${esc(t.h(business.name))}</h2><p>${t.intro}</p><ul style="padding-${he ? 'right' : 'left'}:18px">${items}</ul>
<p><a href="${safeUrl(`${base}/${l}/dashboard/${encodeURIComponent(accountId)}`)}">${t.open}</a> · <a href="${safeUrl(`${base}/r/${encodeURIComponent(scan.id)}`)}">${t.report}</a></p>
<p style="color:#888;font-size:12px">${t.why} ${footer(l)} · <a href="${safeUrl(unsubscribeUrl)}">${t.unsub}</a></p></body></html>`;
  return { subject: t.subject(business.name, alerts.length), html };
}
