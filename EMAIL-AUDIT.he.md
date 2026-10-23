# ביקורת מיילים אוטומטיים ללקוחות — Ranky (askranky.com)

עודכן ב-`email-fixes` (מבוסס על main = 638e291). הטקסטים המדויקים נוצרו מהקוד (`src/email/templates.js`, `src/email/report.js`) עם ערכי דוגמה: מסלול Pro, 179 ILS, עד 2026-11-30, עסק "Maison Mana" בציון 7. כתובת השולח: `Ranky <hello@askranky.com>`, reply-to: `EMAIL_REPLY_TO` (שי ב-Gmail). שליחה דרך `src/email/send.js`.

## 0. משימות ל-Ops (לבדיקה אצלנו, לא בקוד)

1. **בתשלום האמיתי הראשון: לוודא אם SUMIT שולחת ללקוח את הקבלה במייל.** לבדוק בתיבה של הלקוח (או חשבון בדיקה) ובכרטיס הלקוח ב-SUMIT. אם לא נשלחת: להפעיל שליחה אוטומטית של מסמכים בהגדרות SUMIT (או להוסיף `UpdateCustomerByEmail_AttachDocument` לבקשת החיוב אחרי בדיקה). עד אז הטקסט במייל שלנו כבר לא טוען כלום בביטחון ("ספק החיוב מנפיק; אם לא הגיעה, השב למייל").
2. לוודא ב-Render: `SUPPORT_EMAIL` (ברירת המחדל: shaysho1111@gmail.com; הפוטר והקבלה מצביעים אליו), `EMAIL_REPLY_TO`, `BASE_URL`.
3. לוודא ב-Render: `TRUST_PROXY`. הערך `1` עבד שגוי עד התיקון בענף הזה (ראו סעיף 3, פריט 1). אם Cloudflare בענן הכתום מול Render יש שתי קפיצות: אז הערך הנכון הוא `2`; לבדוק מה כתובת ה-IP שרואים בבקשה (למשל בלוג/בדיקה אחרי הפריסה).
4. להחליט אם להפעיל דוחות שבועיים: אם כן, `WEEKLY_EMAILS_ENABLED=1` + משימת cron-job.org שבועית ל-`POST /api/internal/cron/weekly` + עדכון הטקסטים והתנאים.
5. לעקוב אחרי אירועי `billing.email_failed`, `email.report_rate_limited`, `subscription.superseded` ב-DB (אין בהם כתובות מייל).

## 1. טבלת סיכום

