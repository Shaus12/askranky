// Strings for the cookie / local-storage notice and the footer links (kept out of i18n.ts on purpose).
import type { Locale } from "./i18n";
export const consentText = {
  en: {
    region: "Cookie notice", title: "Cookies and local storage",
    body: "We use only strictly necessary and functional storage: your language and currency choice, your scan session, bot protection and your accessibility settings. No analytics, no advertising, no tracking.",
    ok: "OK, got it", policy: "Cookie policy", settings: "Cookie settings", footerPolicy: "Cookies",
    detailsTitle: "What is stored", essential: "Strictly necessary: session data for your scan or dashboard, bot protection (Cloudflare Turnstile) and your choice on this notice. Always on.",
    functional: "Functional: language and currency, and accessibility settings, saved only after you choose them.",
    none: "Optional categories (analytics, advertising): none are used, so there is nothing to accept or reject.",
    gpc: "Your browser sends a Global Privacy Control signal. We do not sell or share personal data, so there is nothing to switch off.",
    gpcNo: "We do not sell or share personal data. If your browser sends a Global Privacy Control signal we treat it as an opt-out request.",
    saved: "Notice acknowledged on", close: "Close",
  },
  he: {
    region: "הודעת עוגיות", title: "עוגיות ואחסון מקומי",
    body: "אנחנו משתמשים רק באחסון הכרחי ופונקציונלי: בחירת השפה והמטבע, סשן הסריקה שלך, הגנת בוטים והגדרות הנגישות שלך. בלי אנליטיקה, בלי פרסום ובלי מעקב.",
    ok: "אישור, הבנתי", policy: "מדיניות עוגיות", settings: "הגדרות עוגיות", footerPolicy: "עוגיות",
    detailsTitle: "מה נשמר", essential: "הכרחי: נתוני סשן לסריקה או ללוח הבקרה, הגנת בוטים (Cloudflare Turnstile) ובחירתך בהודעה זו. תמיד פעיל.",
    functional: "פונקציונלי: שפה ומטבע, והגדרות נגישות, נשמרים רק אחרי שבחרת בהם.",
    none: "קטגוריות אופציונליות (אנליטיקה, פרסום): אין שימוש באף אחת, ולכן אין מה לאשר או לדחות.",
    gpc: "הדפדפן שלך שולח אות Global Privacy Control. איננו מוכרים או משתפים מידע אישי, ולכן אין מה לכבות.",
    gpcNo: "איננו מוכרים או משתפים מידע אישי. אם הדפדפן שלך שולח אות Global Privacy Control, נתייחס אליו כבקשת התנגדות.",
    saved: "ההודעה אושרה בתאריך", close: "סגירה",
  },
} satisfies Record<Locale, Record<string, string>>;
export type ConsentText = (typeof consentText)["en"];
