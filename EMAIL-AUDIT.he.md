# ביקורת מיילים אוטומטיים ללקוחות — Ranky (askranky.com)

נכון ל-`email-fixes` (מבוסס על main = 638e291). הטקסטים המדויקים נוצרו מהקוד עצמו (`src/email/templates.js`, `src/email/report.js`), ערכי הדוגמה הם: מסלול Pro, 179 ILS, עד 2026-11-30. כתובת השולח: `Ranky <hello@askranky.com>`, reply-to: `EMAIL_REPLY_TO` (שי ב-Gmail). כל המיילים עוברים דרך `src/email/send.js`.

## 1. טבלת סיכום

| # | מייל | טריגר | נמען | נושא (EN / HE) | שליחה | שפות | מה נמצא / מה תוקן |
|---|------|--------|------|-----------------|--------|-------|--------------------|
| 1 | קישור כניסה (magic link) | `POST /login`, `/api/login` (אחרי captcha) ובסיום תשלום מוצלח (`completeCheckout`) | בעל החשבון | `Your Ranky dashboard link` / `קישור הכניסה שלך ל-Ranky` | `sendEmail` (במסלול התשלום עם `.catch`) | **תוקן:** לפני כן רק אנגלית, בלי פוטר ובלי זהות שולח. עכשיו HE/EN לפי שפת הדף (נשלחת מהטופס), אחרת שפת החשבון, אחרת EN. הקישור עדיין ה-href הראשון | 
| 2 | דוח סריקה (חד פעמי) | אחרי כל סריקה חינמית שהצליחה (`/scan`, `/api/scan`) | מי שהזין את המייל בטופס | `Your Ranky report: <עסק> scored N/100` | `sendEmailSoft` | **EN בלבד** (גם ללקוח עברי) | **תוקן:** הכותרת אמרה "weekly report" ו"This week's 3 fixes" למרות שזה דוח חד פעמי; עכשיו "AI visibility report" ו"Your 3 fixes". נוספה כתובת דואר לפוטר. **לא תוקן:** חסר תרגום עברי (עבודה גדולה יחסית, צריך החלטה) |
| 3 | דוח שבועי | `npm run weekly` / `runWeekly` | חשבונות בתשלום שלא ביטלו הסרה | `Ranky weekly: <עסק> N/100` | `sendEmail` בתוך try (שגיאה נרשמת ללוג) | EN בלבד | **חריג חמור:** שום דבר לא מפעיל את `runWeekly` בפרודקשן (אין cron ב-Render החינמי, ו-`/api/internal/cron/sync` מריץ רק billing sync). כלומר המסלולים מבטיחים "Weekly tracking + email report" והמייל השבועי **לא נשלח אף פעם**. נוספה כתובת דואר לפוטר |
| 4 | קבלה / חידוש | תשלום ראשון (`completeCheckout`) וחידוש חודשי שזוהה ב-`billing-sync` | בעל החשבון | `Ranky receipt: <מסלול>, <סכום> ILS` / `קבלה מ-Ranky: ...` | ראשון: `sendEmailSoft`. חידוש: **תוקן** מ-`sendEmail` ל-`sendEmailSoft` | HE/EN | הטקסט נשאר. ראו הערות סיכון בסעיף 3 |
| 5 | כשל בתשלום | `billing-sync` מזהה שהוראת הקבע לא פעילה, פעם אחת לכל "אירוע כשל" | בעל החשבון | `Action needed: your Ranky payment didn't go through` / `נדרשת פעולה: התשלום ל-Ranky לא עבר` | **תוקן** מ-`sendEmail` ל-`sendEmailSoft` | HE/EN | **תוקן הטקסט:** הבטיח "קישור מאובטח לעדכון כרטיס" ו"ננסה לחייב שוב בעוד כמה ימים". אף אחד מהם לא קיים. עכשיו: קישור `/{lang}/checkout?plan=...` להצטרפות מחדש עם כרטיס תקין (באותו מייל), או תשובה למייל. בלי הבטחת ניסיון חוזר. ראו דה-דופליקציה למטה |
| 6 | אישור ביטול | `POST /api/dashboard/:id/cancel` | בעל החשבון | `Your Ranky subscription is cancelled` / `המנוי שלך ב-Ranky בוטל` | `sendEmailSoft` | HE/EN | תקין. אין סכום החזר (לא מועבר `refundAmount`, והחזרים ידניים) |
| 7 | אישור רשימת המתנה | `POST /api/waitlist` | — | — | **לא נשלח מייל** | — | רק שמירה ב-DB. מצב PRELAUNCH כבוי כרגע |
| 8 | "סריקה חינמית אחת לכל אימייל" | `/scan` שנייה לאותו מייל | — | — | **לא נשלח מייל** (רק הודעה באתר) | — | — |
| 9 | שיווק / חדשות מוצר | — | — | — | **אין קוד ששולח** | — | נשמרת הסכמה (`marketingConsent`) מטופס הסריקה אבל שום מייל שיווקי לא נשלח כרגע; אם יתווסף יש להוסיף תווית "פרסומת" ו-List-Unsubscribe (התשתית קיימת ב-`consent.js`) |