| # | מייל | טריגר | נמען | נושא (HE / EN) | שליחה | שפות | מצב |
|---|------|--------|------|-----------------|--------|-------|------|
| 1 | קישור כניסה | `POST /login`, `/api/login` (אחרי captcha) ובסיום תשלום מוצלח | בעל החשבון | `קישור הכניסה שלך ל-Ranky` / `Your Ranky dashboard link` | `sendEmail` | HE/EN לפי שפת הדף, אחרת שפת החשבון, אחרת EN | תוקן קודם: היה EN בלבד, בלי פוטר |
| 2 | דוח סריקה (חד פעמי) | אחרי סריקה חינמית/ראשונה שהצליחה (`/scan`, `/api/scan`) | הכתובת שהוקלדה בטופס בלבד | `הדוח שלך מ-Ranky: <עסק> קיבל N/100` / `Your Ranky report: <עסק> scored N/100` | `sendEmailSoft` | **HE/EN** לפי השפה שנשלחה עם הסריקה (נשמרת ב-`scan.lang`, ובחשבון אם אין), ברירת מחדל EN | **תוקן:** תורגם במלואו (נושא, גוף, הערת מנועים, פוטר, הסרה), RTL. מוגבל ל-3 מיילי דוח לכתובת ב-24 שעות |
| 3 | דוח שבועי | `runWeekly` (`npm run weekly` או `POST /api/internal/cron/weekly` עם `WEEKLY_EMAILS_ENABLED=1`) | חשבונות בתשלום שלא ביטלו הסרה | `הדוח השבועי של Ranky: <עסק> N/100` / `Ranky weekly: <עסק> N/100` | `sendEmail` בתוך try | HE/EN לפי שפת החשבון, אחרת שפת הסריקה האחרונה, אחרת EN | **לא נשלח בפועל**: אין תזמון, והנקודה החדשה כבויה כברירת מחדל. הטקסטים באתר ובתנאים כבר לא מבטיחים דוח שבועי |
| 4 | קבלה / חידוש | תשלום ראשון וחידוש שזוהה ב-`billing-sync` | בעל החשבון | `קבלה מ-Ranky: <מסלול>, <סכום> ILS` / `Ranky receipt: ...` | `sendEmailSoft` | HE/EN | **תוקן:** הטקסט אומר ש-SUMIT מנפיקה את הקבלה ושאם לא הגיעה יש להשיב למייל. בלי "נשלחת בנפרד/מצורפת" |
| 5 | כשל בתשלום | `billing-sync`, פעם אחת לכל אירוע כשל | בעל החשבון | `נדרשת פעולה: התשלום ל-Ranky לא עבר` / `Action needed: your Ranky payment didn't go through` | `sendEmailSoft` | HE/EN | תוקן קודם: קישור להצטרפות מחדש (`/{lang}/checkout?plan=...`) במקום "קישור מאובטח לעדכון כרטיס". ראו סעיף 2 |
| 6 | אישור ביטול | `POST /api/dashboard/:id/cancel` | בעל החשבון | `המנוי שלך ב-Ranky בוטל` / `Your Ranky subscription is cancelled` | `sendEmailSoft` | HE/EN | תקין |
| 7 | אישור רשימת המתנה | `POST /api/waitlist` | — | — | לא נשלח מייל | — | — |
| 8 | "סריקה חינמית אחת לכל אימייל" | סריקה שנייה לאותו מייל | — | — | לא נשלח מייל | — | — |
| 9 | שיווק / חדשות מוצר | — | — | — | אין קוד ששולח | — | נשמרת הסכמה, שום מייל שיווקי לא נשלח. אם יתווסף: "פרסומת" + List-Unsubscribe (התשתית ב-`consent.js`) |

## 2. כשל בתשלום והגנה מפני חיוב כפול

- **דה-דופליקציה:** המייל נשלח רק כש-`failedNoticeAt` ריק; הוא מתנקה רק כשההוראה חוזרת להיות פעילה או כשהלקוח מצטרף מחדש. שליחה עם `sendEmailSoft`: תקלה בשליחה נרשמת (`billing.email_failed`, בלי כתובת) ולא עוצרת את הסנכרון ולא תשלח שוב מחר.
- סטטוסי `GracePeriod` (11) ו-`PendingRetry` (14) נחשבים "פעיל" בסנכרון; לכן המייל יוצא רק אחרי ש-SUMIT סיימה לנסות לבד.
- **הגנת חיוב כפול (חדש):** `POST /api/checkout`, `POST /checkout`, `POST /api/checkout/charge` ו-`/billing/return` מחזירים **409** `{ error: 'already_subscribed', code, message, messageHe }` לחשבון עם מנוי פעיל, כולל מנוי מבוטל שתקופתו טרם הסתיימה. חשבון `past_due`/`unpaid`/שהסתיים רשאי להצטרף מחדש. בתוך חיוב: נעילה לכל חשבון (`busy` 409 לשליחה שנייה במקביל, וגם ל-`start` באמצע חיוב). אחרי הצלחה ה-state החד-פעמי נצרך, ושליחה חוזרת של אותו identifier (טאב/מכשיר שני עם טוקן חדש) מקבלת 409 `already_subscribed` ולא נגבה שוב. identifier מזויף נשאר 400 (אין חשיפת סטטוס חשבון).
- **הוראת הקבע הישנה:** כש-past_due/unpaid מצטרף מחדש, אחרי שההוראה החדשה פעילה נקראת `payments.cancel` על ה-`RecurringCustomerItemID` הישן (נתיב הביטול הקיים). אם נכשל (SUMIT כבר ביטלה/השביתה), נרשם `subscription.superseded {cancelled:false}` ולא משפיע. הוראה שנכשלה אינה "פעילה" בסנכרון (סטטוסים 1, 3, 9, 13) ולכן SUMIT לא חייבת אותה.
- כפתור הביטול בדשבורד מוצג גם ב-`past_due`; ביטול הוראה מושבתת עלול להחזיר שגיאה מ-SUMIT (לא מאומת), לכן המייל אומר "השב למייל".

