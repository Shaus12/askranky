// Strings for email+password accounts, Google sign-in and the account menu (kept out of i18n.ts to limit merge conflicts).
import type { Locale } from "./i18n";
export const authText = {
  en: {
    loginTitle: "Sign in", loginSub: "Sign in with your email and password, Google, or a one-time email link.", email: "Email", password: "Password", newPassword: "New password", currentPassword: "Current password",
    signIn: "Sign in", google: "Continue with Google", or: "or", magicTitle: "No password yet?", magicSub: "We'll email you a single-use sign-in link, valid for 15 minutes.", magicSend: "Email me a sign-in link",
    forgot: "Forgot your password?", noAccount: "New to Ranky?", createOne: "Create an account", haveAccount: "Already have an account?", signInLink: "Sign in",
    signupTitle: "Create your account", signupSub: "Use the email you scanned with or subscribed with to keep your reports in one place.", create: "Create account",
    pwHint: "At least 10 characters. A short sentence works well.", show: "Show", hide: "Hide",
    checkEmail: "Check your email. If the details are valid, we sent you a link to continue.", invalid: "Wrong email or password.", unverified: "Confirm your email first: we sent you a link when you signed up.",
    short: "Use at least 10 characters.", long: "That password is too long.", common: "That password is too common. Pick something less guessable.", emailInvalid: "Enter a valid email.",
    resetTitle: "Reset your password", resetSub: "Enter your email and we'll send a link to choose a new password (valid 30 minutes).", resetSend: "Send reset link",
    setTitle: "Choose a new password", setSub: "Setting a new password signs you out everywhere else.", setSave: "Save password",
    linkInvalid: "This link is invalid, expired or already used. Request a new one.", verifyTitle: "Confirm your email", verifyBtn: "Confirm and sign in", verifying: "Confirming…",
    accountTitle: "My account", accountSub: "Manage how you sign in.", setPwTitle: "Set a password", setPwSub: "You signed in with an email link. Add a password to sign in faster next time.", changePwTitle: "Change password", saved: "Saved. Your other sessions were signed out.",
    googleLinked: "Google sign-in is linked to this account.", signOut: "Sign out", dashboard: "Dashboard", account: "Account", signedInAs: "Signed in as",
    notSignedIn: "You're not signed in.", errGoogle: "Google sign-in didn't complete. Try again or use your email.", errGoogleUnverified: "Your Google email isn't verified, so we can't use it to sign in.",
    rate: "Too many attempts. Please wait a few minutes and try again.", generic: "Something went wrong. Please try again.",
  },
  he: {
    loginTitle: "כניסה", loginSub: "כניסה עם אימייל וסיסמה, עם Google, או עם קישור חד־פעמי במייל.", email: "אימייל", password: "סיסמה", newPassword: "סיסמה חדשה", currentPassword: "סיסמה נוכחית",
    signIn: "כניסה", google: "המשך עם Google", or: "או", magicTitle: "עדיין אין לך סיסמה?", magicSub: "נשלח לך קישור כניסה חד־פעמי במייל, בתוקף ל־15 דקות.", magicSend: "שלחו לי קישור כניסה",
    forgot: "שכחת סיסמה?", noAccount: "חדש ב־Ranky?", createOne: "יצירת חשבון", haveAccount: "כבר יש לך חשבון?", signInLink: "כניסה",
    signupTitle: "יצירת חשבון", signupSub: "השתמש באימייל שאיתו סרקת או נרשמת למנוי, כדי שכל הדוחות יהיו במקום אחד.", create: "יצירת חשבון",
    pwHint: "לפחות 10 תווים. משפט קצר עובד מצוין.", show: "הצג", hide: "הסתר",
    checkEmail: "בדוק את תיבת הדואר. אם הפרטים תקינים, שלחנו קישור להמשך.", invalid: "אימייל או סיסמה שגויים.", unverified: "צריך לאשר קודם את האימייל: שלחנו קישור כשנרשמת.",
    short: "יש להשתמש בלפחות 10 תווים.", long: "הסיסמה ארוכה מדי.", common: "הסיסמה נפוצה מדי. בחר משהו שקשה יותר לנחש.", emailInvalid: "יש להזין אימייל תקין.",
    resetTitle: "איפוס סיסמה", resetSub: "הזן את האימייל ונשלח קישור לבחירת סיסמה חדשה (בתוקף ל־30 דקות).", resetSend: "שלחו קישור לאיפוס",
    setTitle: "בחירת סיסמה חדשה", setSub: "סיסמה חדשה מנתקת אותך מכל שאר המכשירים.", setSave: "שמירת סיסמה",
    linkInvalid: "הקישור לא תקין, פג תוקפו או שכבר נעשה בו שימוש. בקש קישור חדש.", verifyTitle: "אישור האימייל", verifyBtn: "אישור וכניסה", verifying: "מאשר…",
    accountTitle: "החשבון שלי", accountSub: "ניהול דרכי הכניסה שלך.", setPwTitle: "הגדרת סיסמה", setPwSub: "נכנסת עם קישור במייל. הוסף סיסמה כדי להיכנס מהר יותר בפעם הבאה.", changePwTitle: "שינוי סיסמה", saved: "נשמר. שאר החיבורים שלך נותקו.",
    googleLinked: "כניסה עם Google מחוברת לחשבון הזה.", signOut: "יציאה", dashboard: "דשבורד", account: "חשבון", signedInAs: "מחובר כ־",
    notSignedIn: "אינך מחובר.", errGoogle: "הכניסה עם Google לא הושלמה. נסה שוב או היכנס עם אימייל.", errGoogleUnverified: "האימייל שלך ב־Google לא מאומת, ולכן אי אפשר להשתמש בו לכניסה.",
    rate: "יותר מדי ניסיונות. המתן כמה דקות ונסה שוב.", generic: "משהו השתבש. נסה שוב.",
  },
} satisfies Record<Locale, Record<string, string>>;
export type AuthText = (typeof authText)["en"];
export const authErr = (a: AuthText, x: any): string => {
  const c = x?.code; return c === "invalid_credentials" ? a.invalid : c === "email_unverified" ? a.unverified : c === "password_short" || c === "password_required" ? a.short : c === "password_long" ? a.long : c === "password_common" ? a.common
    : c === "email_invalid" ? a.emailInvalid : c === "link_invalid" ? a.linkInvalid : c === "rate_limited" ? a.rate : "";
};
