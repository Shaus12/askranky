import type { Locale } from "./i18n";
// Server-rendered explanatory copy under the scan form (the form itself is client-rendered, so without this /scan has almost no text for crawlers).
export const SCAN_INTRO: Record<Locale, { title: string; lead: string; items: (string | { text: string; href: string; link: string; tail?: string })[]; note: string }> = {
  en: { title: "What the free AI scan checks",
    lead: "Ranky asks ChatGPT and Gemini the questions your customers ask when they look for a business like yours. You see whether your business is named, who is recommended instead, and 3 steps tailored to this scan. No email is required. Add an email for ready-to-copy text, the sites the answers cited, and a copy of the report.",
    items: ["Engines: ChatGPT and Gemini (other engines may be added later).", "5 buyer questions built from your category and city.", "Free: the result and 3 steps are on screen, with no email. If you add an email, one scan per email address, and we email the fuller report.", "Paid plans: Starter asks 15 questions, Pro and Agency ask 20, on ChatGPT and Gemini only. You re-scan from the dashboard within a monthly check budget. Automatic rescans are off.", "Takes about a minute. The result opens on screen.",
      { text: "Only your business category and city are sent to the AI engines, never your email or name. See our ", href: "/en/legal/privacy", link: "Privacy Policy", tail: "." }],
    note: "Results come from the engines' APIs and approximate what people see in the consumer apps. AI answers vary between runs." },
  he: { title: "מה הסריקה החינמית בודקת",
    lead: "Ranky שואלת את ChatGPT ואת Gemini את השאלות שהלקוחות שלכם שואלים כשהם מחפשים עסק כמו שלכם. תראו אם העסק שלכם מוזכר, מי מומלץ במקומכם, ו־3 צעדים שמותאמים לסריקה הזו. בלי אימייל. אם מוסיפים אימייל: טקסט מוכן להעתקה, האתרים שהתשובות ציטטו, ועותק של הדוח.",
    items: ["מנועים: ChatGPT ו־Gemini (ייתכן שנוסיף מנועים נוספים בעתיד).", "5 שאלות של קונים, שנבנות מהתחום והעיר שלכם.", "חינם: התוצאה ו־3 הצעדים על המסך, בלי אימייל. אם מוסיפים אימייל, סריקה אחת לכל כתובת אימייל, ואנחנו שולחים את הדוח המלא.", "במסלולים בתשלום: Starter שואל 15 שאלות, Pro ו-Agency שואלים 20, ב-ChatGPT וב-Gemini בלבד. סריקה חוזרת מהדשבורד, במסגרת תקציב בדיקות חודשי. סריקות חוזרות אוטומטיות כבויות.", "לוקחת כדקה. התוצאה נפתחת על המסך.",
      { text: "למנועי ה־AI נשלחים רק תחום העסק והעיר, אף פעם לא האימייל או השם שלכם. פרטים ב", href: "/he/legal/privacy", link: "מדיניות הפרטיות", tail: "." }],
    note: "התוצאות מגיעות מה־API של המנועים ומקרבות את מה שאנשים רואים באפליקציות. תשובות AI משתנות בין הרצות." },
};