## 3. ממצאים וסיכונים (לפי חומרה)

1. **`TRUST_PROXY=1` לא עבד (תוקן בקוד).** המשתנה מגיע כמחרוזת "1", ו-Express מפרש מחרוזת כרשימת כתובות IP (`0.0.0.1`), כלומר ה-proxy של Render לא היה מהימן וכל המבקרים נראו כ-IP אחד. תוצאה אפשרית בפרודקשן: מגבלת "3 סריקות חינמיות ל-IP" ומגבלת ה-scan (5 ל-10 דקות) חלות על כל האתר יחד, ו-Turnstile מקבל `remoteip` של ה-proxy. תוקן ב-`a0c4436` (מספר → מספר קפיצות). **דורש פריסה כדי להשפיע.** אם Cloudflare מול Render, ייתכן שצריך `2`.
2. **דוח שבועי לא נשלח בפועל.** אין תזמון. נוסף `POST /api/internal/cron/weekly` (כבוי, `WEEKLY_EMAILS_ENABLED=1`), והטקסטים באתר ובתנאי השימוש/פרטיות (גרסה 1.2) אומרים כעת "מעקב שוטף (דוחות שבועיים בקרוב)".
3. **קבלה:** לא מאומת אם SUMIT שולחת אותה במייל (ראו משימה 1 ל-Ops). הבקשה לא שולחת `UpdateCustomerByEmail`/`UpdateCustomerByEmail_AttachDocument` (ברירת מחדל False לפי ה-OpenAPI).
4. **כתובת תמיכה** בפוטר ובקבלה: `shaysho1111@gmail.com` אלא אם `SUPPORT_EMAIL` מוגדר.
5. **שימוש לרעה בחשבון בתשלום (לא תוקן, החלטה):** `/api/scan` ו-`/scan` לא דורשים כניסה גם כשהמייל שייך לחשבון בתשלום. מי שמקליד כתובת של לקוח משלם (אחרי captcha) מוסיף לו עסק לחשבון, שורף מהתקציב החודשי של המסלול שלו (`monthlyCheckBudget`), ושולח לו דוח (עד 3 ביממה אחרי התיקון). הגבלת העלות: `DAILY_SPEND_CAP_USD`. המלצה: לחשבון עם מסלול בתשלום לדרוש מפתח דשבורד/כניסה (או לענות 409 עם קישור לכניסה).
6. דוחות הסריקה ב-fixes: שפת התיקונים נקבעת לפי שם העסק (`businessLang`), לא לפי שפת הלקוח; ללקוח עברי עם שם עסק באנגלית הטקסטים של "3 התיקונים" יהיו באנגלית בתוך מייל עברי.
7. לא נמצאו: קישורי `send.askranky.com`, ניסוח דמו/mock (חוץ מ-`[MOCK DATA]`/`[נתוני דמו]` כשסריקה mock), מע"מ או "חשבונית מס". המותג נכון. הקישורים נבנים מ-`BASE_URL`.

## 4. ניתוח שימוש לרעה במייל הדוח

- **נמען:** רק `account.email` של הכתובת שהוקלדה בטופס. שדות `cc`/`bcc`/`to` בבקשה מתעלמים (נבדק). כל סריקה שולחת מייל אחד.
- **מה מגביל שליחה לצדדים שלישיים בקנה מידה:**
  1. **Captcha (Turnstile):** כשהמפתחות מוגדרים, בלי טוקן תקף: 403 ולא נוצר חשבון ולא נשלח מייל (נבדק).
  2. **מגבלת IP:** 3 סריקות חינמיות מוצלחות לכל IP (מונה בזיכרון, מתאפס באתחול השרת) ו-5 בקשות סריקה ל-10 דקות לכל IP. כלומר IP אחד יכול לשלוח דוח לכל היותר ל-3 כתובות שונות (נבדק: ה-4 וה-5 מקבלים 429 בלי מייל). תלוי בכך ש-`TRUST_PROXY` עובד (סעיף 3 פריט 1).
  3. **סריקה חינמית אחת לכל כתובת:** מייל נוסף לאותה כתובת לא נשלח (עסק אחר 409, אותו עסק הפניה בלי מייל).
  4. **חדש: מגבלה לכל כתובת:** עד 3 מיילי דוח לכתובת ב-24 שעות (`REPORT_EMAIL_MAX_PER_DAY`, ברירת מחדל 3), חלון מתגלגל; מעבר לכך המייל מדולג בשקט, הסריקה והדוח המוצג במסך לא מושפעים, ורק אירוע `email.report_rate_limited` (ללא הכתובת) נרשם. חל גם על חשבונות בתשלום (שיכולים לסרוק כמה עסקים).
  5. **עלות:** כל סריקה אמיתית עולה כסף (≈$0.17–0.21); תקרה יומית `DAILY_SPEND_CAP_USD` ($10) עוצרת הכל, ועם מגבלת ה-IP התוקף מוגבל ל-3 סריקות ל-IP.
  6. בכל מייל דוח יש קישור הסרה חתום (+ List-Unsubscribe).
