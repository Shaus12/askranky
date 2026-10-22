import type { Metadata } from "next";
import type { Locale } from "./i18n";
// Per-language metadata: title/description/OG + canonical and hreflang (he, en, x-default → language-picking root).
export const SITE = "https://askranky.com";
const T = {
  he: { site: "Ranky", title: "Ranky: האם ChatGPT ממליץ על העסק שלך?", desc: "סריקת נראות ב־AI בחינם: מה ChatGPT, ‏Gemini ו־Perplexity עונים כשלקוחות מחפשים עסק כמו שלך, ו־3 תיקונים כדי להפוך לתשובה.", locale: "he_IL" },
  en: { site: "Ranky", title: "Ranky: does ChatGPT recommend your business?", desc: "Free AI visibility scan across ChatGPT, Gemini and Perplexity: see where you rank, who gets picked instead, and 3 fixes to climb.", locale: "en_US" },
};
const PAGE: Record<string, { he: string; en: string }> = {
  "/scan": { he: "סריקת AI חינם", en: "Free AI scan" }, "/report": { he: "דוח לדוגמה", en: "Sample report" }, "/login": { he: "כניסה", en: "Sign in" },
  "/checkout": { he: "תשלום", en: "Checkout" }, "/dashboard": { he: "דשבורד", en: "Dashboard" }, "/legal": { he: "מסמכים משפטיים", en: "Legal" },
};
const PRIVATE = ["/checkout", "/dashboard", "/login"];
export function pageMeta(lang: Locale, path = ""): Metadata {
  const t = T[lang]; const title = PAGE[path] ? `${PAGE[path][lang]} · Ranky` : t.title; const url = `${SITE}/${lang}${path}`;
  return {
    metadataBase: new URL(SITE), title, description: t.desc,
    alternates: { canonical: url, languages: { he: `${SITE}/he${path}`, en: `${SITE}/en${path}`, "x-default": path ? `${SITE}/he${path}` : `${SITE}/` } },
    openGraph: { type: "website", siteName: t.site, title, description: t.desc, url, locale: t.locale, alternateLocale: [lang === "he" ? T.en.locale : T.he.locale] },
    twitter: { card: "summary_large_image", title, description: t.desc },
    ...(PRIVATE.includes(path) ? { robots: { index: false, follow: false } } : {}),
  };
}
export const metaFor = (path: string) => async ({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> => {
  const { lang } = await params; return pageMeta(lang === "he" ? "he" : "en", path);
};
