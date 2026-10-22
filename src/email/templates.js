// Transactional emails from ops/email-templates/onboarding.md (§4 receipt, §5 payment failed, §6 cancellation), HE + EN.
// No VAT wording (עוסק פטור: receipt / קבלה only). All values are HTML-escaped.
import { BRAND } from '../brand.js'; import { esc, safeUrl } from '../security/html.js';
const T = {
  receipt: {
    en: { subject: v => `${v.brand} receipt: ${v.planName}, ${v.amount} ${v.currency}`, body: v => [
      `Thanks! We received your payment of <b>${v.amount} ${v.currency}</b> for the ${v.brand} ${v.planName} plan.`,
      v.receiptUrl ? `Receipt: <a href="${v.receiptUrlRaw}">${v.receiptUrl}</a>` : `Your receipt (קבלה) is issued by our payment provider and sent separately.`,
      `Your plan renews monthly by standing order until you cancel.${v.paidThrough ? ` Paid through: ${v.paidThrough}.` : ''}`,
      `To cancel, use your dashboard, reply to this email or contact ${v.supportEmail}.`,
      `${v.legalEntity} is an exempt dealer (עוסק פטור); this document is a receipt.`] },
    he: { subject: v => `קבלה מ-${v.brand}: ${v.planName}, ${v.amount} ${v.currency}`, body: v => [
      `תודה! התקבל תשלום של <b>${v.amount} ${v.currency}</b> עבור מסלול ${v.planName} ב-${v.brand}.`,
      v.receiptUrl ? `קבלה: <a href="${v.receiptUrlRaw}">${v.receiptUrl}</a>` : `הקבלה מופקת על ידי ספק התשלומים ונשלחת בנפרד.`,
      `המנוי מתחדש מדי חודש בהוראת קבע עד לביטול.${v.paidThrough ? ` בתוקף עד: ${v.paidThrough}.` : ''}`,
      `לביטול: דרך הדשבורד, בתשובה למייל זה או בפנייה ל-${v.supportEmail}.`,
      `${v.legalEntityHe}, עוסק פטור ${v.entityId}; המסמך הוא קבלה.`] },
  },
  failed: {
    en: { subject: v => `Action needed: your ${v.brand} payment didn't go through`, body: v => [
      `We couldn't charge your card for the ${v.planName} plan (${v.amount} ${v.currency}). Your reports continue for now.`,
      `To keep your plan, reply to this email and we'll send you a secure link to update your card. We'll retry the charge in a few days. If it's still unpaid after 7 days, your account will move to the free tier; your data stays.`,
      `No fees are added for failed payments.`] },
    he: { subject: v => `נדרשת פעולה: התשלום ל-${v.brand} לא עבר`, body: v => [
      `לא הצלחנו לחייב את הכרטיס עבור מסלול ${v.planName} (${v.amount} ${v.currency}). הדוחות ממשיכים בינתיים.`,
      `כדי לשמור על המסלול, השב/י למייל ונשלח קישור מאובטח לעדכון כרטיס. ננסה לחייב שוב בעוד כמה ימים. אם החוב לא יוסדר תוך 7 ימים, החשבון יעבור למסלול החינמי; המידע נשמר.`,
      `לא נגבים דמי גבייה על חיוב שנכשל.`] },
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
};
export const TX_KINDS = Object.keys(T);
export function footer(lang) {
  return lang === 'he' ? `${esc(BRAND.name)} · ${esc(BRAND.legalEntityHe)}, עוסק פטור ${esc(BRAND.entityId)} · ${esc(BRAND.addressHe)} · ${esc(BRAND.supportEmail)}`
    : `${esc(BRAND.name)} · ${esc(BRAND.legalEntity)}, Exempt Dealer ${esc(BRAND.entityId)} · ${esc(BRAND.address)} · ${esc(BRAND.supportEmail)}`;
}
export function renderTx(kind, lang, vars = {}) { // receiptUrl: http(s) only, otherwise the line falls back to 'sent separately'
  const l = lang === 'he' ? 'he' : 'en'; const t = T[kind]?.[l]; if (!t) throw new Error('unknown email ' + kind);
  const safeReceipt = vars.receiptUrl && safeUrl(vars.receiptUrl) !== '#' ? vars.receiptUrl : ''; vars = { ...vars, receiptUrl: safeReceipt };
  const raw = { brand: BRAND.name, supportEmail: BRAND.supportEmail, legalEntity: BRAND.legalEntity, legalEntityHe: BRAND.legalEntityHe, entityId: BRAND.entityId, ...vars };
  const v = Object.fromEntries(Object.entries(raw).map(([k, x]) => [k, esc(x ?? '')])); v.receiptUrlRaw = vars.receiptUrl ? safeUrl(vars.receiptUrl) : '';
  const subject = t.subject(raw);
  const html = `<!doctype html><html lang="${l}" dir="${l === 'he' ? 'rtl' : 'ltr'}"><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111">
<h2 style="color:${esc(BRAND.color)}">${esc(subject)}</h2>${t.body(v).map(p => `<p>${p}</p>`).join('\n')}
<p style="color:#888;font-size:12px">${footer(l)}</p></body></html>`;
  return { subject, html };
}
