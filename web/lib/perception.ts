import type { Locale } from "./i18n";
// Sentiment + fact check: types shared by the report and the dashboard, copy (he/en), and the sample data for /report.
export type Tone = "positive" | "neutral" | "mixed" | "negative";
export type Counts = Record<Tone, number>;
export type Sentiment = { answers: number; counts: Counts; net: number; byEngine?: Record<string, Counts>; examples: { text: string; tone: Tone; cues: string[]; engine: string; question: string }[] };
export type Fact = { type: "city" | "website" | "status" | "phone" | "hours"; status: "conflict" | "check"; said: string; expected?: string; quote: string; count: number; engines: string[]; question?: string };
export type Facts = { conflicts: Fact[]; checks: Fact[]; matches: number };

export const PERCEPTION = {
  en: {
    sentT: "How AI talks about you", sentS: (n: number) => `Tone of the ${n} answers that named you`,
    tones: { positive: "Positive", neutral: "Neutral", mixed: "Mixed", negative: "Negative" } as Record<Tone, string>,
    net: "Net tone", netHelp: "Positive answers minus negative ones, out of every answer that named you (−100 to +100).",
    because: "Because of", said: "said", none: "No answers named you, so there is no tone to measure yet.",
    factT: "What AI gets wrong", factS: "What the engines say about you, checked against the details you gave us",
    types: { city: "City", website: "Website", status: "Open or closed", phone: "Phone number", hours: "Opening hours" } as Record<Fact["type"], string>,
    aiSays: "AI says", youSaid: "You told us", times: (n: number) => (n === 1 ? "in 1 answer" : `in ${n} answers`), verify: "Please check", verifyS: "We can't confirm these, but customers will see them.",
    clean: (m: number) => `Nothing wrong found.${m ? ` ${m} details matched what you told us.` : ""}`, matched: (m: number) => `${m} details matched what you told us.`,
    fixHint: { city: "Make your city obvious on your home page, Google profile and every directory listing.", website: "Link your real website from every profile and directory the engines cite.", status: "Update your Google Business Profile and directories so they show you are open.", phone: "", hours: "" } as Record<Fact["type"], string>,
    how: "Ranky reads only the sentences that name you, and marks tone and facts from the exact words. Always check the quote.",
    quote: "Quote", sample: "Example",
  },
  he: {
    sentT: "איך ה־AI מדבר עליך", sentS: (n: number) => `הטון של ${n} התשובות שהזכירו אותך`,
    tones: { positive: "חיובי", neutral: "ניטרלי", mixed: "מעורב", negative: "שלילי" } as Record<Tone, string>,
    net: "טון נטו", netHelp: "תשובות חיוביות פחות שליליות, מתוך כל התשובות שהזכירו אותך (‎−100 עד ‎+100).",
    because: "בגלל", said: "אמר", none: "אף תשובה לא הזכירה אותך, אז עדיין אין טון למדוד.",
    factT: "מה ה־AI טועה לגביך", factS: "מה המנועים אומרים עליך, מול הפרטים שמסרת לנו",
    types: { city: "עיר", website: "אתר", status: "פתוח או סגור", phone: "טלפון", hours: "שעות פתיחה" } as Record<Fact["type"], string>,
    aiSays: "ה־AI אומר", youSaid: "אצלך", times: (n: number) => (n === 1 ? "בתשובה אחת" : `ב־${n} תשובות`), verify: "כדאי לבדוק", verifyS: "את אלה אנחנו לא יכולים לאמת, אבל לקוחות רואים אותם.",
    clean: (m: number) => `לא נמצאו טעויות.${m ? ` ${m} פרטים תאמו למה שמסרת.` : ""}`, matched: (m: number) => `${m} פרטים תאמו למה שמסרת.`,
    fixHint: { city: "הבהירו את העיר בדף הבית, בפרופיל בגוגל ובכל אינדקס.", website: "קשרו לאתר האמיתי שלכם מכל פרופיל ואינדקס שהמנועים מצטטים.", status: "עדכנו את הפרופיל בגוגל ואת האינדקסים כך שיראו שאתם פתוחים.", phone: "", hours: "" } as Record<Fact["type"], string>,
    how: "Ranky קורא רק את המשפטים שמזכירים אותך, ומסמן טון ועובדות לפי המילים עצמן. תמיד כדאי לבדוק את הציטוט.",
    quote: "ציטוט", sample: "דוגמה",
  },
};
export const perceptionFor = (l: Locale) => PERCEPTION[l];

export const sampleSentiment = (l: Locale): Sentiment => l === "he"
  ? { answers: 3, net: 17, counts: { positive: 1, neutral: 1, mixed: 0, negative: 1 }, examples: [
      { text: "אינסטלציה אקמה – יש ביקורות מעורבות על זמני המתנה ארוכים.", tone: "negative", cues: ["ביקורות מעורבות", "זמני המתנה ארוכים"], engine: "gemini", question: "אינסטלטור חירום בתל אביב" },
      { text: "אינסטלציה אקמה – ידועים בשירות מהיר וביקורות טובות.", tone: "positive", cues: ["ידועים בשירות", "ביקורות טובות"], engine: "chatgpt", question: "אינסטלטור מומלץ בתל אביב" }] }
  : { answers: 3, net: 17, counts: { positive: 1, neutral: 1, mixed: 0, negative: 1 }, examples: [
      { text: "Acme Plumbing – some reviews mention long wait times.", tone: "negative", cues: ["long wait"], engine: "gemini", question: "emergency plumber in Austin" },
      { text: "Acme Plumbing – known for good reviews and fast service.", tone: "positive", cues: ["known for good", "good reviews", "fast service"], engine: "chatgpt", question: "best plumber in Austin" }] };
export const sampleFacts = (l: Locale): Facts => l === "he"
  ? { matches: 2, conflicts: [{ type: "city", status: "conflict", said: "בת ים", expected: "תל אביב", quote: "אינסטלציה אקמה – ממוקמים בבת ים, פתוח עד השעה 20:00.", count: 1, engines: ["chatgpt"] }],
      checks: [{ type: "hours", status: "check", said: "עד השעה 20:00", quote: "אינסטלציה אקמה – ממוקמים בבת ים, פתוח עד השעה 20:00.", count: 1, engines: ["chatgpt"] }] }
  : { matches: 2, conflicts: [{ type: "city", status: "conflict", said: "Round Rock", expected: "Austin, TX", quote: "Acme Plumbing – located in Round Rock, open until 8 pm.", count: 1, engines: ["chatgpt"] }],
      checks: [{ type: "hours", status: "check", said: "until 8 pm", quote: "Acme Plumbing – located in Round Rock, open until 8 pm.", count: 1, engines: ["chatgpt"] }] };
