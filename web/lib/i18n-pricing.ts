// Copy for /{lang}/pricing (stage 3). Honest by construction: every row says what runs today; anything not running says "coming soon".
// Lines marked `on` are only shown when the server reports the job enabled (/api/pricing autoRescan / digest).
import type { Locale } from "./i18n";
type Cell = string | { soon: string; on: string };
export type Row = { k: string; label: string; cells: [Cell, Cell, Cell, Cell] };
const P = {
  en: {
    title: "Pricing", lede: "Start with a free scan. Pay monthly only if you want us to keep tracking. Cancel anytime, no VAT added.",
    compareTitle: "Compare plans", compareSub: "What each plan includes today, and what is still coming.", feature: "Feature",
    today: "Runs today", soonLegend: "Coming soon = not live yet; we will say so here when it is.",
    rows: [
      { k: "biz", label: "Businesses", cells: ["1", "1", "3", "10"] },
      { k: "q", label: "Customer questions per scan", cells: ["5", "15", "20 each", "15 each"] },
      { k: "eng", label: "AI engines checked", cells: ["ChatGPT + Gemini", "ChatGPT + Gemini", "ChatGPT + Gemini", "ChatGPT + Gemini"] },
      { k: "more", label: "Perplexity, Claude, Copilot", cells: ["Coming soon", "Coming soon", "Coming soon", "Coming soon"] },
      { k: "comp", label: "Competitors named instead of you", cells: ["Top 3", "Top 3", "Top 5", "Top 5"] },
      { k: "fix", label: "Prioritized fixes with ready-to-paste copy", cells: ["3", "3 per report", "3 per report", "3 per report"] },
      { k: "manual", label: "Re-scan from your dashboard", cells: ["—", "Yes, within the plan's monthly check budget", "Yes, within the plan's monthly check budget", "Yes, within the plan's monthly check budget"] },
      { k: "cad", label: "Automatic re-scan", cells: ["—", { soon: "Monthly (automatic scheduling coming soon)", on: "Every month" }, { soon: "Weekly (automatic scheduling coming soon)", on: "Every week" }, { soon: "Weekly (automatic scheduling coming soon)", on: "Every week" }] },
      { k: "hist", label: "Score history chart", cells: ["—", "Yes", "Yes", "Yes"] },
      { k: "alert", label: "Alerts when AI gets something wrong", cells: ["—", "In the dashboard (email coming soon)", "In the dashboard (email coming soon)", "In the dashboard (email coming soon)"] },
      { k: "digest", label: "Monthly email summary", cells: ["—", { soon: "Coming soon", on: "Yes" }, { soon: "Coming soon", on: "Yes" }, { soon: "Coming soon", on: "Yes" }] },
      { k: "csv", label: "CSV export", cells: ["—", "Yes", "Yes", "Yes"] },
    ] as Row[],
    plans: ["Free scan", "Starter", "Pro", "Agency"],
    faqTitle: "Billing questions",
    faq: [["Is there a contract?", "No. Plans are monthly and renew automatically; cancel from your dashboard and you keep access until the end of the paid month."], ["Is VAT added?", "No. The operator is a VAT-exempt dealer (עוסק פטור); the price you see is the price you pay, with a receipt by email."], ["Which currency?", "Plans are charged in Israeli shekels (₪)."], ["Refunds?", "See the refund and cancellation policy."]],
    refunds: "Refund and cancellation policy", scan: "Start with a free scan",
  },
  he: {
    title: "מחירים", lede: "מתחילים בסריקה חינם. משלמים חודשי רק אם רוצים שנמשיך לעקוב. ביטול בכל עת, בלי מע\"מ.",
    compareTitle: "השוואת מסלולים", compareSub: "מה כל מסלול כולל היום, ומה עוד בדרך.", feature: "מה כלול",
    today: "פועל היום", soonLegend: "בקרוב = עדיין לא פעיל; נעדכן כאן כשזה יעלה.",
    rows: [
      { k: "biz", label: "עסקים", cells: ["1", "1", "3", "10"] },
      { k: "q", label: "שאלות לקוח בכל סריקה", cells: ["5", "15", "20 לכל עסק", "15 לכל עסק"] },
      { k: "eng", label: "מנועי AI שנבדקים", cells: ["ChatGPT + Gemini", "ChatGPT + Gemini", "ChatGPT + Gemini", "ChatGPT + Gemini"] },
      { k: "more", label: "Perplexity, Claude, Copilot", cells: ["בקרוב", "בקרוב", "בקרוב", "בקרוב"] },
      { k: "comp", label: "מתחרים שמומלצים במקומך", cells: ["3 מובילים", "3 מובילים", "5 מובילים", "5 מובילים"] },
      { k: "fix", label: "תיקונים מתועדפים עם טקסט מוכן", cells: ["3", "3 לכל דוח", "3 לכל דוח", "3 לכל דוח"] },
      { k: "manual", label: "סריקה חוזרת מהדשבורד", cells: ["—", "כן, במסגרת מכסת הבדיקות החודשית", "כן, במסגרת מכסת הבדיקות החודשית", "כן, במסגרת מכסת הבדיקות החודשית"] },
      { k: "cad", label: "סריקה חוזרת אוטומטית", cells: ["—", { soon: "חודשית (תזמון אוטומטי בקרוב)", on: "כל חודש" }, { soon: "שבועית (תזמון אוטומטי בקרוב)", on: "כל שבוע" }, { soon: "שבועית (תזמון אוטומטי בקרוב)", on: "כל שבוע" }] },
      { k: "hist", label: "גרף היסטוריית ציון", cells: ["—", "כן", "כן", "כן"] },
      { k: "alert", label: "התראות כשה־AI טועה לגביך", cells: ["—", "בדשבורד (במייל בקרוב)", "בדשבורד (במייל בקרוב)", "בדשבורד (במייל בקרוב)"] },
      { k: "digest", label: "סיכום חודשי במייל", cells: ["—", { soon: "בקרוב", on: "כן" }, { soon: "בקרוב", on: "כן" }, { soon: "בקרוב", on: "כן" }] },
      { k: "csv", label: "ייצוא CSV", cells: ["—", "כן", "כן", "כן"] },
    ] as Row[],
    plans: ["סריקה חינם", "Starter", "Pro", "Agency"],
    faqTitle: "שאלות על תשלום",
    faq: [["יש התחייבות?", "לא. המסלולים חודשיים ומתחדשים אוטומטית; מבטלים מהדשבורד, והגישה נשארת עד סוף החודש ששולם."], ["מוסיפים מע\"מ?", "לא. המפעיל הוא עוסק פטור; המחיר שמוצג הוא המחיר שמשלמים, עם קבלה במייל."], ["באיזה מטבע?", "החיוב בשקלים (₪)."], ["החזרים?", "ראו את מדיניות ההחזרים והביטולים."]],
    refunds: "מדיניות החזרים וביטולים", scan: "מתחילים בסריקה חינם",
  },
};
export const pricingPage = (l: Locale) => P[l];
