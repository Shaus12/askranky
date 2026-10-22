import type { Locale } from "./i18n";
export const mockReport = (l: Locale) => ({
  business: l === "he" ? { name: "אינסטלציה אקמה", category: "אינסטלטור", city: "תל אביב" } : { name: "Acme Plumbing", category: "Plumber", city: "Austin, TX" },
  score: 28, mentionRate: 0.27, avgRank: 3.4, checks: 15,
  byEngine: [ { engine: "ChatGPT", rate: 0.4 }, { engine: "Gemini", rate: 0.2 }, { engine: "Perplexity", rate: 0.2 } ],
  trend: [28, 36, 46, 52, 57, 63],
  competitors: [ { name: "Radiant Plumbing", count: 11 }, { name: "Reliant Plumbing", count: 9 }, { name: "S&D Plumbing", count: 6 } ],
  sources: [ { host: "yelp.com", count: 9 }, { host: "austinchronicle.com", count: 5 }, { host: "acmeplumbing.com", count: 3, own: true }, { host: "reddit.com", count: 3 } ],
  fixes: l === "he" ? [
    { title: "הוסף תשובה ישירה של 60 מילה לעמוד הבית", why: "מנועי AI מצטטים עמודים שעונים ישירות על השאלה.", copy: "אינסטלציה אקמה היא חברת אינסטלציה מורשית בתל אביב, זמינה 24/7 לתקלות חירום, עם הגעה תוך 60 דקות..." },
    { title: "הופע בכתבה „האינסטלטורים הטובים בתל אביב”", why: "ChatGPT מצטט את הכתבה הזו ב־5 מתוך 15 תשובות.", copy: "שלום, אנחנו אינסטלציה אקמה, נשמח להיכלל ברשימה..." },
    { title: "צור עמוד „אקמה מול Radiant”", why: "עמודי השוואה עוזרים ל־AI להבין במה אתה שונה.", copy: "אקמה מול Radiant: זמני הגעה, מחירים שקופים, אחריות..." },
  ] : [
    { title: "Add a 60-word direct answer to your homepage", why: "AI engines cite pages that answer the question directly.", copy: "Acme Plumbing is a licensed Austin, TX plumber available 24/7 for emergencies, with 60-minute arrival..." },
    { title: "Get listed on “Best plumbers in Austin”", why: "ChatGPT cites this article in 5 of 15 answers.", copy: "Hi, we're Acme Plumbing, a family-run Austin plumber since 2009. We'd love to be considered..." },
    { title: "Create an “Acme vs Radiant” page", why: "Comparison pages help AI understand what makes you different.", copy: "Acme vs Radiant Plumbing: arrival times, upfront pricing, warranty..." },
  ],
});
export const band = (s: number) => (s >= 60 ? "high" : s >= 30 ? "mid" : "low") as "low" | "mid" | "high";
export const bandColor = (s: number) => (s >= 60 ? "#3fbf8a" : s >= 30 ? "#e8b04b" : "#e97a6f");
