import Link from "next/link";
import { dict, isLocale, type Locale } from "@/lib/i18n";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import ReportBody from "@/components/ReportBody";
import ScanForm from "@/components/ScanForm";
import Pricing from "@/components/Pricing";
import MaskHeading from "@/components/MaskHeading";
import SectionHead from "@/components/SectionHead";
import { faqJsonLd, ldScript } from "@/lib/seo";

export default async function Landing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params; const lang = (isLocale(l) ? l : "en") as Locale; const t = dict(lang); const h = t.hero;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(faqJsonLd(lang)) }} />
      <Hero t={t} lang={lang} />
      <main className="vx-below text-white">
        <Reveal as="section" id="scan-form" className="vx-section mx-auto grid max-w-6xl scroll-mt-20 items-center gap-12 !pt-10 md:grid-cols-[1.05fr_1fr]">
          <div className="text-center md:text-start">
            <p data-reveal className="vx-pill"><span className="dot h-2 w-2 rounded-full bg-score-high" />{h.eyebrow}</p>
            <div className="mt-6"><MaskHeading text={h.title} className="vx-h3" center={false} /></div>
            <p data-reveal className="vx-lede mt-6">{h.sub}</p>
            <p data-reveal className="mt-4 text-sm text-slate-400">{h.note}</p>
          </div>
          <div data-reveal><ScanForm t={t} lang={lang} /></div>
        </Reveal>

        <div className="relative px-5 py-7 text-center text-sm text-slate-400">
          <span className="hairline absolute inset-x-0 top-0 block" /><span className="hairline absolute inset-x-0 bottom-0 block" />
          {t.engines}: <span className="mx-2 font-semibold text-white">ChatGPT</span>·<span className="mx-2 font-semibold text-white">Gemini</span>
        </div>

        <Reveal as="section" id="how" className="vx-section mx-auto max-w-6xl scroll-mt-16">
          <SectionHead eyebrow={t.nav.how} title={t.how.title} />
          <ol className="mt-14 grid gap-5 md:grid-cols-3">
            {t.how.steps.map(([title, body], i) => (
              <li data-reveal key={i} className="card relative overflow-hidden p-7">
                <span className="vx-glowline" aria-hidden />
                <span className="vx-num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-head mt-5 text-xl font-bold">{title}</h3><p className="mt-2 leading-relaxed text-slate-300">{body}</p>
              </li>))}
          </ol>
        </Reveal>

        <section id="sample" className="vx-depth vx-section relative scroll-mt-16">
          <span className="hairline absolute inset-x-0 top-0 block" />
          <div className="mx-auto max-w-6xl">
            <Reveal><SectionHead eyebrow={t.nav.sample} title={t.sample.title} sub={t.sample.sub} /></Reveal>
            <div className="mt-14"><ReportBody t={t} lang={lang} compact /></div>
            <div className="mt-10 text-center"><Link href={`/${lang}/report`} className="btn-outline">{t.sample.open} <span aria-hidden className="inline-block rtl:rotate-180">→</span></Link></div>
          </div>
        </section>

        <Reveal as="section" id="pricing" className="vx-section relative mx-auto max-w-6xl scroll-mt-16">
          <SectionHead eyebrow={t.nav.pricing} title={t.pricing.title} sub={t.pricing.sub} />
          <Pricing t={t} lang={lang} />
        </Reveal>

        <Reveal as="section" id="faq" className="vx-section mx-auto max-w-3xl scroll-mt-16 !pt-0">
          <SectionHead eyebrow={t.nav.faq} title={t.faq.title} />
          <div className="mt-12 space-y-3">
            {t.faq.items.map(([q, a]) => (
              <details data-reveal key={q} className="card group p-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold text-white">{q}<span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 text-sky-300 transition group-open:rotate-45">+</span></summary>
                <p className="px-5 pb-5 leading-relaxed text-slate-300">{a}</p>
              </details>))}
          </div>
        </Reveal>

        <Reveal as="section" className="vx-section relative overflow-hidden text-center">
          <span className="hairline absolute inset-x-0 top-0 block" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(60%_80%_at_50%_100%,rgba(37,99,235,.35),transparent_70%)]" />
          <div className="relative mx-auto max-w-4xl">
            <MaskHeading text={t.finalCta.title} grad />
            <p data-reveal className="vx-lede mx-auto mt-6 max-w-xl">{t.finalCta.sub}</p>
            <div data-reveal className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
              <Link href={`/${lang}/scan`} className="btn-cta">{h.cta} <span aria-hidden className="rtl:rotate-180">→</span></Link>
              <Link href={`/${lang}/report`} className="vx-link text-sm font-medium text-slate-200">{h.ghost} <span aria-hidden className="vx-arrow rtl:rotate-180">→</span></Link>
            </div>
          </div>
        </Reveal>
      </main>
      <Footer t={t} lang={lang} />
    </>
  );
}
