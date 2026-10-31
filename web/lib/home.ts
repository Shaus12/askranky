import type { Locale } from "./i18n";
// Copy for the stage-2 home page (Profound-inspired). Rules: no invented customers, logos, testimonials or statistics.
// The only real numbers are from our own scans on 25.10.2026 (Austin 3-4/12, Tel Aviv 1/12, 20 questions × ChatGPT + Gemini via API), shown as directional.
// The hero app window is an illustration with a fictional business and must stay labelled as such.
export const HOME = {
  en: {
    chip: "Our data: how often local businesses get named in AI answers",
    h1a: "Your next customer is asking", h1b: "Make sure the answer is you.",
    lede: "Ranky asks ChatGPT and Gemini the questions your customers ask, then shows where you rank, who gets picked instead, and 3 fixes to climb.",
    how: "How it works",
    win: "ranky / scan", illus: "Illustration · fictional business", biz: "“Sample Plumbing”",
    tabs: ["Scan", "History"], side: ["Visibility score", "Competitors", "Fixes", "Questions", "Reports"], engines: "Engines", recent: "Recent",
    recentQ: ["Plumber in Holon", "Blocked drain price", "Water heater repair"],
    q: "Who is the best emergency plumber in Holon?", meta: "ChatGPT · answered in 6 seconds",
    a1: "Here are a few plumbers customers recommend in the area: ", ca: "Business A", a2: " for emergency call-outs", cite1: "reviews", a3: ", ", cb: "Business B", a4: ", which focuses on water heaters", cite2: "website", a5: ", and ", cc: "Business C", a6: ". Check availability before you call.",
    miss: "“Sample Plumbing” was not named in this answer", fix: "Suggested fix", fixT: "Add a direct-answer paragraph to the home page: “Emergency plumbing in Holon, evening hours.”",
    ask: "Ask another question like a customer…", ex: "Example", score: "AI visibility score", trend: "Visibility over time", you: "You", avg: "Competitor average",
    picked: "Who gets picked instead", youRow: "Sample Plumbing (you)",
    caption: "Illustration only: a fictional business with example numbers, not a real scan.",
    dataTitle: "Real data from our own scans, 25 October 2026", dataLink: "Read our guides",
    stats: [["25-33%", "Austin: ", "3 to 4 of 12", " (about 25-33%), a small directional check, results vary between runs"], ["8%", "Tel Aviv: ", "1 of 12", " named"], ["20 × 2", "Questions per city, in ChatGPT and Gemini via the API", "", ""], ["Directional", "A small directional check of local businesses; we used dental clinics as one example category. Results vary between runs.", "", ""]],
    probEy: "The problem", probT: "Customers no longer scroll ten results. They ask, and get a few names.",
    prob: [["One answer, not a list", "An AI engine recommends a handful of businesses. If you are not there, you are not in the conversation."], ["Google won't tell you", "Regular SEO tools don't show what ChatGPT and Gemini answer about your business."], ["Competitors are already there", "In our small check in Austin and Tel Aviv, most of the local businesses we looked at were not named. Whoever fixes it first gets picked."]],
    methEy: "How we measure", methT: "Full transparency. No black box.", methP: "We use each engine's official API with web search. It is close to the consumer apps, but not identical to them.",
    meth: [["Engines", "ChatGPT · Gemini"], ["Source", "Official API with web search"], ["What the engines get", "Your category and city only"], ["How to read it", "Trends, not a single result"]],
    blogEy: "Guides", blogT: "From the blog", blogAll: "All articles",
  },
  he: {
    chip: "הנתונים שלנו: כמה עסקים מקומיים מוזכרים בתשובות AI",
    h1a: "הלקוח הבא שלך שואל את", h1b: "בוא נדאג שהתשובה תהיה אתה.",
    lede: "Ranky שואל את ChatGPT ו־Gemini את השאלות שהלקוחות שלך שואלים, ומראה איפה אתה מדורג, מי נבחר במקומך, ו־3 תיקונים כדי לטפס.",
    how: "איך זה עובד",
    win: "ranky / סריקה", illus: "המחשה · עסק פיקטיבי", biz: "„אינסטלציה לדוגמה”",
    tabs: ["סריקה", "היסטוריה"], side: ["ציון נראות", "מתחרים", "תיקונים", "שאלות", "דוחות"], engines: "מנועים", recent: "אחרונים",
    recentQ: ["אינסטלטור בחולון", "פתיחת סתימה מחיר", "תיקון דוד"],
    q: "מי האינסטלטור הכי טוב בחולון לתיקון דחוף?", meta: "ChatGPT · ענה תוך 6 שניות",
    a1: "הנה כמה אינסטלטורים שלקוחות ממליצים עליהם באזור: ", ca: "עסק א׳", a2: " בשל זמינות לקריאות חירום", cite1: "ביקורות", a3: ", ", cb: "עסק ב׳", a4: " שמתמחה בדודי מים", cite2: "אתר", a5: ", ו", cc: "עסק ג׳", a6: ". כדאי לבדוק זמינות לפני שמתקשרים.",
    miss: "„אינסטלציה לדוגמה” לא הוזכרה בתשובה הזו", fix: "תיקון מוצע", fixT: "הוסיפו לדף הבית פסקת תשובה ישירה: „אינסטלטור דחוף בחולון, זמינות בערב”.",
    ask: "שאל שאלה נוספת כמו לקוח…", ex: "דוגמה", score: "ציון נראות ב־AI", trend: "נראות לאורך זמן", you: "אתה", avg: "ממוצע מתחרים",
    picked: "מי נבחר במקומך", youRow: "אינסטלציה לדוגמה (אתה)",
    caption: "המחשה בלבד: עסק פיקטיבי ומספרים לדוגמה, לא סריקה אמיתית.",
    dataTitle: "נתונים אמיתיים מהסריקות שלנו, 25 באוקטובר 2026", dataLink: "למדריכים שלנו",
    stats: [["25%-33%", "אוסטין: ", "3 עד 4 מתוך 12", " (כ-25%-33%), בדיקה כיוונית קטנה, התוצאות משתנות בין הרצות"], ["8%", "תל אביב: ", "1 מתוך 12", " הוזכר בשמו"], ["20 × 2", "שאלות בכל עיר, ב־ChatGPT וב־Gemini דרך ה־API", "", ""], ["מגמה", "בדיקה כיוונית קטנה של עסקים מקומיים. כקטגוריה לדוגמה בדקנו מרפאות שיניים. התוצאות משתנות בין הרצות.", "", ""]],
    probEy: "הבעיה", probT: "לקוחות כבר לא גוללים עשר תוצאות. הם שואלים, ומקבלים כמה שמות.",
    prob: [["תשובה אחת במקום רשימה", "מנוע AI ממליץ על כמה עסקים בודדים. אם אתה לא שם, אתה לא קיים בשיחה."], ["גוגל לא מספר לך", "כלי SEO רגילים לא מראים מה ChatGPT ו־Gemini עונים על העסק שלך."], ["המתחרים כבר שם", "בבדיקה הקטנה שלנו באוסטין ובתל אביב, רוב העסקים המקומיים שבדקנו לא הוזכרו בשמם. מי שמתקן קודם, נבחר."]],
    methEy: "איך אנחנו מודדים", methT: "שקיפות מלאה. בלי קופסה שחורה.", methP: "אנחנו משתמשים ב־API הרשמי של כל מנוע עם חיפוש ברשת, שמקרב את האפליקציות לצרכנים, אבל לא זהה להן.",
    meth: [["מנועים", "ChatGPT · Gemini"], ["מקור", "API רשמי עם חיפוש ברשת"], ["מה המנועים מקבלים", "תחום העסק והעיר בלבד"], ["פרשנות", "מגמות, לא תוצאה בודדת"]],
    blogEy: "מחקר ומדריכים", blogT: "מהבלוג", blogAll: "לכל המאמרים",
  },
} as const;
export const homeFor = (l: Locale) => HOME[l];

