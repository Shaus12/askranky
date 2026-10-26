import Link from "next/link";
import { metaFor } from "@/lib/seo";
import { dict, isLocale, type Locale } from "@/lib/i18n";
import { pricingPage } from "@/lib/i18n-pricing";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import SectionHead from "@/components/SectionHead";
import Pricing from "@/components/Pricing";
import PlanCompare from "@/components/PlanCompare";
import "@/components/pricing-page.css";
// /{lang}/pricing (redesign stage 3): plan cards (same component as the home page), an honest comparison table and billing FAQ.
// No extra JSON-LD here: the site-wide SoftwareApplication offers (layout) already list paid plans only while checkout is live.
export const generateMetadata = metaFor("/pricing");
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params; const lang = (isLocale(l) ? l : "en") as Locale; const t = dict(lang); const p = pricingPage(lang);
  return (<><div className="vx-page"><Nav t={t} lang={lang} path="/pricing" />
    <main id="main">
      <Reveal as="section" className="vx-section relative mx-auto max-w-6xl">
        <SectionHead eyebrow={t.nav.pricing} title={p.title} sub={p.lede} />
        <Pricing t={t} lang={lang} />
      </Reveal>
      <Reveal as="section" id="compare" className="vx-section mx-auto max-w-6xl !pt-0">
        <SectionHead title={p.compareTitle} sub={p.compareSub} />
        <div data-reveal className="mt-10"><PlanCompare rows={p.rows} plans={p.plans} feature={p.feature} /></div>
        <p data-reveal className="mt-4 text-center text-sm text-slate-400">{p.soonLegend}</p>
      </Reveal>
      <Reveal as="section" className="vx-section mx-auto max-w-3xl !pt-0">
        <SectionHead title={p.faqTitle} />
        <dl className="mt-8 space-y-5">{p.faq.map(([q, a]) => <div data-reveal key={q} className="card p-5"><dt className="font-bold text-white">{q}</dt><dd className="mt-2 text-slate-300">{a}</dd></div>)}</dl>
        <div data-reveal className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/${lang}/scan`} className="btn-cta">{p.scan}</Link>
          <Link href={`/${lang}/legal/refunds`} className="btn-outline">{p.refunds}</Link>
        </div>
      </Reveal>
    </main></div><Footer t={t} lang={lang} /></>);
}
