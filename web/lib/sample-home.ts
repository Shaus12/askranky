import type { Locale } from "@/lib/i18n";
// Home-page sample report: ILLUSTRATIVE data only (not a real customer, not a real scan). The business and competitor names are masked
// on purpose so nobody reads it as a real hotel. Only the two engines that are live (ChatGPT, Gemini). No prices in it.
export type HomeSample = { name: string; meta: string; score: number; checks: number; mentionRate: number; engines: { engine: string; rate: number }[];
  competitors: { name: string; count: number }[]; fixes: { title: string; why: string }[] };
export const homeSample = (l: Locale): HomeSample => l === "he" ? {
  name: "מלון ███████", meta: "מלונאות · הרצליה", score: 34, checks: 30, mentionRate: 0.33,
  engines: [{ engine: "ChatGPT", rate: 0.4 }, { engine: "Gemini", rate: 0.27 }],
  competitors: [{ name: "מלון ██████ ים", count: 9 }, { name: "████ סוויטס", count: 7 }, { name: "מלון ██████ מרינה", count: 5 }],
  fixes: [
    { title: "הוסיפו לעמוד הבית פסקה של 60 מילה שעונה על „מלון ליד הים בהרצליה”", why: "מנועי AI מעדיפים לצטט עמודים שעונים ישירות על השאלה." },
    { title: "עדכנו את פרופיל העסק בגוגל עם קטגוריה, שעות צ׳ק-אין ותמונות", why: "Gemini נשען הרבה על נתוני Google Business." },
    { title: "בקשו להיכלל בכתבות „המלונות המומלצים בהרצליה”", why: "בדוגמה הזו, ChatGPT ציטט כתבות כאלה ב־4 מתוך 15 תשובות." },
  ],
} : {
  name: "H█████ Hotel", meta: "Hotel · Herzliya", score: 34, checks: 30, mentionRate: 0.33,
  engines: [{ engine: "ChatGPT", rate: 0.4 }, { engine: "Gemini", rate: 0.27 }],
  competitors: [{ name: "S██████ Beach Hotel", count: 9 }, { name: "M████ Suites", count: 7 }, { name: "Hotel ██████ Marina", count: 5 }],
  fixes: [
    { title: "Add a 60-word answer to “hotel near the beach in Herzliya” on your homepage", why: "AI engines prefer to cite pages that answer the question directly." },
    { title: "Complete your Google Business profile: category, check-in hours, photos", why: "Gemini leans heavily on Google Business data." },
    { title: "Ask to be included in “best hotels in Herzliya” articles", why: "In this example, ChatGPT cited such articles in 4 of 15 answers." },
  ],
};
