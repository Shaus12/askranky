// Founder section copy (home page). PLACEHOLDER: neutral facts only (name and country are the operator details already in the legal
// pages); Shai edits the text and replaces FOUNDER_PHOTO with a real photo (e.g. /founder.jpg in public/). No invented bio or claims.
import type { Locale } from "./i18n";
export const FOUNDER_PHOTO = "/founder-placeholder.svg";
export const FOUNDER_PHOTO_IS_PLACEHOLDER = true;
const F = {
  en: { eyebrow: "Who is behind Ranky", title: "A real person reads your questions", name: "Shai Shotashvili", role: "Founder, Ranky (Israel)",
    body: "Ranky is built and run by Shai Shotashvili. If something in your report is unclear, or you think a result is wrong, write and you will get an answer from the person who builds it.",
    photoAlt: "Photo of Shai Shotashvili (coming soon)", email: "Email Shai", whatsapp: "WhatsApp Shai" },
  he: { eyebrow: "מי עומד מאחורי Ranky", title: "אדם אמיתי קורא את השאלות שלכם", name: "שי שוטשוילי", role: "מייסד Ranky (ישראל)",
    body: "את Ranky בונה ומפעיל שי שוטשוילי. אם משהו בדוח לא ברור, או שנראה לכם שתוצאה שגויה, כתבו, ותקבלו תשובה מהאדם שבונה את המוצר.",
    photoAlt: "תמונה של שי שוטשוילי (בקרוב)", email: "מייל לשי", whatsapp: "וואטסאפ לשי" },
};
export const founderFor = (l: Locale) => F[l];