## 2. מצב כשל בתשלום: דה-דופליקציה

- המייל נשלח רק כש-`a.failedNoticeAt` ריק. הוא נקבע לפני השליחה ומתנקה רק כשהוראת הקבע חוזרת להיות פעילה. לכן הרצה יומית חוזרת **לא** שולחת שוב (יש בדיקה קיימת: "failed notice sent once"), וכשל חדש אחרי התאוששות כן ישלח שוב.
- **באג שתוקן:** המייל נשלח עם `sendEmail` (זורק שגיאה). תקלה ב-Resend בחשבון אחד עצרה את כל הסנכרון באמצע ודילגה על חשבונות אחרים ועל `save()`. עכשיו `sendEmailSoft`, השגיאה נרשמת בלוג על ידי `send.js` ובאירוע `billing.email_failed` (בלי PII), וההרצה ממשיכה. תוצאה: אם השליחה נכשלה, **לא** ננסה שוב ביום הבא (בכוונה, כדי לא להציף). אפשר להחליט אחרת.
- חשוב: `sync()` מחשיב סטטוסים `GracePeriod` (11) ו-`PendingRetry` (14) כ"פעיל". לכן מייל הכשל נשלח רק אחרי ש-SUMIT סיימה לנסות לבד (סטטוס כמו `DisabledFailedBillingPayment` (3) לפי ה-OpenAPI). מכאן שהבטחת "ננסה שוב" בטקסט הישן הייתה שגויה גם מהכיוון הזה.
- **סיכון שנמצא ולא תוקן:** `startCheckout`/`completeCheckout` לא בודקים אם לחשבון כבר יש הוראת קבע פעילה. מי שלוחץ על הקישור במייל וגם מחובר עם הוראת קבע פעילה יוצר הוראה כפולה (וחיוב כפול). בקישור שבמייל זה קורה רק אחרי כשל, אבל מומלץ מגן בצד שרת (לבדוק `payments.sync` לפני יצירת הוראה חדשה, או לבטל את הישנה). הוראת קבע ישנה שנכשלה נשארת מושבתת ב-SUMIT, החשבון מקבל `subscriptionRef` חדש.
- כפתור הביטול בדשבורד מוצג גם במצב `past_due`. ביטול הוראה שכבר מושבתת עלול להחזיר שגיאה מ-SUMIT (502 "Could not cancel") — לא מאומת. לכן במייל כתוב "השב למייל ונדאג שלא יחויב", ולא "בטל בדשבורד".

## 3. סיכוני תוכן / ציות שנמצאו (לפי חומרה)

1. **דוח שבועי לא נשלח בפועל** (ראו שורה 3). הבטחה מסחרית באתר ובתנאי השימוש ("דוחות שבועיים הכלולים במסלול"). צריך להחליט: להוסיף endpoint מוגן-secret ל-cron-job.org (כמו ה-sync), או להסיר את ההבטחה.
2. **קבלה "נשלחת בנפרד" על ידי SUMIT, לא מאומת.** הבקשה ל-`/billing/recurring/charge/` לא שולחת `UpdateCustomerByEmail`/`UpdateCustomerByEmail_AttachDocument` (ברירת מחדל False לפי ה-OpenAPI), ו-`SendCopyToOrganization` תלוי בהגדרות החשבונאות. אם שליחת מסמך אוטומטית במייל לא מופעלת בהגדרות SUMIT, הלקוח לא יקבל קבלה וה-מייל שלנו אומר שכן. לבדוק בדשבורד של SUMIT (או לתקן בקוד אחרי בדיקת ₪1) — `receiptUrl` אף פעם לא מגיע מ-`handleReturn` ולכן תמיד מוצג "נשלחת בנפרד".
3. **כתובת התמיכה בפוטר ובקבלה: `support@askranky.com` כברירת מחדל** (`BRAND.supportEmail`, אלא אם `SUPPORT_EMAIL` מוגדר ב-Render). ההחלטה העסקית היא shaysho1111@gmail.com. אם התיבה support@ לא קיימת, פניות לקוחות הולכות לאיבוד. לוודא `SUPPORT_EMAIL` ב-Render (Grok Bot) — לא שיניתי env וברירת המחדל.
4. **מייל דוח (2) ו-(3) באנגלית בלבד** גם ללקוחות בעברית (אין שפה בתבנית). פער חוויה, לא טעות.
5. **דוח הסריקה נשלח לכל כתובת שהוקלדה** (אחרי captcha, בלי אימות מייל): אפשר להפעיל אותו על כתובת של אדם אחר. יש קישור הסרה בכל מייל, ובמגבלת 3 סריקות ל-IP, אבל אין double opt-in. סיכון נמוך (חוק התקשורת סעיף 30א חל על פרסומת, וזה מייל שירות).
6. לא נמצאו: קישורי `send.askranky.com`, ניסוח דמו/mock בגוף מיילים (חוץ מ-`[MOCK DATA]` בפוטר דוח כשהסריקה באמת mock; לא קורה ב-live), מע"מ או "חשבונית מס" (הקבלה: "עוסק פטור; המסמך הוא קבלה"). המותג Ranky נכון בכל מקום. קישורי הכניסה והדוח נבנים מ-`BASE_URL`; אם הוא חסר הם יצביעו ל-localhost (config-check נותן שגיאה במצב sumit).

