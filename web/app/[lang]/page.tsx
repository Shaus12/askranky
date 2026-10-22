import Link from "next/link";
import { dict, isLocale, type Locale } from "@/lib/i18n";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import ReportBody from "@/components/ReportBody";
import ScanForm from "@/components/ScanForm";
import Pricing from "@/components/Pricing";

export default async function Landing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params; const lang = (isLocale(l) ? l : "en") as Locale; const t = dict(lang); const h = t.hero;
  return (
    <>
      <Hero t={t} lang={lang} />
      <div className="vx-below text-white">
        <section id="scan-form" className="mx-auto grid max-w-6xl scroll-mt-6 items-center gap-10 px-4 pb-16 pt-4 md:grid-cols-[1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-sky-200"><span className="dot h-2 w-2 rounded-full bg-score-high" />{h.eyebrow}</span>
            <h2 className="font-head mt-4 text-3xl font-bold md:text-4xl">{h.title}</h2>
            <p className="mt-4 text-slate-300">{h.sub}</p>
            <p className="mt-4 text-sm text-slate-400">{h.note}</p>
          </div>
          <ScanForm t={t} lang={lang} />
        </section>
        <div className="relative border-t border-white/10 py-6 text-center text-sm text-slate-400">
          {t.engines}: <span className="mx-2 font-semibold text-white">ChatGPT</span>·<span className="mx-2 font-semibold text-white">Gemini</span>·<span className="mx-2 font-semibold text-white">Perplexity</span>
        </div>
      </div>

      <main>
        <Reveal as="section" id="how" className="mx-auto max-w-6xl px-4 py-20">
          <h2 data-reveal className="text-center text-3xl font-extrabold md:text-4xl">{t.how.title}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {t.how.steps.map(([title, body], i) => (
              <div data-reveal key={i} className="card p-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-glow font-bold text-white">{i + 1}</div>
                <h3 className="mt-4 text-lg font-bold">{title}</h3><p className="mt-2 text-slate-600">{body}</p>
              </div>))}
          </div>
        </Reveal>

        <section id="sample" className="bg-brand-50/60 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal><h2 data-reveal className="text-center text-3xl font-extrabold md:text-4xl">{t.sample.title}</h2><p data-reveal className="mt-2 text-center text-slate-600">{t.sample.sub}</p></Reveal>
            <div className="mt-10"><ReportBody t={t} lang={lang} compact /></div>
            <div className="mt-8 text-center"><Link href={`/${lang}/report`} className="font-semibold text-brand-700 underline underline-offset-4">{t.sample.open} <span className="inline-block rtl:rotate-180">→</span></Link></div>
          </div>
        </section>

        <Reveal as="section" id="pricing" className="mx-auto max-w-6xl px-4 py-20">
          <h2 data-reveal className="text-center text-3xl font-extrabold md:text-4xl">{t.pricing.title}</h2>
          <p data-reveal className="mt-2 text-center text-slate-600">{t.pricing.sub}</p>
          <Pricing t={t} lang={lang} />
        </Reveal>

        <Reveal as="section" id="faq" className="mx-auto max-w-3xl px-4 pb-20">
          <h2 data-reveal className="text-center text-3xl font-extrabold md:text-4xl">{t.faq.title}</h2>
          <div className="mt-8 space-y-3">
            {t.faq.items.map(([q, a]) => (
              <details data-reveal key={q} className="card group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{q}<span className="text-brand-600 transition group-open:rotate-45">+</span></summary>
                <p className="mt-3 text-slate-600">{a}</p>
              </details>))}
          </div>
        </Reveal>

        <section className="hero-bg px-4 py-20 text-center text-white">
          <h2 className="text-3xl font-extrabold md:text-4xl">{t.finalCta.title}</h2>
          <p className="mt-3 text-slate-300">{t.finalCta.sub}</p>
          <Link href={`/${lang}/scan`} className="btn-cta mt-8">{h.cta} <span className="rtl:rotate-180">→</span></Link>
        </section>
      </main>
      <Footer t={t} lang={lang} />
    </>
  );
}
