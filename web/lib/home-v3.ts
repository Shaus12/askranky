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
    ey: "Fictional illustration", biz: "Sample Plumbing", seg: ["Scan", "Dashboard"], nav: ["Visibility", "Competitors", "Questions", "Sources", "Fixes"],
    recents: "Recents", working: "Working", done: "Done in", ask: "Hypothetical question…", illus: "Illustration · fictional business",
    hint: "Fictional illustration, not a scan and not a result. Free: 5 questions and 3 steps on screen, no email. Optional email adds ready-to-copy text. Paid: Starter 15 questions, Pro and Agency 20, and you re-scan from the dashboard.",
    projects: [
      { id: "scan", label: "Free scan", prompt: "Hypothetical: what if a customer asked ChatGPT for a plumber in a city?",
        steps: ["Asks ChatGPT and Gemini questions for that trade and city", "Reads whether the fictional business was named", "Lists who else was named, without inventing a score"],
        title: "Free result, on screen", lines: [["What you see", "Named or not, and who was named instead"], ["Steps", "3 actions for this business"], ["Email", "Not required"]], foot: "Fictional. Not a measurement and not proof." },
      { id: "comp", label: "Who is named", prompt: "Hypothetical question: who might be named instead?",
        steps: ["Reads the answers from this illustration", "Matches business names and their variants", "Shows other names, not a ranking"],
        title: "Names, not a score", lines: [["Other businesses", "Shown by name when the engines name them"], ["Your business", "Marked named or not"], ["Sources", "Listed only in the fuller report"]], foot: "Fictional. No real business and no measured outcome." },
      { id: "fix", label: "Free vs paid", prompt: "Hypothetical: what is free, and what is not?",
        steps: ["Free result: 3 steps, on screen, no email", "Optional email: ready-to-copy text, cited sites, a copy of the report", "Paid plan: more questions, and you re-scan from the dashboard"],
        title: "Not the same 3 items", lines: [["Free scan", "5 questions, 3 steps, no email"], ["Optional email", "Ready-to-copy text and the report"], ["Paid plan", "Starter 15 questions, Agency 20"]], foot: "Fictional illustration. A paid plan does not promise a rank." },
    ] as Project[],
  },
  jobsT: "What the product does", jobsS: "Fictional illustration, not a scan result. The free result is 3 steps with no email. Ready-to-copy text needs an email. A paid plan asks more questions and you re-scan from the dashboard.",
  jobs: [
    { id: "vis", tab: "Visibility", title: "Know if AI names you", body: "Ranky asks ChatGPT and Gemini questions a customer might ask in your city, then shows whether you were named. This card is fictional.",
      you: "Hypothetical: are we named when someone asks for a plumber in our city?", ranky: "The free result says whether you were named, and who was named instead. Nothing on this card is a measurement.",
      head: "What the free result shows", rows: [["ChatGPT", "Named or not"], ["Gemini", "Named or not"], ["Steps", "3 actions, on screen"]], next: "Run a free scan" },
    { id: "comp", tab: "Competitors", title: "See who gets named instead", body: "The businesses the engines name, across the scans you run. This table is a fictional illustration.",
      you: "Hypothetical: who gets named instead?", ranky: "Other businesses are listed by name when an answer names them. This example names nobody real.",
      head: "Named instead", rows: [["Business A", "A label, not a real business"], ["Business B", "A label, not a real business"], ["Business C", "A label, not a real business"]], next: "See a sample report" },
    { id: "qs", tab: "Questions", title: "Read each answer", body: "Each question, each engine's answer, and whether you were named. Hypothetical questions, not outcomes.",
      you: "Hypothetical: which questions skip us?", ranky: "The report shows the question and whether you were named. This card does not show a real answer.",
      head: "Question list", rows: [["“plumber for water heaters”", "Hypothetical"], ["“plumber open now”", "Hypothetical"], ["“blocked drain”", "Hypothetical"]], next: "See a sample report" },
    { id: "src", tab: "Sources", title: "See sites the answers cite", body: "Cited sites are part of the fuller report, after you add an email. They are not in the free 3 steps. This card is fictional.",
      you: "Hypothetical: where did the answer come from?", ranky: "The fuller report lists cited sites. The free result does not.",
      head: "Fuller report", rows: [["Cited sites", "With an email"], ["Ready-to-copy text", "With an email"], ["Free result", "3 steps, no email"]], next: "Run a free scan" },
    { id: "fix", tab: "Steps", title: "3 steps, then a fuller report", body: "The free result lists 3 steps for this business, on screen, with no email. Ready-to-copy text is in the fuller report. A paid plan asks more questions: Starter 15, Pro and Agency 20.",
      you: "What do I get without paying?", ranky: "The result and 3 steps, on screen. No email and no subscription.",
      head: "Free, email, paid", rows: [["Free", "3 steps, no email"], ["Optional email", "Ready-to-copy text"], ["Paid plan", "More questions, dashboard re-scan"]], next: "Run a free scan" },
    { id: "track", tab: "Tracking", title: "Re-scan from the dashboard", body: "Automatic rescans are off. On a paid plan you re-scan from the dashboard within a monthly check budget and can export CSV. This card is fictional.",
      you: "Hypothetical: can I check again?", ranky: "You start the next scan yourself from the dashboard. This illustration is not a before-and-after.",
      head: "What repeats", rows: [["Free scan", "One time, on screen"], ["Paid plan", "You re-scan from the dashboard"], ["Export", "CSV of your checks"]], next: "See pricing" },
  ] as Job[],
  ctxT: "A fictional look at the product", ctxS: "Hypothetical questions a customer might ask, plus an example chart. Not a real scan and not a result.",
  ctx: {
    qT: "Know what customers ask AI", qB: "Questions written for your category and city, the way customers phrase them.", qLink: "See the question set",
    qs: ["best plumber in Holon", "emergency plumber open now", "plumber near me", "blocked drain price", "water heater repair recommended", "plumber with evening hours", "affordable leak repair", "plumber that speaks English"],
    vT: "An example chart, not a measurement", vB: "The bars are an example of the layout. The percentages are not from a scan.", vLink: "See a sample report",
    vHead: "Mention rate by engine", you: "You", avg: "Competitor average",
    pT: "Your business, as the engines should see it", pB: "Name, other names, category, city and website: the facts Ranky matches every answer against.", pLink: "Start a scan",
    prof: [["Name", "Sample Plumbing"], ["Also known as", "S. Plumbing · סמפל פלאמבינג"], ["Category", "Plumber"], ["City", "Holon"], ["Website", "sample-plumbing.example"]],
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
    ey: "המחשה פיקטיבית", biz: "אינסטלציה לדוגמה", seg: ["סריקה", "דשבורד"], nav: ["נראות", "מתחרים", "שאלות", "מקורות", "תיקונים"],
    recents: "אחרונים", working: "עובד", done: "הושלם תוך", ask: "שאלה היפותטית…", illus: "המחשה · עסק פיקטיבי",
    hint: "המחשה פיקטיבית, לא סריקה ולא תוצאה. בחינם: 5 שאלות ו־3 צעדים על המסך, בלי מייל. מייל אופציונלי מוסיף טקסט מוכן להעתקה. בתשלום: Starter 15 שאלות, Pro ו-Agency 20, וסריקה חוזרת מהדשבורד.",
    projects: [
      { id: "scan", label: "סריקה חינם", prompt: "היפותטי: מה אם לקוח שאל את ChatGPT על אינסטלטור בעיר?",
        steps: ["שואל את ChatGPT ואת Gemini שאלות לתחום ולעיר", "קורא אם העסק הפיקטיבי הוזכר", "מציג מי עוד הוזכר, בלי להמציא ציון"],
        title: "תוצאה חינמית, על המסך", lines: [["מה רואים", "אם הוזכרתם, ומי הוזכר במקומכם"], ["צעדים", "3 פעולות לעסק הזה"], ["אימייל", "לא חובה"]], foot: "פיקטיבי. לא מדידה ולא הוכחה." },
      { id: "comp", label: "מי הוזכר", prompt: "שאלה היפותטית: מי יכול להיות מוזכר במקום?",
        steps: ["קורא את התשובות בהמחשה הזו", "מתאים שמות עסקים והווריאציות שלהם", "מציג שמות אחרים, לא דירוג"],
        title: "שמות, לא ציון", lines: [["עסקים אחרים", "בשמם, כשהמנועים מזכירים אותם"], ["העסק שלכם", "מסומן אם הוזכר או לא"], ["מקורות", "רק בדוח המלא"]], foot: "פיקטיבי. אין עסק אמיתי ואין תוצאה שנמדדה." },
      { id: "fix", label: "חינם מול תשלום", prompt: "היפותטי: מה חינם, ומה לא?",
        steps: ["תוצאה חינמית: 3 צעדים, על המסך, בלי מייל", "מייל אופציונלי: טקסט מוכן להעתקה, אתרים שצוטטו, ועותק של הדוח", "מסלול בתשלום: יותר שאלות, וסריקה חוזרת מהדשבורד"],
        title: "לא אותם 3 פריטים", lines: [["סריקה חינם", "5 שאלות, 3 צעדים, בלי מייל"], ["מייל אופציונלי", "טקסט מוכן להעתקה והדוח"], ["מסלול בתשלום", "Starter 15 שאלות, Agency 20"]], foot: "המחשה פיקטיבית. מסלול בתשלום לא מבטיח מקום." },
    ],
  },
  jobsT: "מה המוצר עושה", jobsS: "המחשה פיקטיבית, לא תוצאה של סריקה. התוצאה החינמית היא 3 צעדים בלי מייל. טקסט מוכן להעתקה דורש אימייל. במסלול בתשלום יש יותר שאלות, וסורקים שוב מהדשבורד.",
  jobs: [
    { id: "vis", tab: "נראות", title: "לדעת אם ה־AI מזכיר אותך", body: "Ranky שואל את ChatGPT ו־Gemini שאלות שלקוח עשוי לשאול בעיר שלך, ומראה אם הוזכרת. הכרטיס הזה פיקטיבי.",
      you: "היפותטי: האם מזכירים אותנו כששואלים על אינסטלטור בעיר?", ranky: "התוצאה החינמית אומרת אם הוזכרתם ומי הוזכר במקומכם. אין כאן מדידה.",
      head: "מה יש בתוצאה החינמית", rows: [["ChatGPT", "הוזכר או לא"], ["Gemini", "הוזכר או לא"], ["צעדים", "3 פעולות, על המסך"]], next: "לסריקה חינם" },
    { id: "comp", tab: "מתחרים", title: "לראות מי הוזכר במקומך", body: "העסקים שהמנועים מזכירים בסריקות שאתם מריצים. הטבלה הזו המחשה פיקטיבית.",
      you: "היפותטי: מי מוזכר במקום?", ranky: "עסקים אחרים מופיעים בשמם כשתשובה מזכירה אותם. בדוגמה הזו אין עסק אמיתי.",
      head: "הוזכרו במקום", rows: [["עסק א׳", "תווית, לא עסק אמיתי"], ["עסק ב׳", "תווית, לא עסק אמיתי"], ["עסק ג׳", "תווית, לא עסק אמיתי"]], next: "לדוח לדוגמה" },
    { id: "qs", tab: "שאלות", title: "לקרוא כל תשובה", body: "כל שאלה, התשובה של כל מנוע, ואם הוזכרתם. שאלות היפותטיות, לא תוצאות.",
      you: "היפותטי: באילו שאלות מדלגים עלינו?", ranky: "הדוח מציג את השאלה ואם הוזכרתם. בכרטיס הזה אין תשובה אמיתית.",
      head: "רשימת שאלות", rows: [["„אינסטלטור לדוד”", "היפותטי"], ["„אינסטלטור פתוח עכשיו”", "היפותטי"], ["„פתיחת סתימה”", "היפותטי"]], next: "לדוח לדוגמה" },
    { id: "src", tab: "מקורות", title: "לראות אילו אתרים צוטטו", body: "אתרים שצוטטו הם חלק מהדוח המלא, אחרי שמוסיפים אימייל. הם לא בתוך 3 הצעדים החינמיים. הכרטיס פיקטיבי.",
      you: "היפותטי: מאיפה הגיעה התשובה?", ranky: "הדוח המלא מציג אתרים שצוטטו. התוצאה החינמית לא.",
      head: "הדוח המלא", rows: [["אתרים שצוטטו", "עם אימייל"], ["טקסט מוכן להעתקה", "עם אימייל"], ["תוצאה חינמית", "3 צעדים, בלי מייל"]], next: "לסריקה חינם" },
    { id: "fix", tab: "צעדים", title: "3 צעדים, ואחר כך דוח מלא", body: "התוצאה החינמית מציגה 3 צעדים לעסק הזה, על המסך, בלי מייל. טקסט מוכן להעתקה נמצא בדוח המלא. במסלול בתשלום יש יותר שאלות: Starter 15, Pro ו-Agency 20.",
      you: "מה מקבלים בלי לשלם?", ranky: "את התוצאה ו־3 צעדים, על המסך. בלי מייל ובלי מנוי.",
      head: "חינם, מייל, תשלום", rows: [["חינם", "3 צעדים, בלי מייל"], ["מייל אופציונלי", "טקסט מוכן להעתקה"], ["מסלול בתשלום", "יותר שאלות, סריקה מהדשבורד"]], next: "לסריקה חינם" },
    { id: "track", tab: "מעקב", title: "סריקה חוזרת מהדשבורד", body: "סריקות חוזרות אוטומטיות כבויות. במסלול בתשלום מריצים סריקה חוזרת מהדשבורד, במסגרת תקציב בדיקות חודשי, ואפשר לייצא CSV. הכרטיס פיקטיבי.",
      you: "היפותטי: אפשר לבדוק שוב?", ranky: "את הסריקה הבאה מפעילים בעצמכם מהדשבורד. זו לא השוואת לפני ואחרי.",
      head: "מה חוזר", rows: [["סריקה חינם", "פעם אחת, על המסך"], ["מסלול בתשלום", "סורקים שוב מהדשבורד"], ["ייצוא", "CSV של הבדיקות"]], next: "למחירים" },
  ],
  ctxT: "מבט פיקטיבי על המוצר", ctxS: "שאלות היפותטיות שלקוח עשוי לשאול, ותרשים לדוגמה. לא סריקה אמיתית ולא תוצאה.",
  ctx: {
    qT: "לדעת מה לקוחות שואלים את ה־AI", qB: "שאלות שנכתבו לתחום ולעיר שלך, בניסוח של לקוחות.", qLink: "לסט השאלות",
    qs: ["אינסטלטור מומלץ בחולון", "אינסטלטור דחוף פתוח עכשיו", "אינסטלטור קרוב אליי", "פתיחת סתימה מחיר", "תיקון דוד מומלץ", "אינסטלטור עם שעות ערב", "איתור נזילה במחיר סביר", "אינסטלטור דובר אנגלית"],
    vT: "תרשים לדוגמה, לא מדידה", vB: "העמודות הן דוגמה למבנה. האחוזים לא הגיעו מסריקה.", vLink: "לדוח לדוגמה",
    vHead: "שיעור אזכור לפי מנוע", you: "אתה", avg: "ממוצע מתחרים",
    pT: "העסק שלך, כמו שהמנועים צריכים לראות אותו", pB: "שם, שמות נוספים, תחום, עיר ואתר: העובדות ש־Ranky מתאים מולן כל תשובה.", pLink: "להתחיל סריקה",
    prof: [["שם", "אינסטלציה לדוגמה"], ["שמות נוספים", "Sample Plumbing · א. לדוגמה"], ["תחום", "אינסטלטור"], ["עיר", "חולון"], ["אתר", "sample-plumbing.example"]],
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