## 4. רשימת שינויים בענף

1. `618b8e4`: טקסט כשל בתשלום (he/en), `sendEmailSoft` ב-sync (כשל וגם קבלת חידוש), תבנית `login` חדשה, תמיכה ב-`link` בטוח ב-`renderTx`, בדיקות.
2. `d3fbcd9`: מייל כניסה HE/EN עם פוטר (והטופס שולח `lang`), דוח חד פעמי לא נקרא "weekly", כתובת דואר בפוטר הדוחות, טקסט `pastDue` בדשבורד ("ננסה לחייב שוב" הוסר).
3. קובץ הביקורת הזה.

## 5. הטקסטים המדויקים (ללא ה-HTML)

כל מייל טרנזקציוני כולל את הפוטר: שם, שם בעל העסק, "עוסק פטור"/"Exempt Dealer" + מספר, כתובת, אימייל תמיכה.

### receipt he (renewal, no receiptUrl)
**Subject:** קבלה מ-Ranky: Pro, 179 ILS

```
תודה! התקבל תשלום של 179 ILS עבור מסלול Pro ב-Ranky.
הקבלה מופקת על ידי ספק התשלומים ונשלחת בנפרד.
המנוי מתחדש מדי חודש בהוראת קבע עד לביטול. בתוקף עד: 2026-11-30.
לביטול: דרך הדשבורד, בתשובה למייל זה או בפנייה ל-support@askranky.com.
שי שוטשוילי, עוסק פטור 322713082; המסמך הוא קבלה.
Ranky · שי שוטשוילי, עוסק פטור 322713082 · אצ"ל 8, בת ים, ישראל · support@askranky.com
```

### receipt he (first payment, with receiptUrl)
**Subject:** קבלה מ-Ranky: Pro, 179 ILS

```
תודה! התקבל תשלום של 179 ILS עבור מסלול Pro ב-Ranky.
קבלה: [https://app.sumit.co.il/...](https://app.sumit.co.il/...)
המנוי מתחדש מדי חודש בהוראת קבע עד לביטול. בתוקף עד: 2026-11-30.
לביטול: דרך הדשבורד, בתשובה למייל זה או בפנייה ל-support@askranky.com.
שי שוטשוילי, עוסק פטור 322713082; המסמך הוא קבלה.
Ranky · שי שוטשוילי, עוסק פטור 322713082 · אצ"ל 8, בת ים, ישראל · support@askranky.com
```

### failed he
**Subject:** נדרשת פעולה: התשלום ל-Ranky לא עבר

```
לא הצלחנו לחייב את הכרטיס עבור מסלול Pro (179 ILS). המסלול שלך נשאר פעיל בתקופת חסד של 7 ימים.
כדי לשמור על המסלול, אפשר להצטרף שוב עם כרטיס תקין: [https://askranky.com/he/checkout?plan=pro](https://askranky.com/he/checkout?plan=pro) (יש להשתמש באותה כתובת מייל; תיווצר הוראת קבע חודשית חדשה והחיוב יבוצע מיד). עדיין אין טופס לעדכון כרטיס, ולכן כך מחליפים כרטיס. אפשר גם להשיב למייל זה ונעזור.
אם החוב לא יוסדר תוך 7 ימים, החשבון יעבור למסלול החינמי; המידע נשמר. אם אינך מעוניין/ת להמשיך, השב/י למייל זה ונדאג שלא יבוצעו חיובים נוספים.
לא נגבים דמי גבייה על חיוב שנכשל.
Ranky · שי שוטשוילי, עוסק פטור 322713082 · אצ"ל 8, בת ים, ישראל · support@askranky.com
```

