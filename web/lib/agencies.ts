import type { Locale } from "./i18n";
import { PRICES, fmt } from "./prices";
// /{lang}/agencies: informational agency/partner page (copy: Growth, marketing/agency-partner-page-DRAFT-20261031.md).
// Plan numbers are read from the display mirror of src/plans.js (PRICES) or must equal it (test/agencies.js asserts both).
// Pilot (free) and partner 30% approved by Shai 1.11. Still NOT shown: pilot launch timing, commission duration, ₪100/Fix-up partner payout,
// wholesale Fix-up price, founder name, new cancellation/refund wording. No checkout from here: CTA = free scan + contact.
export const AGENCY = { price: PRICES.agency.ILS, businesses: 10, questions: 20, competitors: 5, fixup: 390 };
export const CONTACT_EMAIL = "shaysho1111@gmail.com";
const P = fmt(AGENCY.price, "ILS");
export const AG = {
  he: {
    eyebrow: "לסוכנויות ולשותפים",
    title: "הלקוחות שלכם שואלים: \"למה ChatGPT ממליץ על מישהו אחר?\" עכשיו יש לכם תשובה.",
    sub: "Ranky בודקת מה ChatGPT ו-Gemini עונים כשלקוחות מחפשים עסק מקומי, ומראה לכם, עבור כל לקוח שלכם, מי מומלץ במקומו, אילו מקורות המנועים מצטטים, ומה אפשר לתקן. אתם מציעים ללקוחות שירות נראות ב-AI (GEO), אנחנו עושים את הבדיקה.",
    scan: "הריצו בדיקה חינם על לקוח אחד", contact: "דברו איתנו במייל",
    forTitle: "למי זה מתאים", forList: ["סוכנויות שיווק דיגיטלי שמנהלות עסקים מקומיים", "פרילנסרים ל-SEO ולקידום מקומי", "בוני אתרים ויועצים לעסקים קטנים"],
    checkTitle: "מה בודקים", checkList: ["שאלות אמיתיות שלקוחות שואלים, לפי תחום ועיר, בעברית או באנגלית", "האם הלקוח שלכם מוזכר בתשובות של ChatGPT ו-Gemini", "מי מומלץ במקומו (בלי לייצר \"דירוג\", רק מה שהמנועים ענו)", "אילו אתרים ומקורות המנועים מצטטים", "3 תיקונים מוכנים ליישום"],
    planTitle: "תוכנית Agency",
    rows: [["מחיר", `${P} לחודש (ללא מע"מ, עוסק פטור)`], ["עסקים", `עד ${AGENCY.businesses}`], ["שאלות לכל עסק", `עד ${AGENCY.questions}`], ["מתחרים למעקב לכל עסק", `עד ${AGENCY.competitors}`], ["תדירות", "סריקה חוזרת מהדשבורד, במסגרת תקציב בדיקות חודשי"], ["מנועים", "ChatGPT ו-Gemini"]],
    manual: "דוח לפני/אחרי שאפשר להעביר ללקוח בלי המותג Ranky מופק ידנית, לפי בקשה. אין עדיין white-label אוטומטי (PDF ממותג, דוחות לקוח או סריקה מרובה בממשק).",
    pricing: "לכל המסלולים",
    sellTitle: "איך סוכנויות מוכרות את זה", sell: ["מריצים בדיקה חינם על לקוח אחד ורואים מה המנועים עונים עליו.", "מציגים ללקוח: איפה הוא מוזכר, מי מומלץ במקומו, ומה מקורות המידע.", "מיישמים את התיקונים כחלק מהריטיינר, ובודקים שוב באופן קבוע מהדשבורד."], sellNote: "המחיר ללקוח הקצה נקבע על ידכם.",
    fixTitle: "Fix-up (אופציונלי)", fix: `תיקון חד-פעמי שאנחנו מבצעים: ${fmt(AGENCY.fixup, "ILS")} לעסק.`,
    pilotTitle: "פיילוט לסוכנויות ראשונות", pilot: "אנחנו פותחים פיילוט ל-2-3 סוכנויות בלבד: 30 יום, עד 3 לקוחות קצה, בדיקה בסיסית ובדיקה חוזרת שאנחנו מריצים ידנית, ודוח לפני/אחרי. הפיילוט חינם.",
    partnerTitle: "תוכנית שותפים (לבעלי קהילות ויועצים)", partner: "עמלה של 30% על לקוחות משלמים שהגיעו דרך קישור אישי. שותפים מחויבים לגילוי נאות \"קישור שותפים\", בלי ספאם ובלי פניות פרטיות ללא הסכמה.",
    noTitle: "מה אנחנו לא מבטיחים", no: "אף אחד לא שולט במה שמנועי AI עונים. אנחנו לא מבטיחים מקום ראשון, אזכור או שיעור הופעה מסוים. התשובות משתנות בין הרצות, לכן אנחנו סורקים מחדש ומציגים את המגמה. כרגע נבדקים רק ChatGPT ו-Gemini.",
    faqTitle: "שאלות נפוצות",
    faq: [["אילו מנועים נבדקים?", "ChatGPT ו-Gemini בלבד, דרך ה-API שלהם עם חיפוש ברשת."], ["האם זה דירוג?", "לא. אנחנו מראים מה המנועים ענו בבדיקה מסוימת, לא דירוג קבוע."], ["אפשר להתחיל בלי להתחייב?", "כן. הבדיקה הראשונה חינם, והמנוי חודשי."], ["יש מע\"מ?", "לא, אנחנו עוסק פטור."]] as [string, string][],
    ctaTitle: "רוצים לראות מה ChatGPT ו-Gemini אומרים על אחד הלקוחות שלכם?", ctaScan: "הריצו בדיקה חינם", ctaContact: "השאירו פרטים במייל ונחזור אליכם",
    contactNote: "יצירת קשר:", mailSubject: "Ranky לסוכנויות",
  },
  en: {
    eyebrow: "For agencies and partners",
    title: "Your clients are asking \"Why does ChatGPT recommend someone else?\" Now you can answer.",
    sub: "Ranky checks what ChatGPT and Gemini answer when customers look for a local business, and shows you, for each client, who gets recommended instead, which sources the engines cite, and what to fix. You offer AI-search visibility (GEO) as a service; we run the checks.",
    scan: "Run a free check on one client", contact: "Email us",
    forTitle: "Who it's for", forList: ["Digital marketing agencies serving local businesses", "SEO and local-search freelancers", "Web builders and small-business consultants"],
    checkTitle: "What we check", checkList: ["Real customer questions by category and city, in English or Hebrew", "Whether your client is mentioned by ChatGPT and Gemini", "Who is recommended instead (what the engines answered, not a ranking)", "Which sites and sources the engines cite", "3 ready-to-apply fixes"],
    planTitle: "Agency plan",
    rows: [["Price", `${P}/month, billed in ILS (no VAT)`], ["Businesses", `up to ${AGENCY.businesses}`], ["Questions per business", `up to ${AGENCY.questions}`], ["Competitors tracked per business", `up to ${AGENCY.competitors}`], ["Frequency", "Re-scan from the dashboard within a monthly check budget"], ["Engines", "ChatGPT and Gemini"]],
    manual: "A before/after report you can pass to your client without Ranky branding is prepared manually, on request. There is no automatic white-label yet (no branded PDF, client reports or multi-scan in the app).",
    pricing: "See all plans",
    sellTitle: "How agencies sell it", sell: ["Run a free check on one client and see what the engines say.", "Show the client where they appear, who is recommended instead, and which sources are cited.", "Apply the fixes as part of your retainer and re-check regularly from the dashboard."], sellNote: "You set the price to your client.",
    fixTitle: "Fix-up (optional)", fix: `One-time fix we carry out: ${fmt(AGENCY.fixup, "ILS")} per business.`,
    pilotTitle: "Early agency pilot", pilot: "Open to 2–3 agencies only: 30 days, up to 3 client businesses, a baseline check and one re-check we run by hand, a before/after report. The pilot is free.",
    partnerTitle: "Partner program", partner: "30% commission on paying customers referred through a personal link. Partners must disclose \"affiliate link\"; no spam or unsolicited private messages.",
    noTitle: "What we don't promise", no: "Nobody controls what AI engines answer. We don't guarantee a top spot, a mention, or any mention rate. Answers vary between runs, so we re-scan and show the trend. Today we check ChatGPT and Gemini only.",
    faqTitle: "FAQ",
    faq: [["Which engines?", "ChatGPT and Gemini only, via their APIs with web search."], ["Is this a ranking?", "No. It's what the engines answered in a given check."], ["Can I start without committing?", "Yes: the first check is free; plans are monthly."]] as [string, string][],
    ctaTitle: "Want to see what ChatGPT and Gemini say about one of your clients?", ctaScan: "Run a free check", ctaContact: "Email us your details and we'll get back to you",
    contactNote: "Contact:", mailSubject: "Ranky for agencies",
  },
} satisfies Record<Locale, unknown>;
export const agencyFaqJsonLd = (lang: Locale) => ({ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: lang === "he" ? "he-IL" : "en-US",
  mainEntity: AG[lang].faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