- **שארית סיכון:** בלי אימות מייל (double opt-in) אפשר עדיין לגרום לשליחת עד 3 דוחות ליממה לכתובת שמישהו הקליד, ממספר IP-ים שונים. הכתובת יכולה להסיר את עצמה. אם רוצים לסגור לגמרי: אימות מייל לפני שליחה (או שליחת הקישור לדוח רק אחרי לחיצה).

## 5. רשימת שינויים בענף

`618b8e4`, `d3fbcd9`, `be3b545` (מהסבב הקודם) ובנוסף: חסימת חיוב כפול (409 already_subscribed, נעילה, הוראה ישנה מבוטלת, UI בעברית/אנגלית), נקודת cron שבועית כבויה + ניסוח "מעקב שוטף (דוחות שבועיים בקרוב)" + תנאים ופרטיות 1.2, טקסט הקבלה, תיקון `TRUST_PROXY`, תרגום מיילי הדוח, מגבלה לכל כתובת.

## 6. הטקסטים המדויקים (ללא ה-HTML)

כל מייל טרנזקציוני כולל פוטר: שם, שם בעל העסק, "עוסק פטור"/"Exempt Dealer" + מספר, כתובת, אימייל תמיכה. מיילי הדוח כוללים פוטר עם שם, בעל העסק, כתובת וקישור הסרה.

### receipt he (renewal, no receiptUrl)
**Subject:** קבלה מ-Ranky: Pro, 179 ILS

```
תודה! התקבל תשלום של 179 ILS עבור מסלול Pro ב-Ranky.
קבלה על התשלום מונפקת על ידי ספק החיוב שלנו, SUMIT. אם היא לא הגיעה אליך, השב/י למייל זה ונדאג שתקבל/י אותה.
המנוי מתחדש מדי חודש בהוראת קבע עד לביטול. בתוקף עד: 2026-11-30.
לביטול: דרך הדשבורד, בתשובה למייל זה או בפנייה ל-shaysho1111@gmail.com.
שי שוטשוילי, עוסק פטור 322713082; המסמך הוא קבלה.
Ranky · שי שוטשוילי, עוסק פטור 322713082 · אצ"ל 8, בת ים, ישראל · shaysho1111@gmail.com
```

### receipt he (first payment, with receiptUrl)
**Subject:** קבלה מ-Ranky: Pro, 179 ILS

```
תודה! התקבל תשלום של 179 ILS עבור מסלול Pro ב-Ranky.
קבלה: [https://app.sumit.co.il/...](https://app.sumit.co.il/...)
המנוי מתחדש מדי חודש בהוראת קבע עד לביטול. בתוקף עד: 2026-11-30.
לביטול: דרך הדשבורד, בתשובה למייל זה או בפנייה ל-shaysho1111@gmail.com.
שי שוטשוילי, עוסק פטור 322713082; המסמך הוא קבלה.
Ranky · שי שוטשוילי, עוסק פטור 322713082 · אצ"ל 8, בת ים, ישראל · shaysho1111@gmail.com
```

### failed he
**Subject:** נדרשת פעולה: התשלום ל-Ranky לא עבר