// Hero headline variant (owner picks). "A" leads with our real Tel Aviv dental sample (research/scans/day1-rerun/results-IL-1.md:
// 12 clinics, 5 questions × ChatGPT + Gemini × 2 runs, 25.10.2026: k_named 1, ChatGPT 1/12 = 8%, Gemini 1/12 = 8%), labelled directional.
// "B" is problem-led with no numbers. Default B until Shai chooses.
export type HeroVariant = "A" | "B";
export const HERO_VARIANT: HeroVariant = "B";
export const HERO = {
  A: {
    he: { rot: false, h1a: "בתל אביב, 11 מתוך 12 מרפאות שיניים שבדקנו לא הוזכרו ב־ChatGPT.", h1b: "העסק שלך מוזכר?",
      lede: "בדיקה כיוונית שלנו מ־25.10.2026: רק 1 מתוך 12 מרפאות הוזכרה בשם (8%), גם ב־ChatGPT וגם ב־Gemini. זה מדגם קטן, לא מחקר. Ranky בודק את אותו הדבר על העסק שלך: איפה אתה מדורג, מי נבחר במקומך, ו־3 תיקונים." },
    en: { rot: false, h1a: "In Tel Aviv, 11 of 12 dental clinics we checked weren't named by ChatGPT.", h1b: "Is your business named?",
      lede: "Our directional check, 25 Oct 2026: only 1 of 12 clinics was named (8%), on ChatGPT and on Gemini. A small sample, not a study. Ranky runs the same check on your business: where you rank, who gets picked instead, and 3 fixes." },
  },
  B: {
    he: { rot: true, h1a: "לקוחות מבקשים המלצה מ־", h1b: "אם אתה לא בתשובה, הם הולכים למתחרה.",
      lede: "כשמישהו שואל את ChatGPT או את Gemini על עסק מקומי, הוא מקבל כמה שמות ולא עשרה קישורים. Ranky בודק אם העסק שלך ביניהם, מי נבחר במקומך, ו־3 תיקונים כדי להיכנס לתשובה." },
    en: { rot: true, h1a: "Customers ask", h1b: "If you're not in the answer, they go to a competitor.",
      lede: "When someone asks ChatGPT or Gemini for a local business, they get a few names, not ten links. Ranky checks whether yours is one of them, who gets picked instead, and 3 fixes to get into the answer." },
  },
} as const;
export const heroFor = (l: Locale, v: HeroVariant = HERO_VARIANT) => HERO[v][l];