### cancel he
**Subject:** המנוי שלך ב-Ranky בוטל

```
זהו אישור שהוראת הקבע של מסלול Pro בוטלה בתאריך 2026-11-05. לא יבוצעו חיובים נוספים.
הגישה נשמרת עד 2026-11-30; לאחר מכן החשבון עובר למסלול החינמי.
התחרטת? פשוט השב/י.
Ranky · שי שוטשוילי, עוסק פטור 322713082 · אצ"ל 8, בת ים, ישראל · support@askranky.com
```

### login he
**Subject:** קישור הכניסה שלך ל-Ranky

```
כניסה לדשבורד של Ranky: [https://askranky.com/auth/magic?a=ACCOUNT&t=TOKEN](https://askranky.com/auth/magic?a=ACCOUNT&t=TOKEN)
הקישור תקף ל-15 דקות ופועל פעם אחת בלבד.
אם לא ביקשת זאת, אפשר להתעלם ממייל זה.
Ranky · שי שוטשוילי, עוסק פטור 322713082 · אצ"ל 8, בת ים, ישראל · support@askranky.com
```

### receipt en (renewal, no receiptUrl)
**Subject:** Ranky receipt: Pro, 179 ILS

```
Thanks! We received your payment of 179 ILS for the Ranky Pro plan.
Your receipt (קבלה) is issued by our payment provider and sent separately.
Your plan renews monthly by standing order until you cancel. Paid through: 2026-11-30.
To cancel, use your dashboard, reply to this email or contact support@askranky.com.
Shai Shotashvili is an exempt dealer (עוסק פטור); this document is a receipt.
Ranky · Shai Shotashvili, Exempt Dealer 322713082 · Etzel 8, Bat Yam, Israel · support@askranky.com
```

### receipt en (first payment, with receiptUrl)
**Subject:** Ranky receipt: Pro, 179 ILS

```
Thanks! We received your payment of 179 ILS for the Ranky Pro plan.
Receipt: [https://app.sumit.co.il/...](https://app.sumit.co.il/...)
Your plan renews monthly by standing order until you cancel. Paid through: 2026-11-30.
To cancel, use your dashboard, reply to this email or contact support@askranky.com.
Shai Shotashvili is an exempt dealer (עוסק פטור); this document is a receipt.
Ranky · Shai Shotashvili, Exempt Dealer 322713082 · Etzel 8, Bat Yam, Israel · support@askranky.com
```

### failed en
**Subject:** Action needed: your Ranky payment didn't go through

```
We couldn't charge your card for the Pro plan (179 ILS). Your plan stays active for a 7-day grace period.
To keep your plan, subscribe again with a valid card: [https://askranky.com/en/checkout?plan=pro](https://askranky.com/en/checkout?plan=pro) (use the same email address; a new monthly standing order is created and charged right away). There is no card-update form yet, so this is how a card is replaced. You can also reply to this email and we'll help.
If it isn't settled within 7 days, your account moves to the free tier; your data stays. If you don't want to continue, just reply and we'll make sure nothing more is charged.
No fees are added for failed payments.
Ranky · Shai Shotashvili, Exempt Dealer 322713082 · Etzel 8, Bat Yam, Israel · support@askranky.com
```

### cancel en
**Subject:** Your Ranky subscription is cancelled

```
This confirms we cancelled your Pro plan's standing order on 2026-11-05. No further charges will be made.
You keep access until 2026-11-30; after that the account moves to the free tier.
Changed your mind? Just reply.
Ranky · Shai Shotashvili, Exempt Dealer 322713082 · Etzel 8, Bat Yam, Israel · support@askranky.com
```

### login en
**Subject:** Your Ranky dashboard link

```
Open your Ranky dashboard: [https://askranky.com/auth/magic?a=ACCOUNT&t=TOKEN](https://askranky.com/auth/magic?a=ACCOUNT&t=TOKEN)
The link is valid for 15 minutes and works once.
If you didn't request this, you can ignore this email.
Ranky · Shai Shotashvili, Exempt Dealer 322713082 · Etzel 8, Bat Yam, Israel · support@askranky.com
```

### report email (EN only)

```
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

### weekly email (EN only)

```
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