```
לא הצלחנו לחייב את הכרטיס עבור מסלול Pro (179 ILS). המסלול שלך נשאר פעיל בתקופת חסד של 7 ימים.
כדי לשמור על המסלול, אפשר להצטרף שוב עם כרטיס תקין: [https://askranky.com/he/checkout?plan=pro](https://askranky.com/he/checkout?plan=pro) (יש להשתמש באותה כתובת מייל; תיווצר הוראת קבע חודשית חדשה והחיוב יבוצע מיד). עדיין אין טופס לעדכון כרטיס, ולכן כך מחליפים כרטיס. אפשר גם להשיב למייל זה ונעזור.
אם החוב לא יוסדר תוך 7 ימים, החשבון יעבור למסלול החינמי; המידע נשמר. אם אינך מעוניין/ת להמשיך, השב/י למייל זה ונדאג שלא יבוצעו חיובים נוספים.
לא נגבים דמי גבייה על חיוב שנכשל.
Ranky · שי שוטשוילי, עוסק פטור 322713082 · אצ"ל 8, בת ים, ישראל · shaysho1111@gmail.com
```

### cancel he
**Subject:** המנוי שלך ב-Ranky בוטל

```
זהו אישור שהוראת הקבע של מסלול Pro בוטלה בתאריך 2026-11-05. לא יבוצעו חיובים נוספים.
הגישה נשמרת עד 2026-11-30; לאחר מכן החשבון עובר למסלול החינמי.
התחרטת? פשוט השב/י.
Ranky · שי שוטשוילי, עוסק פטור 322713082 · אצ"ל 8, בת ים, ישראל · shaysho1111@gmail.com
```

### login he
**Subject:** קישור הכניסה שלך ל-Ranky

```
כניסה לדשבורד של Ranky: [https://askranky.com/auth/magic?a=ACCOUNT&t=TOKEN](https://askranky.com/auth/magic?a=ACCOUNT&t=TOKEN)
הקישור תקף ל-15 דקות ופועל פעם אחת בלבד.
אם לא ביקשת זאת, אפשר להתעלם ממייל זה.
Ranky · שי שוטשוילי, עוסק פטור 322713082 · אצ"ל 8, בת ים, ישראל · shaysho1111@gmail.com
```

### receipt en (renewal, no receiptUrl)
**Subject:** Ranky receipt: Pro, 179 ILS

```
Thanks! We received your payment of 179 ILS for the Ranky Pro plan.
A receipt (קבלה) is issued for this payment by our billing provider, SUMIT. If it doesn't reach you, reply to this email and we'll make sure you get it.
Your plan renews monthly by standing order until you cancel. Paid through: 2026-11-30.
To cancel, use your dashboard, reply to this email or contact shaysho1111@gmail.com.
Shai Shotashvili is an exempt dealer (עוסק פטור); this document is a receipt.
Ranky · Shai Shotashvili, Exempt Dealer 322713082 · Etzel 8, Bat Yam, Israel · shaysho1111@gmail.com
```

### receipt en (first payment, with receiptUrl)
**Subject:** Ranky receipt: Pro, 179 ILS

```
Thanks! We received your payment of 179 ILS for the Ranky Pro plan.
Receipt: [https://app.sumit.co.il/...](https://app.sumit.co.il/...)
Your plan renews monthly by standing order until you cancel. Paid through: 2026-11-30.
To cancel, use your dashboard, reply to this email or contact shaysho1111@gmail.com.
Shai Shotashvili is an exempt dealer (עוסק פטור); this document is a receipt.
Ranky · Shai Shotashvili, Exempt Dealer 322713082 · Etzel 8, Bat Yam, Israel · shaysho1111@gmail.com
```

### failed en
**Subject:** Action needed: your Ranky payment didn't go through

```
We couldn't charge your card for the Pro plan (179 ILS). Your plan stays active for a 7-day grace period.
To keep your plan, subscribe again with a valid card: [https://askranky.com/en/checkout?plan=pro](https://askranky.com/en/checkout?plan=pro) (use the same email address; a new monthly standing order is created and charged right away). There is no card-update form yet, so this is how a card is replaced. You can also reply to this email and we'll help.
If it isn't settled within 7 days, your account moves to the free tier; your data stays. If you don't want to continue, just reply and we'll make sure nothing more is charged.
No fees are added for failed payments.
Ranky · Shai Shotashvili, Exempt Dealer 322713082 · Etzel 8, Bat Yam, Israel · shaysho1111@gmail.com
```

### cancel en
**Subject:** Your Ranky subscription is cancelled

