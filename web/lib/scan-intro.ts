import type { Locale } from "./i18n";
// Server-rendered explanatory copy under the scan form (the form itself is client-rendered, so without this /scan has almost no text for crawlers).
export const SCAN_INTRO: Record<Locale, { title: string; lead: string; items: (string | { text: string; href: string; link: string; tail?: string })[]; note: string }> = {
  en: { title: "What the free AI scan checks",
    lead: "Ranky asks ChatGPT and Gemini the questions your customers ask when they look for a business like yours. You see whether your business is named, who is recommended instead, which sources the answers cite, and 3 concrete fixes.",
    items: ["Engines: ChatGPT and Gemini (other engines may be added later).", "5 buyer questions built from your category and city.", "Free: one scan per email address. Paid plans track you weekly.", "Takes about a minute. The report opens on screen and is emailed to you.",
      { text: "Only your business category and city are sent to the AI engines, never your email or name. See our ", href: "/en/legal/privacy", link: "Privacy Policy", tail: "." }],
    note: "Results come from the engines' APIs and approximate what people see in the consumer apps. AI answers vary between runs." },
  he: { title: "מה הסריקה החינמית בודקת",
    lead: "Ranky שואלת את ChatGPT ואת Gemini את השאלות שהלקוחות שלכם שואלים כשהם מחפשים עסק כמו שלכם. תראו אם העסק שלכם מוזכר, מי מומלץ במקומכם, באילו מקורות התשובות משתמשות, ו־3 תיקונים מעשיים.",
    items: ["מנועים: ChatGPT ו־Gemini (ייתכן שנוסיף מנועים נוספים בעתיד).", "5 שאלות של קונים, שנבנות מהתחום והעיר שלכם.", "חינם: סריקה אחת לכל כתובת אימייל. מסלולים בתשלום עוקבים אחריכם כל שבוע.", "לוקחת כדקה. הדוח נפתח על המסך ונשלח אליכם במייל.",
      { text: "למנועי ה־AI נשלחים רק תחום העסק והעיר, אף פעם לא האימייל או השם שלכם. פרטים ב", href: "/he/legal/privacy", link: "מדיניות הפרטיות", tail: "." }],
    note: "התוצאות מגיעות מה־API של המנועים ומקרבות את מה שאנשים רואים באפליקציות. תשובות AI משתנות בין הרצות." },
};
