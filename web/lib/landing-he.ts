// landing-restore-light: the two /he home blocks kept from landing-redesign-dark (sourced US proof + founder note), rendered in the light design.
// Rules: ChatGPT + Gemini only, plural address, Ranky feminine, "בדיקה" as the single term. No invented numbers: plan facts from src/plans.js.
export const PROOF_SOURCES = {
  brightlocal: "https://www.brightlocal.com/research/lcrs-ai-trust/",
  verge: "https://www.theverge.com/ai-artificial-intelligence/1002265/chatgpt-now-has-1-2-billion-weekly-users-openai-says",
} as const;

export const LANDING_HE = {
  proofEy: "נתונים מארה\"ב, עם מקור",
  proofNote: "הנתונים נאספו בארה\"ב ואינם נתונים מישראל.",
  proof: [
    { big: "45%", text: "מהצרכנים בארה\"ב השתמשו בכלי AI כדי למצוא המלצה על עסק מקומי בשנה האחרונה. שנה קודם: 6%.", src: "BrightLocal, סקר צרכנים 2026, 1,002 משיבים בארה\"ב", url: PROOF_SOURCES.brightlocal },
    { big: "31%", text: "מהצרכנים בארה\"ב ביקשו מ-ChatGPT המלצה על עסק בשנה האחרונה.", src: "BrightLocal 2026, אותו סקר", url: PROOF_SOURCES.brightlocal },
    { big: "1B+", text: "ChatGPT משמש יותר ממיליארד אנשים בכל שבוע.", src: "OpenAI, 2026 (דווח ב-The Verge)", url: PROOF_SOURCES.verge },
  ],
  sourceLabel: "מקור",
  founderT: "מי עומד מאחורי Ranky",
  founder: "בניתי את Ranky כי ראיתי שאנשים שואלים את ChatGPT על עסקים, ובעלי העסקים לא יודעים מה הוא עונה.",
  founderSig: "— שי, בת ים",
} as const;