```
This confirms we cancelled your Pro plan's standing order on 2026-11-05. No further charges will be made.
You keep access until 2026-11-30; after that the account moves to the free tier.
Changed your mind? Just reply.
Ranky · Shai Shotashvili, Exempt Dealer 322713082 · Etzel 8, Bat Yam, Israel · shaysho1111@gmail.com
```

### login en
**Subject:** Your Ranky dashboard link

```
Open your Ranky dashboard: [https://askranky.com/auth/magic?a=ACCOUNT&t=TOKEN](https://askranky.com/auth/magic?a=ACCOUNT&t=TOKEN)
The link is valid for 15 minutes and works once.
If you didn't request this, you can ignore this email.
Ranky · Shai Shotashvili, Exempt Dealer 322713082 · Etzel 8, Bat Yam, Israel · shaysho1111@gmail.com
```

### report email he
**Subject:** הדוח שלך מ-Ranky: Maison Mana קיבל 7/100

```
כותרת בגוף: דוח נראות ב-AI של Ranky: Maison Mana
7/100 
העסק הוזכר ב-10% מתוך 10 תשובות AI. מיקום ממוצע: 2.
המנועים שרצו: ChatGPT, Gemini.
מנועאזכוריםדירוג ממוצע
chatgpt1/52
gemini0/5–
את מי ה-AI ממליץ במקומך
Example Co (3×)
3 התיקונים שלך
1. Fix title
Why text
Copy text
[לדוח המלא ←](https://askranky.com/r/ID)
התוצאות מגיעות מה-API של המנועים ועשויות להיות שונות מהאפליקציות הצרכניות. Ranky · שי שוטשוילי · אצ"ל 8, בת ים, ישראל · [הסרה מהרשימה](https://askranky.com/unsubscribe?t=TOKEN&lang=he)
```

### weekly email he
**Subject:** הדוח השבועי של Ranky: Maison Mana 7/100

```
כותרת בגוף: הדוח השבועי של Ranky: Maison Mana
7/100 ▲ 2
העסק הוזכר ב-10% מתוך 10 תשובות AI. מיקום ממוצע: 2.
המנועים שרצו: ChatGPT, Gemini.
מנועאזכוריםדירוג ממוצע
chatgpt1/52
gemini0/5–
את מי ה-AI ממליץ במקומך
Example Co (3×)
3 התיקונים של השבוע
1. Fix title
Why text
Copy text
[לדוח המלא ←](https://askranky.com/r/ID)
התוצאות מגיעות מה-API של המנועים ועשויות להיות שונות מהאפליקציות הצרכניות. Ranky · שי שוטשוילי · אצ"ל 8, בת ים, ישראל · [הסרה מהרשימה](https://askranky.com/unsubscribe?t=TOKEN&lang=he)
```

### report email en
**Subject:** Your Ranky report: Maison Mana scored 7/100

```
כותרת בגוף: Ranky AI visibility report: Maison Mana
7/100 
Mentioned in 10% of 10 AI answers. Average position: 2.
Engines that ran: ChatGPT, Gemini.
EngineMentionsAvg rank
chatgpt1/52
gemini0/5–
Who AI recommends instead
Example Co (3x)
Your 3 fixes
1. Fix title
Why text
Copy text
[See the full report →](https://askranky.com/r/ID)
Results come from the engines' APIs and can differ from the consumer apps. Ranky · Shai Shotashvili · Etzel 8, Bat Yam, Israel · [Unsubscribe](https://askranky.com/unsubscribe?t=TOKEN&lang=en)
```

### weekly email en
**Subject:** Ranky weekly: Maison Mana 7/100

```
כותרת בגוף: Ranky weekly report: Maison Mana
7/100 ▲ 2
Mentioned in 10% of 10 AI answers. Average position: 2.
Engines that ran: ChatGPT, Gemini.
EngineMentionsAvg rank
chatgpt1/52
gemini0/5–
Who AI recommends instead
Example Co (3x)
This week's 3 fixes
1. Fix title
Why text
Copy text
[See the full report →](https://askranky.com/r/ID)
Results come from the engines' APIs and can differ from the consumer apps. Ranky · Shai Shotashvili · Etzel 8, Bat Yam, Israel · [Unsubscribe](https://askranky.com/unsubscribe?t=TOKEN&lang=en)
```


