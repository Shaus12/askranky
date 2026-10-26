import type { Locale } from "./i18n";
// Copy for the v3 home sections (Profound-style layout: agent demo, jobs tabs, context bento, feature grid, dashboard preview).
// Same rules as home.ts: no invented customers, logos, testimonials or statistics. Every product mock is an illustration with a
// fictional business and is labelled as such. Only features that exist today are described (live engines: ChatGPT + Gemini).
// Weekly reports are not live yet: never write "weekly tracking" / "מעקב שבועי".

type Step = string;
type Project = { id: string; label: string; prompt: string; steps: Step[]; title: string; lines: [string, string][]; foot: string };
type Job = { id: string; tab: string; title: string; body: string; you: string; ranky: string; head: string; rows: [string, string][]; next: string };

const en = {
  demo: {
    ey: "See Ranky at work", biz: "Sample Dental", seg: ["Scan", "Dashboard"], nav: ["Visibility", "Competitors", "Questions", "Sources", "Fixes"],
    recents: "Recents", working: "Working", done: "Done in", ask: "Ask a question like a customer…", illus: "Illustration · fictional business",
    hint: "An animated product illustration. Pick a project under Recents to replay it.",
    projects: [
      { id: "scan", label: "Visibility scan", prompt: "Check if ChatGPT and Gemini recommend Sample Dental in Holon.",
        steps: ["Writing 20 questions locals ask about dentists in Holon", "Asking ChatGPT with web search", "Asking Gemini with Google Search grounding", "Finding your name, your rank and who is named instead"],
        title: "AI visibility score: 35 / 100", lines: [["ChatGPT", "named in 8 of 20 answers"], ["Gemini", "named in 6 of 20 answers"], ["Best rank", "#3 in “urgent dentist Holon”"]], foot: "Report saved. Next: see who gets picked instead." },
      { id: "comp", label: "Competitor check", prompt: "Who do the engines recommend instead of us?",
        steps: ["Reading every answer from the latest scan", "Matching business names and their variants", "Counting mentions per engine"],
        title: "Named instead of you", lines: [["Clinic A", "7 of 20 answers"], ["Clinic B", "5 of 20 answers"], ["Sample Dental (you)", "3 of 20 answers"]], foot: "Clinic A is cited from 2 review sites you are not listed on." },
      { id: "fix", label: "Fix plan", prompt: "What should I change first to get picked?",
        steps: ["Comparing answers that missed you with the ones that named you", "Checking which sources the engines cited", "Ranking fixes by how often they would have changed the answer"],
        title: "3 fixes, in order", lines: [["1", "Add a direct answer: “Urgent dental care in Holon, evening hours.”"], ["2", "Claim your profile on the 2 review sites the engines cite"], ["3", "Use the same name, category and city on every listing"]], foot: "Copy-ready text included in your report." },
    ] as Project[],
  },
  jobsT: "Ranky does that job for you", jobsS: "It asks the questions, reads every answer, and tells you exactly what to change.",
  jobs: [
    { id: "vis", tab: "Visibility", title: "Know if AI names you, and where", body: "Ranky asks ChatGPT and Gemini the questions your customers ask in your city, then scores how often you are named and how high.",
      you: "Are we showing up when people ask for a dentist in Holon?", ranky: "You were named in 14 of 40 answers. Gemini ranks you lower than ChatGPT.",
      head: "Visibility by engine", rows: [["ChatGPT", "40%"], ["Gemini", "30%"], ["Average rank", "#3.4"]], next: "Run a free scan" },
    { id: "comp", tab: "Competitors", title: "See who gets picked instead", body: "A leaderboard of the businesses the engines recommend across all your scans, and whether each one is rising or falling.",
      you: "Who is beating us?", ranky: "Clinic A is named most often, mainly in questions about urgent care.",
      head: "Competitor leaderboard", rows: [["Clinic A", "▲ 7 mentions"], ["Clinic B", "5 mentions"], ["Clinic C", "▼ 4 mentions"]], next: "See a sample report" },
    { id: "qs", tab: "Questions", title: "Read every answer, question by question", body: "The question explorer shows each engine's answer, whether you were named, your rank, and what changed since the last scan.",
      you: "Which questions are we losing?", ranky: "6 questions name competitors but not you. 2 of them improved since your last scan.",
      head: "Question explorer", rows: [["“Best dentist for implants”", "Not mentioned"], ["“Urgent dentist open now”", "Rank #2 ▲"], ["“Teeth whitening price”", "Rank #4"]], next: "See a sample report" },
    { id: "src", tab: "Sources", title: "Find the sites AI trusts", body: "Ranky lists the sites the engines cited in answers that missed you, so you know exactly where to get listed.",
      you: "Where does Gemini get its information?", ranky: "2 directories and 1 review site were cited in answers without you.",
      head: "Source gaps", rows: [["Review site", "cited 6× without you"], ["City directory", "cited 4× without you"], ["Health portal", "cited 2× without you"]], next: "Run a free scan" },
    { id: "fix", tab: "Fixes", title: "Get 3 fixes you can do today", body: "Every report ends with three concrete changes, with copy-ready text, ordered by impact. No agency needed.",
      you: "Just tell me what to do.", ranky: "Start with a direct-answer paragraph on your home page. Here is the text.",
      head: "Your fix plan", rows: [["1. Direct answer on home page", "Copy text"], ["2. Claim 2 review profiles", "Open list"], ["3. Match name, category, city", "Checklist"]], next: "Run a free scan" },
    { id: "track", tab: "Tracking", title: "Track progress over time", body: "Paid plans re-scan on a schedule and chart your score per engine, so you can see which fixes worked. Export everything to CSV.",
      you: "Did last month's changes work?", ranky: "Your ChatGPT score rose from 28 to 41 across 3 scans.",
      head: "Score by engine", rows: [["Scan 1", "28"], ["Scan 2", "33"], ["Scan 3", "41 ▲"]], next: "See pricing" },
  ] as Job[],
  ctxT: "Built on what AI actually answers", ctxS: "Real questions, real answers, and the facts about your business, kept in one place.",
  ctx: {
    qT: "Know what customers ask AI", qB: "Questions written for your category and city, the way customers phrase them.", qLink: "See the question set",
    qs: ["best dentist in Holon", "urgent dentist open now", "dentist for kids near me", "teeth whitening price", "implant clinic recommended", "dentist with evening hours", "affordable root canal", "dentist that speaks English"],
    vT: "Understand what AI says back", vB: "How often each engine names you, compared with the businesses it picks instead.", vLink: "See a sample report",
    vHead: "Mention rate by engine", you: "You", avg: "Competitor average",
    pT: "Your business, as the engines should see it", pB: "Name, other names, category, city and website: the facts Ranky matches every answer against.", pLink: "Start a scan",
    prof: [["Name", "Sample Dental"], ["Also known as", "S. Dental · סמפל דנטל"], ["Category", "Dentist"], ["City", "Holon"], ["Website", "sample-dental.example"]],
  },
  dataEy: "Real data",
  featT: "Every scan makes the next one smarter", featS: "Each report adds to your history, so you can see what changed and why.",
  feats: [
    ["Score trend per engine", "Your score for ChatGPT and Gemini on one chart, scan after scan.", "dashboard"],
    ["Competitor leaderboard", "Who is named most often, with rising and falling arrows.", "dashboard"],
    ["Question explorer", "Every question with each engine's answer and your rank.", "report"],
    ["Source gaps", "The sites cited in answers that skipped you, with a to-do for each.", "report"],
    ["CSV export", "Download every check to your own spreadsheet.", "pricing"],
    ["Hebrew and English", "Questions, matching and reports in both languages, including Hebrew name variants.", "scan"],
  ] as [string, string, string][],
  ccEy: "Dashboard", ccT: "One dashboard for every business you track", ccS: "Scores, competitors, questions and sources across all your scans. This is an illustration with example numbers.", ccLink: "Sign in to your dashboard",
  cc: { score: "Visibility score", checks: "Checks run", named: "Times named", trend: "Score by engine", lead: "Competitor leaderboard", biz: "Business", men: "Mentions", tr: "Trend", ex: "Example" },
  finalT: "Be the business AI recommends", finalS: "Run a free scan in about a minute. No card, no call.",
};

