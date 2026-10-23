// Strings for the accessibility widget (kept out of i18n.ts on purpose).
import type { Locale } from "./i18n";
export const a11yText = {
  en: {
    open: "Accessibility menu", title: "Accessibility", close: "Close accessibility menu",
    textSize: "Text size", larger: "Larger text", smaller: "Smaller text", reset: "Reset text size", level: "Level",
    contrast: "High contrast (dark)", light: "Light contrast", gray: "Grayscale", links: "Highlight links", font: "Readable font", motion: "Stop animations", cursor: "Large cursor",
    motionSystem: "On (your system asks for reduced motion)", on: "On", off: "Off",
    resetAll: "Reset all", statement: "Accessibility statement", hint: "Settings are saved in this browser only.",
  },
  he: {
    open: "תפריט נגישות", title: "נגישות", close: "סגירת תפריט הנגישות",
    textSize: "גודל טקסט", larger: "הגדלת טקסט", smaller: "הקטנת טקסט", reset: "איפוס גודל טקסט", level: "רמה",
    contrast: "ניגודיות גבוהה (כהה)", light: "ניגודיות בהירה", gray: "גווני אפור", links: "הדגשת קישורים", font: "גופן קריא", motion: "עצירת אנימציות", cursor: "סמן גדול",
    motionSystem: "פעיל (המערכת שלך מבקשת הפחתת תנועה)", on: "פעיל", off: "כבוי",
    resetAll: "איפוס הכול", statement: "הצהרת נגישות", hint: "ההגדרות נשמרות בדפדפן זה בלבד.",
  },
} satisfies Record<Locale, Record<string, string>>;
export type A11yText = (typeof a11yText)["en"];
