import type { Metadata } from "next";
import type { Locale } from "./i18n";
import { dict } from "./i18n";
import { PRICES } from "./prices";
import { LEGAL_DOCS, LEGAL_META } from "./legal";
// Per-language metadata: title/description/OG + canonical and hreflang (he, en, x-default → language-picking root).
export const SITE = "https://askranky.com";
const T = {
  he: { site: "Ranky", title: "Ranky: האם ChatGPT ממליץ על העסק שלך?", desc: "סריקת נראות ב־AI בחינם: מה ChatGPT ו־Gemini עונים כשלקוחות מחפשים עסק כמו שלך, ו־3 תיקונים כדי להפוך לתשובה.", locale: "he_IL" },
  en: { site: "Ranky", title: "Ranky: does ChatGPT recommend your business?", desc: "Free AI visibility scan across ChatGPT and Gemini: see where you rank, who gets picked instead, and 3 fixes to climb.", locale: "en_US" },
};
// Per-page title + description (seo-audit #7), Hebrew and English.
const PAGE: Record<string, { he: string; en: string; dhe: string; den: string }> = {
  "/pricing": { he: "מחירים", en: "Pricing", dhe: "מחירי Ranky: סריקה חינם, ומסלולים חודשיים מ־₪79 בלי מע\"מ. השוואה כנה של מה שפועל היום ומה בקרוב.", den: "Ranky pricing: a free scan, then monthly plans from ₪79, no VAT. An honest comparison of what runs today and what is coming soon." },
  "/scan": { he: "סריקת AI חינם", en: "Free AI scan", dhe: "בדקו בחינם אם ChatGPT ו־Gemini ממליצים על העסק שלכם, ומי מומלץ במקומכם. חינם, סריקה אחת לכל אימייל, כדקה.", den: "Check free whether ChatGPT and Gemini recommend your business, and who they name instead. Free, one scan per email, about a minute." },
  "/report": { he: "דוח לדוגמה", en: "Sample report", dhe: "כך נראה דוח נראות ב־AI של Ranky: ציון, מתחרים שמומלצים, מקורות שמצוטטים ו־3 תיקונים.", den: "See a sample Ranky AI visibility report: score, competitors AI recommends, cited sources and 3 fixes." },
  "/login": { he: "כניסה", en: "Sign in", dhe: "כניסה לדשבורד של Ranky עם קישור חד־פעמי במייל.", den: "Sign in to your Ranky dashboard with a one-time email link." },
  "/signup": { he: "הרשמה", en: "Create account", dhe: "יצירת חשבון Ranky עם אימייל וסיסמה.", den: "Create a Ranky account with email and password." },
  "/reset": { he: "איפוס סיסמה", en: "Reset password", dhe: "איפוס הסיסמה לחשבון Ranky.", den: "Reset your Ranky password." },
  "/verify": { he: "אישור אימייל", en: "Confirm email", dhe: "אישור האימייל לחשבון Ranky.", den: "Confirm the email for your Ranky account." },
  "/account": { he: "החשבון שלי", en: "My account", dhe: "הגדרות החשבון שלך ב־Ranky.", den: "Your Ranky account settings." },
  "/checkout": { he: "תשלום", en: "Checkout", dhe: "תשלום מאובטח למנוי Ranky. ללא מע\"מ, קבלה במייל.", den: "Secure checkout for a Ranky plan. Receipt by email." },
  "/dashboard": { he: "דשבורד", en: "Dashboard", dhe: "הדשבורד הפרטי שלך ב־Ranky.", den: "Your private Ranky dashboard." },
  "/blog": { he: "הבלוג", en: "Blog", dhe: "מדריכים מעשיים לעסקים מקומיים: איך ChatGPT ו־Gemini בוחרים עסקים להמליץ עליהם, ומה עושים כדי להופיע בתשובות.", den: "Practical guides for local businesses: how ChatGPT and Gemini choose which businesses to recommend, and what to do to show up in the answers." },
  "/legal": { he: "מסמכים משפטיים", en: "Legal", dhe: "תנאי שימוש, פרטיות, החזרים, הצהרת נגישות והבהרות של Ranky.", den: "Ranky terms, privacy policy, refunds, accessibility statement and disclaimer." },
};
// One entry per legal document: /legal/{doc} (own title, description, self-canonical, he<->en alternates; indexable).
for (const d of LEGAL_DOCS) PAGE[`/legal/${d}`] = { he: LEGAL_META[d].he.title, en: LEGAL_META[d].en.title, dhe: LEGAL_META[d].he.desc, den: LEGAL_META[d].en.desc };
// PRIVATE pages get <meta name="robots" content="noindex, nofollow">; robots.txt must NOT disallow them (see src/seo.js).
export const PRIVATE = ["/checkout", "/dashboard", "/login", "/signup", "/reset", "/verify", "/account", "/billing"];
export function pageMeta(lang: Locale, path = ""): Metadata {
  const t = T[lang]; const title = PAGE[path] ? `${PAGE[path][lang]} · Ranky` : t.title; const desc = PAGE[path]?.[lang === "he" ? "dhe" : "den"] ?? t.desc; const og = `${SITE}/og-${lang}.png`; const url = `${SITE}/${lang}${path}`;
  return {
    metadataBase: new URL(SITE), title, description: desc,
    icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon-32.png", sizes: "32x32", type: "image/png" }], shortcut: "/favicon.ico", apple: "/apple-touch-icon.png" },
    alternates: { canonical: url, languages: { he: `${SITE}/he${path}`, en: `${SITE}/en${path}`, "x-default": path ? `${SITE}/en${path}` : `${SITE}/` } },
    openGraph: { type: "website", siteName: t.site, title, description: desc, url, locale: t.locale, images: [{ url: og, width: 1200, height: 630, alt: title }], alternateLocale: [lang === "he" ? T.en.locale : T.he.locale] },
    twitter: { card: "summary_large_image", title, description: desc, images: [og] },
    ...(PRIVATE.includes(path) ? { robots: { index: false, follow: false } } : {}),
  };
}
export const metaFor = (path: string) => async ({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> => {
  const { lang } = await params; return pageMeta(lang === "he" ? "he" : "en", path);
};

// JSON-LD (seo-audit #3, #8). Paid Offers are published only when checkout is live (NEXT_PUBLIC_CHECKOUT_LIVE=1 at build),
// so the schema never disagrees with a pre-launch page. Billing is ILS only (usdBilling is off), so every Offer is in ILS in both languages: no USD in structured data.
export function siteJsonLd(lang: Locale, checkoutLive = process.env.NEXT_PUBLIC_CHECKOUT_LIVE === "1") {
  const cur = "ILS" as const; const t = T[lang];
  const names: Record<string, string> = { starter: "Starter", pro: "Pro", agency: "Agency" };
  const offers = [{ "@type": "Offer", name: lang === "he" ? "סריקה חינם" : "Free scan", price: "0", priceCurrency: cur, url: `${SITE}/${lang}/scan` },
    ...(checkoutLive ? Object.keys(names).map((k) => ({ "@type": "Offer", name: names[k], price: String(PRICES[k][cur]), priceCurrency: cur, url: `${SITE}/${lang}/pricing`,
      priceSpecification: { "@type": "UnitPriceSpecification", price: String(PRICES[k][cur]), priceCurrency: cur, billingDuration: "P1M", unitCode: "MON" } })) : [])];
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": `${SITE}/#org`, name: "Ranky", url: SITE, logo: `${SITE}/logo.png`, email: "shaysho1111@gmail.com", areaServed: ["IL", "US"] },
    { "@type": "WebSite", "@id": `${SITE}/#site`, url: SITE, name: "Ranky", inLanguage: lang === "he" ? "he-IL" : "en-US", publisher: { "@id": `${SITE}/#org` } },
    { "@type": "SoftwareApplication", "@id": `${SITE}/${lang}#app`, name: "Ranky", description: t.desc, applicationCategory: "BusinessApplication", operatingSystem: "Web", url: `${SITE}/${lang}`, inLanguage: lang === "he" ? "he-IL" : "en-US", publisher: { "@id": `${SITE}/#org` }, offers },
  ] };
}
// FAQPage from the FAQ items that are visible on the home page.
export const faqJsonLd = (lang: Locale) => ({ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: lang === "he" ? "he-IL" : "en-US",
  mainEntity: dict(lang).faq.items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
// Safe for <script> embedding: escape "<" so no "</script>" can appear inside the JSON.
export const ldScript = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");
