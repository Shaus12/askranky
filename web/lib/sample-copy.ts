// Copy for the home sample (web/components/HomeSample.tsx). Placeholder strings contain no numbers and no real names.
export const SAMPLE_COPY = {
  he: { title: "ככה נראה הדוח", sub: "ציון, מי ש-ChatGPT ו-Gemini הזכירו, והתשובות עצמן.", badgeReal: "דוגמה מבדיקה אמיתית, בלי שמות", badgePlaceholder: "מבנה הדוח לדוגמה, בלי נתונים",
    business: "העסק שנבדק", phBusiness: "שם העסק שלכם", phMeta: "התחום שלכם · העיר שלכם", scoreLabel: "ציון", checks: "{n} בדיקות", phChecks: "הציון שלכם יופיע כאן",
    namedTitle: "מי ש-AI הזכיר", phNamed: ["עסק א׳", "עסק ב׳", "עסק ג׳"], qaTitle: "שאלה ותשובה", phQuestion: "מי העסקים הטובים ביותר בתחום שלכם בעיר שלכם?",
    phAnswer: "כאן תופיע התשובה המלאה של ChatGPT או Gemini, מילה במילה, ונסמן אם העסק שלכם הוזכר.", noteReal: "השמות הוחלפו בתוויות. המספרים מהבדיקה עצמה.",
    notePlaceholder: "זו רק תבנית: אין כאן מספרים או שמות אמיתיים. הדוח שלכם ימולא בתוצאות הבדיקה.", cta: "לבדוק את העסק שלי" },
  en: { title: "What the report looks like", sub: "A score, who ChatGPT and Gemini named, and the answers themselves.", badgeReal: "Sample from a real scan, names removed", badgePlaceholder: "Report layout sample, no data",
    business: "The scanned business", phBusiness: "Your business name", phMeta: "Your trade · Your city", scoreLabel: "Visibility score", checks: "{n} checks", phChecks: "Your score appears here",
    namedTitle: "Who AI named", phNamed: ["Business A", "Business B", "Business C"], qaTitle: "Question and answer", phQuestion: "What are the best businesses in your trade in your city?",
    phAnswer: "The full ChatGPT or Gemini answer appears here, word for word, and we mark whether your business was mentioned.", noteReal: "Names were replaced with labels. The numbers come from the scan itself.",
    notePlaceholder: "This is a layout only: no real numbers or names. Your report is filled with your scan's results.", cta: "Check my business" },
} as const;