### הטקסטים לפני התיקון (לשם השוואה)

- כשל בתשלום (EN): "To keep your plan, reply to this email and we'll send you a secure link to update your card. We'll retry the charge in a few days. If it's still unpaid after 7 days, your account will move to the free tier; your data stays."
- כשל בתשלום (HE): "כדי לשמור על המסלול, השב/י למייל ונשלח קישור מאובטח לעדכון כרטיס. ננסה לחייב שוב בעוד כמה ימים. אם החוב לא יוסדר תוך 7 ימים, החשבון יעבור למסלול החינמי; המידע נשמר."
- כניסה (EN בלבד, בלי פוטר): "Open your Ranky dashboard (link valid 15 minutes, single use): <קישור>. If you didn't request this, ignore this email." נושא: "Your Ranky dashboard link".
- דוח סריקה (EN): כותרת "Ranky weekly report: <עסק>", פסקה "This week's 3 fixes".
- דשבורד, מצב past_due: "Payment issue: we will retry the charge" / "בעיה בתשלום: ננסה לחייב שוב".

---

# נספח: האם אפשר לבנות עדכון כרטיס אמיתי עם SUMIT? (מחקר בלבד, לא מומש)

מקורות: ה-OpenAPI הרשמי `https://api.sumit.co.il/swagger/v1/swagger.json` (נבדק 2026-10-23), מאמר "Payments JavaScript API" (help.sumit.co.il/he/articles/5893615), מאמר "איך יוצרים הוראת קבע ב-SUMIT?", דף "גביה במערכת SUMIT" ומאמר "אמצעי תשלום בקריאות API" (קודי enum). מה שלא מופיע במסמכים מסומן "לא מאומת".

## מה המסמכים אומרים

- `POST /billing/paymentmethods/setforcustomer/` ("Set payment details"), תיאור: "To generate a SingleUseToken use payments.js". בקשה: `Credentials`, `Customer` (חובה; אנחנו כבר משתמשים ב-`ExternalIdentifier` + `SearchMode: 2`), `PaymentMethod` (אופציונלי), `SingleUseToken` ("Single use token, for all payment details... Used primarily by the Payments JavaScript API"). תשובה: `CustomerID` ו-`PaymentMethod` (עם `CreditCard_LastDigits`/`CardMask`).
- `POST /billing/paymentmethods/getforcustomer/` (עם `IncludeInactive`) ו-`/billing/paymentmethods/remove/` קיימים.
- `POST /billing/recurring/update/` מקבל רק `RecurringCustomerItemID`, `UnitPrice`, `Quantity`, `Recurrence`, `NextPaymentDate`, `LastPaymentDate`. אין בו שדה אמצעי תשלום ואין שדה סטטוס.
- `POST /billing/recurring/listforcustomer/` מחזיר `RecurringItems[]` עם `Status`: Active 0, Cancelled 1, DisabledFailedBillingPayment 3, FinishedExpired 9, GracePeriod 11, PendingForFirstPayment 12, CancelledByCustomer 13, PendingRetry 14.
- `POST /billing/recurring/charge/` (מה שאנחנו משתמשים בו) מקבל `PaymentMethod` ("Leave this empty to use the customer payment method, or when using the SingleUseToken") ו-`SingleUseToken`.
- מאמר "איך יוצרים הוראת קבע": "במידה וללקוח/ה אמצעי תשלום שמור במערכת הוא יתעדכן אוטומטית כאמצעי התשלום לחיוב הוראת הקבע. שינוי אמצעי התשלום יגרום לעדכון מקביל גם בכרטיס הלקוח/ה". כלומר הקשר בין אמצעי התשלום של הלקוח לבין הוראת הקבע קיים, לפחות בכיוון יצירת ההוראה מ-UI.
- `POST /accounting/customers/getdetailsurl/` מחזיר `CustomerHistoryURL` ("Link to the customer details page, דף מידע ללקוח/ה"). לא ברור מהמסמכים אם זה דף שהלקוח יכול לעדכן בו כרטיס. **לא מאומת**, ולא נראה מתאים כשער תשלום.
- הדף "גביה במערכת SUMIT" מזכיר "החלפות כרטיסי אשראי" (מודול שמקבל מחברות האשראי כרטיסים חדשים ומעדכן אמצעי תשלום בהוראות קבע) ו"שליחת קישור לתשלום" (מתוך מסמך חוב). שני אלה הם פיצ'רים של ממשק SUMIT, **לא** מופיעים כ-API ב-OpenAPI שבדקתי.