const he: typeof en = {
  demo: {
    ey: "ראו את Ranky בעבודה", biz: "שן לדוגמה", seg: ["סריקה", "דשבורד"], nav: ["נראות", "מתחרים", "שאלות", "מקורות", "תיקונים"],
    recents: "אחרונים", working: "עובד", done: "הושלם תוך", ask: "שאלו שאלה כמו לקוח…", illus: "המחשה · עסק פיקטיבי",
    hint: "המחשת מוצר מונפשת. בחרו פרויקט תחת „אחרונים” כדי להפעיל אותה מחדש.",
    projects: [
      { id: "scan", label: "סריקת נראות", prompt: "תבדוק אם ChatGPT ו־Gemini ממליצים על שן לדוגמה בחולון.",
        steps: ["כותב 20 שאלות שתושבים שואלים על רופאי שיניים בחולון", "שואל את ChatGPT עם חיפוש ברשת", "שואל את Gemini עם חיפוש בגוגל", "מאתר את השם שלך, המיקום, ומי הוזכר במקומך"],
        title: "ציון נראות ב־AI: 35 מתוך 100", lines: [["ChatGPT", "הוזכרת ב־8 מתוך 20 תשובות"], ["Gemini", "הוזכרת ב־6 מתוך 20 תשובות"], ["המיקום הטוב ביותר", "מקום 3 ב„רופא שיניים דחוף חולון”"]], foot: "הדוח נשמר. הבא: מי נבחר במקומך." },
      { id: "comp", label: "בדיקת מתחרים", prompt: "את מי המנועים ממליצים במקומנו?",
        steps: ["קורא כל תשובה מהסריקה האחרונה", "מתאים שמות עסקים והווריאציות שלהם", "סופר אזכורים לפי מנוע"],
        title: "הוזכרו במקומך", lines: [["מרפאה א׳", "7 מתוך 20 תשובות"], ["מרפאה ב׳", "5 מתוך 20 תשובות"], ["שן לדוגמה (אתה)", "3 מתוך 20 תשובות"]], foot: "מרפאה א׳ מצוטטת מ־2 אתרי ביקורות שאתה לא רשום בהם." },
      { id: "fix", label: "תוכנית תיקונים", prompt: "מה לשנות קודם כדי שיבחרו בי?",
        steps: ["משווה תשובות שפספסו אותך לאלה שהזכירו אותך", "בודק אילו מקורות המנועים ציטטו", "מדרג תיקונים לפי ההשפעה הצפויה"],
        title: "3 תיקונים, לפי סדר", lines: [["1", "להוסיף תשובה ישירה: „טיפול שיניים דחוף בחולון, זמינות בערב”."], ["2", "לפתוח פרופיל ב־2 אתרי הביקורות שהמנועים מצטטים"], ["3", "אותו שם, תחום ועיר בכל רישום"]], foot: "טקסט מוכן להעתקה מופיע בדוח." },
    ],
  },
  jobsT: "Ranky עושה את העבודה הזו בשבילך", jobsS: "הוא שואל את השאלות, קורא כל תשובה, ואומר לך בדיוק מה לשנות.",
  jobs: [
    { id: "vis", tab: "נראות", title: "לדעת אם ה־AI מזכיר אותך, ובאיזה מקום", body: "Ranky שואל את ChatGPT ו־Gemini את השאלות שהלקוחות שלך שואלים בעיר שלך, ומדרג כמה פעמים הוזכרת ובאיזה מקום.",
      you: "אנחנו מופיעים כשמחפשים רופא שיניים בחולון?", ranky: "הוזכרת ב־14 מתוך 40 תשובות. Gemini מדרג אותך נמוך יותר מ־ChatGPT.",
      head: "נראות לפי מנוע", rows: [["ChatGPT", "40%"], ["Gemini", "30%"], ["מיקום ממוצע", "3.4"]], next: "לסריקה חינם" },
    { id: "comp", tab: "מתחרים", title: "לראות מי נבחר במקומך", body: "טבלת העסקים שהמנועים ממליצים עליהם בכל הסריקות שלך, ואם כל אחד עולה או יורד.",
      you: "מי עוקף אותנו?", ranky: "מרפאה א׳ מוזכרת הכי הרבה, בעיקר בשאלות על טיפול דחוף.",
      head: "טבלת מתחרים", rows: [["מרפאה א׳", "▲ 7 אזכורים"], ["מרפאה ב׳", "5 אזכורים"], ["מרפאה ג׳", "▼ 4 אזכורים"]], next: "לדוח לדוגמה" },
    { id: "qs", tab: "שאלות", title: "לקרוא כל תשובה, שאלה אחרי שאלה", body: "סייר השאלות מציג את התשובה של כל מנוע, אם הוזכרת, באיזה מקום, ומה השתנה מאז הסריקה הקודמת.",
      you: "באילו שאלות אנחנו מפסידים?", ranky: "6 שאלות מזכירות מתחרים ולא אותך. 2 מהן השתפרו מאז הסריקה הקודמת.",
      head: "סייר השאלות", rows: [["„רופא שיניים מומלץ לשתלים”", "לא מוזכר"], ["„רופא שיניים דחוף פתוח עכשיו”", "מקום 2 ▲"], ["„הלבנת שיניים מחיר”", "מקום 4"]], next: "לדוח לדוגמה" },
    { id: "src", tab: "מקורות", title: "למצוא את האתרים שה־AI סומך עליהם", body: "Ranky מציג את האתרים שהמנועים ציטטו בתשובות שלא הזכירו אותך, כדי שתדע בדיוק איפה להירשם.",
      you: "מאיפה Gemini לוקח את המידע?", ranky: "2 אינדקסים ואתר ביקורות אחד צוטטו בתשובות בלעדייך.",
      head: "פערי מקורות", rows: [["אתר ביקורות", "צוטט 6× בלעדייך"], ["אינדקס עירוני", "צוטט 4× בלעדייך"], ["פורטל בריאות", "צוטט 2× בלעדייך"]], next: "לסריקה חינם" },
    { id: "fix", tab: "תיקונים", title: "3 תיקונים שאפשר לעשות היום", body: "כל דוח מסתיים בשלושה שינויים קונקרטיים, עם טקסט מוכן להעתקה, לפי סדר ההשפעה. בלי סוכנות.",
      you: "פשוט תגיד לי מה לעשות.", ranky: "תתחיל מפסקת תשובה ישירה בדף הבית. הנה הטקסט.",
      head: "תוכנית התיקונים שלך", rows: [["1. תשובה ישירה בדף הבית", "העתקת טקסט"], ["2. פרופיל ב־2 אתרי ביקורות", "לרשימה"], ["3. אותו שם, תחום ועיר", "צ׳קליסט"]], next: "לסריקה חינם" },
    { id: "track", tab: "מעקב", title: "לעקוב אחרי ההתקדמות לאורך זמן", body: "בתוכניות בתשלום Ranky סורק שוב לפי לוח זמנים ומציג את הציון לפי מנוע, כדי שתראה אילו תיקונים עבדו. אפשר לייצא הכול ל־CSV.",
      you: "השינויים מהחודש שעבר עבדו?", ranky: "הציון שלך ב־ChatGPT עלה מ־28 ל־41 לאורך 3 סריקות.",
      head: "ציון לפי מנוע", rows: [["סריקה 1", "28"], ["סריקה 2", "33"], ["סריקה 3", "41 ▲"]], next: "למחירים" },
  ],
  ctxT: "בנוי על מה שה־AI באמת עונה", ctxS: "שאלות אמיתיות, תשובות אמיתיות, והעובדות על העסק שלך, במקום אחד.",
  ctx: {
    qT: "לדעת מה לקוחות שואלים את ה־AI", qB: "שאלות שנכתבו לתחום ולעיר שלך, בניסוח של לקוחות.", qLink: "לסט השאלות",
    qs: ["רופא שיניים מומלץ בחולון", "רופא שיניים דחוף פתוח עכשיו", "רופא שיניים לילדים קרוב אליי", "הלבנת שיניים מחיר", "מרפאת שתלים מומלצת", "רופא שיניים עם שעות ערב", "טיפול שורש במחיר סביר", "רופא שיניים דובר אנגלית"],
    vT: "להבין מה ה־AI עונה", vB: "כמה פעמים כל מנוע מזכיר אותך, לעומת העסקים שהוא בוחר במקומך.", vLink: "לדוח לדוגמה",
    vHead: "שיעור אזכור לפי מנוע", you: "אתה", avg: "ממוצע מתחרים",
    pT: "העסק שלך, כמו שהמנועים צריכים לראות אותו", pB: "שם, שמות נוספים, תחום, עיר ואתר: העובדות ש־Ranky מתאים מולן כל תשובה.", pLink: "להתחיל סריקה",
    prof: [["שם", "שן לדוגמה"], ["שמות נוספים", "Sample Dental · ש. דנטל"], ["תחום", "רופא שיניים"], ["עיר", "חולון"], ["אתר", "sample-dental.example"]],
  },
  dataEy: "נתונים אמיתיים",
  featT: "כל סריקה הופכת את הבאה לחכמה יותר", featS: "כל דוח מצטרף להיסטוריה שלך, כדי שתראה מה השתנה ולמה.",
  feats: [
    ["מגמת ציון לפי מנוע", "הציון שלך ב־ChatGPT וב־Gemini בגרף אחד, סריקה אחרי סריקה.", "dashboard"],
    ["טבלת מתחרים", "מי מוזכר הכי הרבה, עם חיצי עלייה וירידה.", "dashboard"],
    ["סייר השאלות", "כל שאלה עם התשובה של כל מנוע והמיקום שלך.", "report"],
    ["פערי מקורות", "האתרים שצוטטו בתשובות שדילגו עליך, עם משימה לכל אחד.", "report"],
    ["ייצוא CSV", "להוריד כל בדיקה לגיליון שלך.", "pricing"],
    ["עברית ואנגלית", "שאלות, התאמת שמות ודוחות בשתי השפות, כולל וריאציות של שמות בעברית.", "scan"],
  ],
  ccEy: "דשבורד", ccT: "דשבורד אחד לכל עסק שאתה עוקב אחריו", ccS: "ציונים, מתחרים, שאלות ומקורות בכל הסריקות שלך. זו המחשה עם מספרים לדוגמה.", ccLink: "כניסה לדשבורד",
  cc: { score: "ציון נראות", checks: "בדיקות שבוצעו", named: "פעמים שהוזכרת", trend: "ציון לפי מנוע", lead: "טבלת מתחרים", biz: "עסק", men: "אזכורים", tr: "מגמה", ex: "דוגמה" },
  finalT: "להיות העסק שה־AI ממליץ עליו", finalS: "סריקה חינם בערך בדקה. בלי כרטיס אשראי, בלי שיחת מכירה.",
};

export const HOME3 = { en, he };
export type Home3 = typeof en;
export const home3For = (l: Locale): Home3 => HOME3[l];
