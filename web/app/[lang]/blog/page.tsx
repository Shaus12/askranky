import { pageMeta, ldScript, SITE } from "@/lib/seo";
import { dict, isLocale, type Locale } from "@/lib/i18n";
import { BLOG_TXT, fmtDate, postsFor } from "@/lib/blog";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const generateMetadata = async ({ params }: { params: Promise<{ lang: string }> }) => pageMeta((await params).lang === "he" ? "he" : "en", "/blog");
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params; const lang = (isLocale(l) ? l : "en") as Locale; const t = dict(lang); const b = BLOG_TXT[lang]; const posts = postsFor(lang);
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: b.title, description: b.desc, url: `${SITE}/${lang}/blog`, inLanguage: lang === "he" ? "he-IL" : "en-US", isPartOf: { "@id": `${SITE}/#site` },
    mainEntity: { "@type": "ItemList", itemListElement: posts.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}${p.path}`, name: p.title })) } };
  return (<><div className="vx-page"><Nav t={t} lang={lang} path="/blog" />
    <main className="mx-auto max-w-3xl px-5 py-[clamp(3rem,calc(var(--u)*80),5rem)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(ld) }} />
      <h1 className="font-head text-3xl font-bold text-white">{b.title}</h1>
      <p className="mt-3 text-slate-300">{b.intro}</p>
      <ul className="mt-8 grid gap-4">
        {posts.map((p) => (
          <li key={p.slug} className="card p-6">
            <h2 className="font-head text-xl font-bold leading-snug"><a className="vx-link text-white" href={p.path}>{p.title}</a></h2>
            <p className="mt-2 text-slate-300">{p.metaDescription}</p>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400"><span>{b.updated}: <time dateTime={p.updated}>{fmtDate(p.updated, lang)}</time></span><a className="vx-link font-semibold text-sky-300" href={p.path}>{b.read} <span aria-hidden className="inline-block rtl:rotate-180">→</span></a></p>
          </li>))}
      </ul>
      <div className="card mt-10 p-6 text-center"><p className="font-semibold text-white">{b.cta}</p><a href={`/${lang}/scan`} className="btn-cta mt-4">{b.ctaBtn}</a></div>
    </main></div><Footer t={t} lang={lang} /></>);
}
