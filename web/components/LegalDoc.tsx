import type { Dict, Locale } from "@/lib/i18n";
import { LEGAL_META, type LegalDoc } from "@/lib/legal";
// The document text is NOT bundled: the page is exported with an HTML comment marker and the Express server replaces it
// with the rendered legal/*.md on every request (placeholders such as the legal entity come from env at runtime), so the
// full text is in the served HTML for crawlers without JS. The article is therefore never hydrated (suppressHydrationWarning).
export default function LegalDocView({ t, lang, doc }: { t: Dict; lang: Locale; doc: LegalDoc }) {
  const other = lang === "he" ? "en" : "he"; const m = LEGAL_META[doc];
  return (
    <main className="mx-auto max-w-3xl px-5 py-[clamp(3rem,calc(var(--u)*80),5rem)]">
      <nav aria-label="breadcrumb" className="mb-4 text-sm text-slate-400"><a className="vx-link hover:text-white" href={`/${lang}/legal`}>{lang === "he" ? "מסמכים משפטיים" : "Legal"}</a> <span aria-hidden>›</span> {m[lang].title}</nav>
      <article data-legal-doc={doc} lang={lang} dir={lang === "he" ? "rtl" : "ltr"} className="card vx-prose legal-body p-6 text-start md:p-10" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "<!--LEGAL_BODY-->" }} />
      <p className="mt-4 text-sm text-slate-400"><a className="vx-link hover:text-white" hrefLang={other} href={`/${other}/legal/${doc}`}>{other === "he" ? "הנוסח בעברית" : "English version"}</a></p>
    </main>
  );
}