## לא מאומת (חייב בדיקה עם חשבון SUMIT אמיתי / תמיכה לפני בנייה)

1. האם `setforcustomer` על לקוח קיים מחליף את הכרטיס **שבו משתמשת הוראת קבע קיימת** (במסמכים אין הצהרה מפורשת בכיוון הזה).
2. האם הוראת קבע בסטטוס `DisabledFailedBillingPayment` (3) יכולה להיות מופעלת מחדש אחרי החלפת כרטיס. ב-OpenAPI אין endpoint "הפעל מחדש", ו-`recurring/update` לא משנה סטטוס. סביר שנדרש להקים הוראה חדשה (ובכך החיוב הראשון מיד).
3. מה מתרחש עם `GracePeriod`/`PendingRetry` (תזמון הניסיונות החוזרים של SUMIT, לא מתועד שם).
4. האם נדרש CVV/ת"ז בעדכון (תלוי בפטור CVV של המסוף; נאמר "נדרש פטור מהזנת CVV" להוראות קבע).

## עיצוב סביר

אפשרות A (מומלצת, הכי זולה וללא סיכון להוראה כפולה): **"הצטרפות מחדש" ככרטיס חדש**, שזה בעצם מה שהמייל המתוקן אומר עכשיו. הטופס המוטמע הקיים (`/{lang}/checkout`) כבר יוצר הוראת קבע חדשה וחיוב מיידי. נדרש רק: מגן בצד שרת נגד הוראה כפולה (לבטל את הישנה / לבדוק `sync` לפני יצירה), הקישור מהדשבורד במצב past_due, וטקסט.

אפשרות B (עדכון כרטיס אמיתי, אם בדיקה (1) תעבור): 
- דף חדש `/{lang}/billing/update-card` לאחר כניסה (magic link), אותו טופס Payments JS (`data-og` בלי `name`, CSP קיים) בלי מחיר.
- endpoint חדש `POST /api/dashboard/:id/payment-method` (מפתח דשבורד, `noCardData`, rate limit, `validSingleUseToken`) שקורא ל-`/billing/paymentmethods/setforcustomer/` עם `{ Credentials, Customer: { ExternalIdentifier: account.id, SearchMode: 2 }, SingleUseToken }`. אחרי הצלחה: לנקות `pastDueSince`/`failedNoticeAt`, לקרוא ל-`payments.sync` ולעדכן סטטוס, ולשלוח אישור במייל. אסור לרשום ללוג את הטוקן או תשובת SUMIT.
- אם ההוראה מושבתת (סטטוס 3): הקמת הוראה חדשה עם הטוקן (`recurring/charge`) במקום `setforcustomer`, ולבטל את הישנה. זה זהה לאפשרות A.
- שדות/פונקציות חדשים בקוד: `payments.setPaymentMethod(account, token)` ב-`sumit.js` ובמוק, בדיקות מול fetch מדומה.

## סיכונים

- סיכון הוראה כפולה/חיוב כפול (ראו סעיף 2 בביקורת).
- כיסוי PCI נשאר כמו היום: הכרטיס עובר רק דפדפן → SUMIT.
- התנהגות SUMIT לא מתועדת (1)-(4) למעלה. בלי בדיקה אמיתית אי אפשר להבטיח שהכרטיס החדש ישמש את ההוראה הקיימת.
- שגיאות "כרטיס נדחה" מ-SUMIT: מסך מדומה לא מראה אותן; צריך בדיקת ₪1.

## הערכת מאמץ (גסה)

- אפשרות A: כ-0.5 עד 1 יום (מגן כפילות + קישור בדשבורד + בדיקות + בדיקת ₪1).
- אפשרות B: כ-1.5 עד 2.5 ימים לקוד, בדיקות ועיצוב, בתוספת בדיקה אחת או שתיים מול חשבון SUMIT אמיתי (כרטיס אמיתי/₪1) וייתכן פנייה לתמיכת SUMIT לגבי (1)-(3).
