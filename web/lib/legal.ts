import type { Locale } from "./i18n";
// Public legal documents. Each has its own static page at /{lang}/legal/{doc}; the server (src/legal.js) fills in the
// document text from legal/*.md at request time. COMPLIANCE-NOTES is internal and intentionally not listed.
export const LEGAL_DOCS = ["terms", "privacy", "refunds", "disclaimer", "accessibility"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
export const isLegalDoc = (d: string): d is LegalDoc => (LEGAL_DOCS as readonly string[]).includes(d);
export const LEGAL_META: Record<LegalDoc, Record<Locale, { title: string; desc: string }>> = {
  terms: { en: { title: "Terms of Service", desc: "The terms that apply when you use Ranky: the service, accounts and plans, payments and renewal, cancellation, acceptable use and liability." },
    he: { title: "תנאי שימוש", desc: "התנאים החלים על השימוש ב־Ranky: השירות, חשבונות ותוכניות, תשלום וחידוש, ביטול, שימוש הוגן ואחריות." } },
  privacy: { en: { title: "Privacy Policy", desc: "What personal data Ranky collects, why, who processes it, how long it is kept, and your rights." },
    he: { title: "מדיניות פרטיות", desc: "איזה מידע אישי Ranky אוסף, למה, מי מעבד אותו, כמה זמן הוא נשמר, ומה הזכויות שלך." } },
  refunds: { en: { title: "Refund and Cancellation Policy", desc: "How to cancel a Ranky subscription, when refunds apply, and how renewals and billing issues are handled." },
    he: { title: "מדיניות ביטול והחזרים", desc: "איך מבטלים מנוי ב־Ranky, מתי מגיע החזר כספי, ואיך מטפלים בחידושים ובבעיות חיוב." } },
  disclaimer: { en: { title: "AI Results Disclaimer", desc: "Why Ranky's AI visibility results are an approximation: third-party AI systems vary between runs, places and time, and may differ from consumer apps." },
    he: { title: "הבהרה על תוצאות AI", desc: "למה תוצאות הנראות ב־AI של Ranky הן קירוב: מערכות AI של צדדים שלישיים משתנות בין הרצות, מיקומים וזמנים, ועשויות להיות שונות מהאפליקציות לצרכנים." } },
  accessibility: { en: { title: "Accessibility Statement", desc: "Ranky's accessibility commitment, the standard we aim for, known limitations, and how to contact the accessibility coordinator." },
    he: { title: "הצהרת נגישות", desc: "מחויבות הנגישות של Ranky, התקן שאליו אנחנו שואפים, מגבלות ידועות, ואיך לפנות לרכז הנגישות." } },
};
