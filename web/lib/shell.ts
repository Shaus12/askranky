import type { Locale } from "./i18n";
// Labels for the stage-1 site shell (header menus + footer columns). Every link points at a page or section that exists today.
export const SHELL = {
  en: { product: "Product", resources: "Resources", company: "Company", legal: "Legal", menu: "Menu", close: "Close menu", blog: "Blog", allPosts: "All articles", latest: "Latest articles",
    howD: "Questions, engines and score in 60 seconds", sampleD: "What a full report looks like", faqD: "Common questions, short answers", scanD: "ChatGPT · Gemini, free", contact: "Contact",
    tagline: "AI visibility for local businesses. See what ChatGPT and Gemini tell your customers.", feat: "Free AI scan", featD: "60 seconds · ChatGPT · Gemini · score 0–100 · competitors · 3 fixes" },
  he: { product: "מוצר", resources: "משאבים", company: "חברה", legal: "משפטי", menu: "תפריט", close: "סגירת תפריט", blog: "בלוג", allPosts: "כל המאמרים", latest: "מאמרים אחרונים",
    howD: "שאלות, מנועים וציון ב־60 שניות", sampleD: "איך נראה דוח מלא", faqD: "שאלות נפוצות, תשובות קצרות", scanD: "ChatGPT · Gemini, חינם", contact: "צור קשר",
    tagline: "נראות ב־AI לעסקים מקומיים. בודקים מה ChatGPT ו־Gemini עונים ללקוחות שלך.", feat: "סריקת AI חינם", featD: "60 שניות · ChatGPT · Gemini · ציון 0–100 · מתחרים · 3 תיקונים" },
} satisfies Record<Locale, Record<string, string>>;
