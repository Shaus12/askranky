// Strings for the embedded SUMIT card form (kept out of i18n.ts so that file stays untouched by the payments work).
import type { Locale } from "./i18n";
export const payText = {
  en: { title: "Card details", sub: "Your card details go straight to SUMIT, our payment processor. They never reach our servers.", card: "Card number", month: "Month", year: "Year", cvv: "CVV", cvvHint: "CVV: the 3 digits on the back of the card (4 on the front for Amex).", id: "Cardholder ID (optional)", idHint: "Only needed if your card issuer requires it. Otherwise leave it empty.", pay: "Pay and subscribe", paying: "Processing payment…", loading: "Loading secure form…", secure: "Secure payment by SUMIT", secureShort: "Encrypted",
    orderTitle: "Order summary", cadence: "Billed monthly, renews automatically",
    loadErr: "The secure card form could not be loaded. Check your connection or ad blocker and refresh the page.", tokenErr: "The card could not be verified. Check the details and try again.", timeout: "The card check took too long. Please try again.",
    declined: "The payment was declined. Try another card.", invalid: "This checkout expired. Go back and start again.", rate: "Too many attempts. Please wait a few minutes and try again.", busy: "A payment is already in progress. Please wait.", failed: "Something went wrong while charging. You were not charged twice; check your email or contact support before trying again.",
    paidTitle: "Payment received", paidSub: "Thank you! A receipt and a dashboard sign-in link are on their way to your email." },
  he: { title: "פרטי כרטיס אשראי", sub: "פרטי הכרטיס נשלחים ישירות ל־SUMIT, חברת הסליקה שלנו, ולא עוברים בשרתים שלנו.", card: "מספר כרטיס", month: "חודש", year: "שנה", cvv: "CVV", cvvHint: "CVV: שלוש הספרות בגב הכרטיס (ב־Amex ארבע ספרות בחזית).", id: "ת.ז. בעל הכרטיס (לא חובה)", idHint: "נדרש רק אם מנפיק הכרטיס דורש. אחרת אפשר להשאיר ריק.", pay: "שלם והירשם", paying: "מעבד תשלום…", loading: "טוען טופס מאובטח…", secure: "תשלום מאובטח באמצעות SUMIT", secureShort: "מוצפן",
    orderTitle: "סיכום הזמנה", cadence: "חיוב חודשי, מתחדש אוטומטית",
    loadErr: "טופס התשלום המאובטח לא נטען. בדקו את החיבור או חוסם פרסומות ורעננו את הדף.", tokenErr: "לא הצלחנו לאמת את הכרטיס. בדקו את הפרטים ונסו שוב.", timeout: "בדיקת הכרטיס לקחה יותר מדי זמן. נסו שוב.",
    declined: "התשלום נדחה. נסו כרטיס אחר.", invalid: "תוקף ההזמנה פג. חזרו אחורה והתחילו מחדש.", rate: "יותר מדי ניסיונות. המתינו כמה דקות ונסו שוב.", busy: "תשלום כבר בתהליך. המתינו רגע.", failed: "אירעה שגיאה בחיוב. לא חויבתם פעמיים; בדקו את המייל או פנו לתמיכה לפני ניסיון נוסף.",
    paidTitle: "התשלום התקבל", paidSub: "תודה! קבלה וקישור כניסה ללוח הבקרה בדרך אליכם למייל." },
} satisfies Record<Locale, Record<string, string>>;
