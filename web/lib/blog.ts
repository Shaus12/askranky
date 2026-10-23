import fs from "node:fs";
import path from "node:path";
import type { Locale } from "./i18n";
// Blog posts: markdown with front matter in content/blog/{lang}/{slug}.md (repo root). Read at BUILD time for the static export
// (index, metadata, Article JSON-LD); the article body is filled in by the Express server (src/blog.js) from the same files.
export type Post = { lang: Locale; slug: string; path: string; title: string; metaTitle: string; metaDescription: string; published: string; updated: string };
const DIR = path.resolve(process.cwd(), "..", "content", "blog");
function front(raw: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---/.exec(raw.replace(/\r/g, "")); const meta: Record<string, string> = {};
  for (const l of (m?.[1] || "").split("\n")) { const k = /^(\w+):\s*(.*)$/.exec(l); if (k) meta[k[1]] = k[2].replace(/^"(.*)"$/, "$1"); }
  return meta;
}
export function allPosts(): Post[] {
  const out: Post[] = [];
  for (const lang of ["he", "en"] as Locale[]) {
    const d = path.join(DIR, lang); if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => /^[a-z0-9-]+\.md$/.test(x))) {
      const m = front(fs.readFileSync(path.join(d, f), "utf8")); const slug = f.replace(/\.md$/, "");
      if (m.lang !== lang || !m.title || !m.meta_title || !m.meta_description || m.slug !== `/${lang}/blog/${slug}`) throw new Error(`blog front matter invalid: ${lang}/${f}`);
      out.push({ lang, slug, path: m.slug, title: m.title, metaTitle: m.meta_title, metaDescription: m.meta_description, published: m.published || m.updated, updated: m.updated || m.published });
    }
  }
  return out.sort((a, b) => b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug));
}
export const postsFor = (lang: Locale) => allPosts().filter((p) => p.lang === lang);
export const findPost = (lang: string, slug: string) => allPosts().find((p) => p.lang === lang && p.slug === slug);
export const fmtDate = (iso: string, lang: Locale) => new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));
export const BLOG_TXT = {
  he: { nav: "בלוג", title: "הבלוג של Ranky", desc: "מדריכים מעשיים לעסקים מקומיים: איך ChatGPT ו־Gemini בוחרים עסקים להמליץ עליהם, ומה עושים כדי להופיע בתשובות.", intro: "מדריכים מעשיים לבעלי עסקים מקומיים: איך מנועי AI בוחרים אילו עסקים להמליץ עליהם, ומה אפשר לעשות כדי להופיע בתשובות.", updated: "עודכן", read: "לקריאה", back: "כל המאמרים", cta: "בדקו בחינם אם ChatGPT ו־Gemini ממליצים על העסק שלכם", ctaBtn: "לסריקה חינם", by: "מאת" },
  en: { nav: "Blog", title: "The Ranky blog", desc: "Practical guides for local businesses: how ChatGPT and Gemini choose which businesses to recommend, and what to do to show up in the answers.", intro: "Practical guides for local business owners: how AI engines choose which businesses to recommend, and what you can do to show up in the answers.", updated: "Last updated", read: "Read the guide", back: "All articles", cta: "Check for free whether ChatGPT and Gemini recommend your business", ctaBtn: "Run a free scan", by: "By" },
} as const;
