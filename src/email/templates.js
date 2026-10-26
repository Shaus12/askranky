// Transactional emails (receipt, payment failed, sign-in link, cancellation), HE + EN. Link vars: receiptUrl / link (http(s) only).
// No VAT wording (עוסק פטור: receipt / קבלה only). All values are HTML-escaped.
import { BRAND } from '../brand.js'; import { esc, safeUrl } from '../security/html.js';
const T = {
  receipt: {
    en: { subject: v => `${v.brand} receipt: ${v.planName}, ${v.amount} ${v.currency}`, body: v => [
      `Thanks! We received your payment of <b>${v.amount} ${v.currency}</b> for the ${v.brand} ${v.planName} plan.`,
      v.receiptUrl ? `Receipt: <a href="${v.receiptUrlRaw}">${v.receiptUrl}</a>` : `A receipt (קבלה) is issued for this payment by our billing provider, SUMIT. If it doesn't reach you, reply to this email and we'll make sure you get it.`,
      `Your plan renews monthly by standing order until you cancel.${v.paidThrough ? ` Paid through: ${v.paidThrough}.` : ''}`,
      `To cancel, use your dashboard, reply to this email or contact ${v.supportEmail}.`,
      `${v.legalEntity} is an exempt dealer (עוסק פטור); this document is a receipt.`] },
    he: { subject: v => `קבלה מ-${v.brand}: ${v.planName}, ${v.amount} ${v.currency}`, body: v => [
      `תודה! התקבל תשלום של <b>${v.amount} ${v.currency}</b> עבור מסלול ${v.planName} ב-${v.brand}.`,
      v.receiptUrl ? `קבלה: <a href="${v.receiptUrlRaw}">${v.receiptUrl}</a>` : `קבלה על התשלום מונפקת על ידי ספק החיוב שלנו, SUMIT. אם היא לא הגיעה אליך, השב/י למייל זה ונדאג שתקבל/י אותה.`,
      `המנוי מתחדש מדי חודש בהוראת קבע עד לביטול.${v.paidThrough ? ` בתוקף עד: ${v.paidThrough}.` : ''}`,
      `לביטול: דרך הדשבורד, בתשובה למייל זה או בפנייה ל-${v.supportEmail}.`,
      `${v.legalEntityHe}, עוסק פטור ${v.entityId}; המסמך הוא קבלה.`] },
  },
  failed: {
    en: { subject: v => `Action needed: your ${v.brand} payment didn't go through`, body: v => [
      `We couldn't charge your card for the ${v.planName} plan (${v.amount} ${v.currency}). Your plan stays active for a 7-day grace period.`,
      v.linkRaw ? `To keep your plan, subscribe again with a valid card: <a href="${v.linkRaw}">${v.link}</a> (use the same email address; a new monthly standing order is created and charged right away). There is no card-update form yet, so this is how a card is replaced. You can also reply to this email and we'll help.`
        : `To keep your plan, reply to this email and we'll help you subscribe again with a valid card. There is no card-update form yet.`,
      `If it isn't settled within 7 days, your account moves to the free tier; your data stays. If you don't want to continue, just reply and we'll make sure nothing more is charged.`,
      `No fees are added for failed payments.`] },
    he: { subject: v => `נדרשת פעולה: התשלום ל-${v.brand} לא עבר`, body: v => [
      `לא הצלחנו לחייב את הכרטיס עבור מסלול ${v.planName} (${v.amount} ${v.currency}). המסלול שלך נשאר פעיל בתקופת חסד של 7 ימים.`,
      v.linkRaw ? `כדי לשמור על המסלול, אפשר להצטרף שוב עם כרטיס תקין: <a href="${v.linkRaw}">${v.link}</a> (יש להשתמש באותה כתובת מייל; תיווצר הוראת קבע חודשית חדשה והחיוב יבוצע מיד). עדיין אין טופס לעדכון כרטיס, ולכן כך מחליפים כרטיס. אפשר גם להשיב למייל זה ונעזור.`
        : `כדי לשמור על המסלול, השב/י למייל זה ונעזור לך להצטרף שוב עם כרטיס תקין. עדיין אין טופס לעדכון כרטיס.`,
      `אם החוב לא יוסדר תוך 7 ימים, החשבון יעבור למסלול החינמי; המידע נשמר. אם אינך מעוניין/ת להמשיך, השב/י למייל זה ונדאג שלא יבוצעו חיובים נוספים.`,
      `לא נגבים דמי גבייה על חיוב שנכשל.`] },
  },
  login: {
    en: { subject: v => `Your ${v.brand} dashboard link`, body: v => [
      `Open your ${v.brand} dashboard: <a href="${v.linkRaw}">${v.link}</a>`,
      `The link is valid for 15 minutes and works once.`,
      `If you didn't request this, you can ignore this email.`] },
    he: { subject: v => `קישור הכניסה שלך ל-${v.brand}`, body: v => [
      `כניסה לדשבורד של ${v.brand}: <a href="${v.linkRaw}">${v.link}</a>`,
      `הקישור תקף ל-15 דקות ופועל פעם אחת בלבד.`,
      `אם לא ביקשת זאת, אפשר להתעלם ממייל זה.`] },
  },
  cancel: {
    en: { subject: v => `Your ${v.brand} subscription is cancelled`, body: v => [
      `This confirms we cancelled your ${v.planName} plan's standing order on ${v.cancelDate}. <b>No further charges will be made.</b>`,
      `You keep access until ${v.paidThrough}; after that the account moves to the free tier.${v.refundAmount ? ` A refund of ${v.refundAmount} ${v.currency} will reach your card within 14 days.` : ''}`,
      `Changed your mind? Just reply.`] },
    he: { subject: v => `המנוי שלך ב-${v.brand} בוטל`, body: v => [
      `זהו אישור שהוראת הקבע של מסלול ${v.planName} בוטלה בתאריך ${v.cancelDate}. <b>לא יבוצעו חיובים נוספים.</b>`,
      `הגישה נשמרת עד ${v.paidThrough}; לאחר מכן החשבון עובר למסלול החינמי.${v.refundAmount ? ` החזר של ${v.refundAmount} ${v.currency} יגיע לכרטיס תוך 14 יום.` : ''}`,
      `התחרטת? פשוט השב/י.`] },
  },
  verify: {
    en: { subject: v => `Confirm your email for ${v.brand}`, body: v => [
      `Confirm your email to finish creating your ${v.brand} password: <a href="${v.linkRaw}">${v.link}</a>`,
      `The link is valid for 24 hours and works once.`, `If you didn't sign up, you can ignore this email; nothing changes.`] },
    he: { subject: v => `אישור האימייל שלך ב-${v.brand}`, body: v => [
      `כדי לסיים את יצירת הסיסמה ב-${v.brand}, יש לאשר את האימייל: <a href="${v.linkRaw}">${v.link}</a>`,
      `הקישור תקף ל-24 שעות ופועל פעם אחת בלבד.`, `אם לא נרשמת, אפשר להתעלם ממייל זה. שום דבר לא ישתנה.`] },
  },
  reset: {
    en: { subject: v => `Reset your ${v.brand} password`, body: v => [
      `Choose a new ${v.brand} password: <a href="${v.linkRaw}">${v.link}</a>`,
      `The link is valid for 30 minutes and works once. Setting a new password signs out all your other sessions.`, `If you didn't ask for this, you can ignore this email.`] },
    he: { subject: v => `איפוס הסיסמה שלך ב-${v.brand}`, body: v => [
      `בחירת סיסמה חדשה ל-${v.brand}: <a href="${v.linkRaw}">${v.link}</a>`,
      `הקישור תקף ל-30 דקות ופועל פעם אחת בלבד. סיסמה חדשה מנתקת את כל שאר החיבורים שלך.`, `אם לא ביקשת זאת, אפשר להתעלם ממייל זה.`] },
  },
  exists: {
    en: { subject: v => `You already have a ${v.brand} account`, body: v => [
      `Someone (hopefully you) tried to sign up with this email, but it already has a ${v.brand} password. Sign in: <a href="${v.linkRaw}">${v.link}</a>`,
      `Forgot the password? Reset it (valid 30 minutes): <a href="${v.resetLink}">${v.resetLink}</a>`, `If this wasn't you, ignore this email; nothing changed.`] },
    he: { subject: v => `כבר יש לך חשבון ב-${v.brand}`, body: v => [
      `מישהו (כנראה את/ה) ניסה להירשם עם האימייל הזה, אבל כבר יש לו סיסמה ב-${v.brand}. כניסה: <a href="${v.linkRaw}">${v.link}</a>`,
      `שכחת את הסיסמה? איפוס (תקף ל-30 דקות): <a href="${v.resetLink}">${v.resetLink}</a>`, `אם זה לא את/ה, אפשר להתעלם. שום דבר לא השתנה.`] },
  },
};
export const TX_KINDS = Object.keys(T);
export function footer(lang) {
  return lang === 'he' ? `${esc(BRAND.name)} · ${esc(BRAND.legalEntityHe)}, עוסק פטור ${esc(BRAND.entityId)} · ${esc(BRAND.addressHe)} · ${esc(BRAND.supportEmail)}`
    : `${esc(BRAND.name)} · ${esc(BRAND.legalEntity)}, Exempt Dealer ${esc(BRAND.entityId)} · ${esc(BRAND.address)} · ${esc(BRAND.supportEmail)}`;
}
export function renderTx(kind, lang, vars = {}) { // receiptUrl: http(s) only, otherwise the line says the billing provider issues it and to reply if it doesn't arrive
  const l = lang === 'he' ? 'he' : 'en'; const t = T[kind]?.[l]; if (!t) throw new Error('unknown email ' + kind);
  const safeReceipt = vars.receiptUrl && safeUrl(vars.receiptUrl) !== '#' ? vars.receiptUrl : ''; vars = { ...vars, receiptUrl: safeReceipt };
  const safeLink = vars.link && safeUrl(vars.link) !== '#' ? vars.link : ''; vars = { ...vars, link: safeLink, ...(vars.resetLink !== undefined ? { resetLink: safeUrl(vars.resetLink) !== '#' ? vars.resetLink : '' } : {}) };
  const raw = { brand: BRAND.name, supportEmail: BRAND.supportEmail, legalEntity: BRAND.legalEntity, legalEntityHe: BRAND.legalEntityHe, entityId: BRAND.entityId, ...vars };
  const v = Object.fromEntries(Object.entries(raw).map(([k, x]) => [k, esc(x ?? '')])); v.receiptUrlRaw = vars.receiptUrl ? safeUrl(vars.receiptUrl) : ''; v.linkRaw = safeLink ? safeUrl(safeLink) : '';
  const subject = t.subject(raw);
  const html = `<!doctype html><html lang="${l}" dir="${l === 'he' ? 'rtl' : 'ltr'}"><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111">
<h2 style="color:${esc(BRAND.color)}">${esc(subject)}</h2>${t.body(v).map(p => `<p>${p}</p>`).join('\n')}
<p style="color:#888;font-size:12px">${footer(l)}</p></body></html>`;
  return { subject, html };
}
