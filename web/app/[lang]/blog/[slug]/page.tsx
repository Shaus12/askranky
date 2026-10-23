import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SITE, ldScript } from "@/lib/seo";
import { dict, isLocale, type Locale } from "@/lib/i18n";
import { BLOG_TXT, allPosts, findPost, fmtDate } from "@/lib/blog";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

// One static page per article; the body is a marker the Express server fills with the rendered markdown (src/blog.js), so the full
// text is in the HTML for crawlers without JS. Metadata, canonical and JSON-LD come from the front matter at build time.
// HE and EN articles are different articles, not translations: self-canonical only, NO hreflang alternates.
export const dynamicParams = false;
export const generateStaticParams = () => allPosts().map((p) => ({ lang: p.lang, slug: p.slug }));
export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params; const p = findPost(lang, slug); if (!p) return {};
  const og = `${SITE}/og-${p.lang}.png`; const url = `${SITE}${p.path}`;
  return { metadataBase: new URL(SITE), title: p.metaTitle, description: p.metaDescription, alternates: { canonical: url },
    openGraph: { type: "article", siteName: "Ranky", title: p.metaTitle, description: p.metaDescription, url, locale: p.lang === "he" ? "he_IL" : "en_US", publishedTime: p.published, modifiedTime: p.updated, authors: [p.lang === "he" ? "שי שוטשוילי" : "Shai Shotashvili"], images: [{ url: og, width: 1200, height: 630, alt: p.metaTitle }] },
    twitter: { card: "summary_large_image", title: p.metaTitle, description: p.metaDescription, images: [og] } };
}
export default async function Page({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang: l, slug } = await params; const p = isLocale(l) ? findPost(l, slug) : undefined; if (!p) notFound();
  const lang = l as Locale; const t = dict(lang); const b = BLOG_TXT[lang]; const url = `${SITE}${p.path}`; const author = lang === "he" ? "שי שוטשוילי" : "Shai Shotashvili";
  const article = { "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.metaDescription, datePublished: p.published, dateModified: p.updated, inLanguage: lang === "he" ? "he-IL" : "en-US", url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Person", name: author, worksFor: { "@id": `${SITE}/#org` } },
    publisher: { "@type": "Organization", "@id": `${SITE}/#org`, name: "Ranky", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/logo.png` } } };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Ranky", item: `${SITE}/${lang}` }, { "@type": "ListItem", position: 2, name: b.nav, item: `${SITE}/${lang}/blog` }, { "@type": "ListItem", position: 3, name: p.title, item: url }] };
  return (<><div className="vx-page"><Nav t={t} lang={lang} path="/blog" />
    <main className="mx-auto max-w-3xl px-5 py-[clamp(3rem,calc(var(--u)*80),5rem)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(article) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(crumbs) }} />
      <nav aria-label="breadcrumb" className="mb-4 text-sm text-slate-400"><a className="vx-link hover:text-white" href={`/${lang}/blog`}>{b.nav}</a> <span aria-hidden>›</span> {p.title}</nav>
      <article data-blog-post={p.slug} lang={lang} dir={lang === "he" ? "rtl" : "ltr"} className="card vx-prose blog-body p-6 text-start md:p-10" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "<!--BLOG_BODY-->" }} />
      <p className="mt-4 text-sm text-slate-400">{b.by} {author} · {b.updated}: <time dateTime={p.updated}>{fmtDate(p.updated, lang)}</time></p>
      <div className="card mt-8 p-6 text-center"><p className="font-semibold text-white">{b.cta}</p><a href={`/${lang}/scan`} className="btn-cta mt-4">{b.ctaBtn}</a></div>
      <p className="mt-6 text-sm"><a className="vx-link text-slate-300 hover:text-white" href={`/${lang}/blog`}>{lang === "he" ? "→ " : "← "}{b.back}</a></p>
    </main></div><Footer t={t} lang={lang} /></>);
}
