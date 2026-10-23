// Server-rendered branded pages (navy Ranky look, bilingual, RTL-aware) for routes outside the static Next export:
// /billing/return outcomes and the 404. All text is escaped.
import { esc } from './security/html.js';
export const langOf = (q) => { const l = String(q.query?.lang || '').toLowerCase(); if (l === 'he' || l === 'en') return l;
  const c = /(?:^|;\s*)ranky_lang=(he|en)/.exec(q.get?.('cookie') || ''); if (c) return c[1]; return /\bhe\b|\biw\b/i.test(q.get?.('accept-language') || '') ? 'he' : 'en'; };
const CSS = `*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(120% 80% at 50% 0%,#0a1b4d 0%,#01061a 60%);color:#e6ecff;font-family:Inter,"Plus Jakarta Sans",system-ui,sans-serif;display:flex;flex-direction:column}
[dir=rtl]{font-family:Heebo,Rubik,system-ui,sans-serif}header{display:flex;justify-content:center;padding:28px 16px}header a{color:#fff;font-weight:800;font-size:22px;letter-spacing:-.02em;text-decoration:none}
main{flex:1;display:flex;flex-wrap:wrap;gap:20px;justify-content:center;align-items:center;padding:24px 16px 64px}
.card{max-width:440px;width:100%;padding:36px 30px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);text-align:center}
h1{font-size:clamp(26px,5vw,38px);line-height:1.1;margin:.2em 0 .4em;letter-spacing:-.02em}p{color:#b9c4e4;line-height:1.6;margin:0 0 1.2em}.code{font-size:64px;font-weight:800;color:#5b8cff;margin:0}
.btn{display:inline-block;padding:12px 22px;border-radius:999px;background:#22c55e;color:#03140a;font-weight:700;text-decoration:none;margin:4px}.ghost{background:transparent;color:#cfe0ff;border:1px solid rgba(255,255,255,.25)}
a:focus-visible{outline:2px solid #93c5fd;outline-offset:3px}.err{color:#fecaca}`;
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800&family=Inter:wght@400;700;800&display=swap" rel="stylesheet">';
// blocks: [{ lang, title, text?, err?, links: [[href,label,ghost?]], code? }]
export function branded({ lang = 'en', title, blocks }) {
  const card = b => `<section class="card" lang="${b.lang}" dir="${b.lang === 'he' ? 'rtl' : 'ltr'}">${b.code ? `<p class="code" aria-hidden="true">${esc(b.code)}</p>` : ''}<h1>${esc(b.title)}</h1>${b.text ? `<p>${esc(b.text)}</p>` : ''}${b.err ? `<p class="err">${esc(b.err)}</p>` : ''}${(b.links || []).map(([h, l, g]) => `<a class="btn${g ? ' ghost' : ''}" href="${esc(h)}">${esc(l)}</a>`).join('')}</section>`;
  return `<!doctype html><html lang="${lang}" dir="${lang === 'he' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#01061a"><title>${esc(title)} · Ranky</title>${FONTS}<style>${CSS}</style></head>
<body><header><a href="/${lang}">Ranky</a></header><main>${blocks.map(card).join('')}</main></body></html>`;
}
const BILLING = {
  invalid: { he: ['קישור התשלום לא תקין', 'ייתכן שפג תוקפו או שכבר נעשה בו שימוש.', 'להתחיל מחדש'], en: ['Checkout link invalid', 'It may have expired or already been used.', 'Start again'] },
  failed: { he: ['התשלום נכשל', 'לא חויבת. אפשר לנסות שוב.', 'לנסות שוב'], en: ['Payment failed', 'You were not charged. You can try again.', 'Try again'] },
  error: { he: ['שגיאה בתשלום', 'משהו השתבש מול ספק התשלום. לא בוצע חיוב כפול.', 'חזרה למחירים'], en: ['Payment error', 'Something went wrong with the payment provider.', 'Back to pricing'] },
  ok: { he: ['התשלום התקבל', 'תודה! שלחנו לך במייל קישור פרטי לדשבורד וקבלה.', 'לעמוד הבית'], en: ['Payment received', 'Thanks! Check your inbox: we emailed you a private link to your dashboard and your receipt.', 'Home'] },
  already: { he: ['כבר יש לך מנוי פעיל', 'לא בוצע חיוב. אפשר לנהל את המנוי מלוח הבקרה.', 'ללוח הבקרה'], en: ['You already have an active subscription', 'You were not charged. You can manage your subscription from your dashboard.', 'Go to your dashboard'] },
  prelaunch: { he: ['בקרוב', 'Ranky עדיין לפני השקה, ולכן לא נגבה תשלום. אפשר להצטרף לרשימת ההמתנה.', 'לרשימת ההמתנה'], en: ['Coming soon', 'Ranky is pre-launch, so no payment is taken yet. Join the waitlist instead.', 'Join the waitlist'] },
};
export function billingPage(kind, lang, err = '') {
  const [title, text, cta] = BILLING[kind][lang]; const href = kind === 'ok' ? `/${lang}` : kind === 'prelaunch' ? `/${lang}/checkout` : kind === 'already' ? `/${lang}/login` : `/${lang}#pricing`;
  return branded({ lang, title, blocks: [{ lang, title, text, err, links: [[href, cta]] }] });
}
export function notFoundPage(lang = 'en') {
  const he = { lang: 'he', code: '404', title: 'העמוד לא נמצא', text: 'הקישור שגוי או שהעמוד הועבר.', links: [['/he', 'לעמוד הבית'], ['/he/scan', 'סריקה חינם', true]] };
  const en = { lang: 'en', code: '404', title: 'Page not found', text: 'The link is wrong or the page has moved.', links: [['/en', 'Home'], ['/en/scan', 'Free scan', true]] };
  return branded({ lang, title: lang === 'he' ? 'העמוד לא נמצא' : 'Page not found', blocks: lang === 'he' ? [he, en] : [en, he] });
}
const UNSUB = {
  confirm: { he: ['ביטול הרשמה למיילים', 'לחיצה על הכפתור תפסיק את הדוחות השבועיים ומיילי העדכונים. מיילים הכרחיים (קבלות, כניסה לחשבון) ימשיכו להישלח.', 'ביטול הרשמה'],
    en: ['Unsubscribe from emails', 'This stops weekly reports and update emails. Essential emails (receipts, sign-in links) still arrive.', 'Unsubscribe'] },
  done: { he: ['ההרשמה בוטלה', 'לא נשלח לך יותר דוחות שבועיים או מיילי עדכונים. אפשר להירשם מחדש בכל עת דרך התמיכה.'], en: ['You are unsubscribed', 'We will not send you weekly reports or update emails anymore. You can opt back in anytime via support.'] },
  invalid: { he: ['הקישור לא תקין', 'קישור ביטול ההרשמה שגוי. פנה/י לתמיכה ונבטל ידנית.'], en: ['Invalid link', 'This unsubscribe link is not valid. Contact support and we will remove you manually.'] },
};
// Unsubscribe confirm/done/invalid page (HE RTL + EN). The confirm step is a POST form so link prefetchers can't opt people out.
export function unsubscribePage(kind, lang = 'en', t = '') {
  const [title, text, cta] = UNSUB[kind][lang === 'he' ? 'he' : 'en'];
  const form = cta ? `<form method="post" action="/unsubscribe?t=${encodeURIComponent(t)}&amp;lang=${lang}"><button class="btn" type="submit" style="border:0;cursor:pointer;font:inherit;font-weight:700">${esc(cta)}</button></form>` : '';
  return branded({ lang, title, blocks: [{ lang, title, text, links: [[`/${lang}`, lang === 'he' ? 'לעמוד הבית' : 'Home', !!cta]] }] }).replace('</section>', form + '</section>');
}
