// Strings for the "free plan includes one scan per email" notice (kept out of i18n.ts to avoid merge conflicts with other work).
import type { Locale } from "./i18n";
export const freeText = {
  en: { title: "Free plan includes one scan per email", body: "This email has already used its free scan, so we didn't run a new one and nothing was charged. Your report is still there.",
    view: "View your existing report", upgradeTitle: "Want to scan more businesses?", upgradeSoon: "Paid plans open soon. Leave your email and we'll let you know the moment they do.", upgradeLive: "Paid plans track your visibility regularly (weekly reports coming soon) and cover more businesses.",
    notify: "Notify me when paid plans open", upgrade: "Upgrade your plan", other: "Use a different email" },
  he: { title: "התוכנית החינמית כוללת סריקה אחת לכל אימייל", body: "האימייל הזה כבר השתמש בסריקה החינמית שלו, ולכן לא הרצנו סריקה חדשה ולא נגבה תשלום. הדוח שלך עדיין זמין.",
    view: "לדוח הקיים", upgradeTitle: "רוצים לסרוק עוד עסקים?", upgradeSoon: "המסלולים בתשלום ייפתחו בקרוב. השאירו אימייל ונעדכן אתכם ברגע שהם נפתחים.", upgradeLive: "המסלולים בתשלום עוקבים אחרי הנראות שלך באופן שוטף (דוחות שבועיים בקרוב) וכוללים יותר עסקים.",
    notify: "עדכנו אותי כשהמסלולים נפתחים", upgrade: "שדרוג המסלול", other: "להשתמש באימייל אחר" },
} satisfies Record<Locale, Record<string, string>>;

// Strings for the "sign in to scan with this email" notice (POST /api/scan 401 login_required: the email belongs to an existing paid account).
export const paidLoginText = {
  en: { title: "Please sign in to continue", body: "This email is linked to an existing account. To scan with it, sign in to that account first. We didn't run a scan and nothing was charged.",
    login: "Sign in", back: "After signing in, use “Back to the scan form” on your dashboard and submit again.", other: "Use a different email", returnScan: "Back to the scan form" },
  he: { title: "יש להתחבר כדי להמשיך", body: "האימייל הזה משויך לחשבון קיים. כדי לסרוק איתו, יש להתחבר קודם לחשבון הזה. לא הרצנו סריקה ולא נגבה תשלום.",
    login: "התחברות", back: "אחרי ההתחברות, לחצו על ״חזרה לטופס הסריקה״ בלוח הבקרה ושלחו שוב.", other: "להשתמש באימייל אחר", returnScan: "חזרה לטופס הסריקה" },
} satisfies Record<Locale, Record<string, string>>;
