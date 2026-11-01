import Link from "next/link";
import { metaFor, ldScript } from "@/lib/seo";
import { dict, isLocale, type Locale } from "@/lib/i18n";
import { AG, CONTACT_EMAIL, agencyFaqJsonLd } from "@/lib/agencies";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import SectionHead from "@/components/SectionHead";
import WhatsAppLink from "@/components/WhatsAppLink";
import "@/components/pricing-page.css";
// /{lang}/agencies: informational agency/partner page. No checkout or new plan here; contact = mailto (site support address) + WhatsApp when configured.
export const generateMetadata = metaFor("/agencies");
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params; const lang = (isLocale(l) ? l : "en") as Locale; const t = dict(lang); const a = AG[lang];
  const mail = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(a.mailSubject)}`;
  const List = ({ items }: { items: string[] }) => <ul className="mt-6 space-y-3">{items.map((x) => <li data-reveal key={x} className="card p-4 text-slate-300">{x}</li>)}</ul>;
  return (<><div className="vx-page"><Nav t={t} lang={lang} path="/agencies" />
    <main id="main" data-page="agencies">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(agencyFaqJsonLd(lang)) }} />
      <Reveal as="section" className="vx-section mx-auto max-w-5xl">
        <SectionHead eyebrow={a.eyebrow} title={a.title} sub={a.sub} />
        <div data-reveal className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/${lang}/scan`} className="btn-cta">{a.scan}</Link>
          <a href={mail} className="btn-outline" data-contact>{a.contact}</a>
        </div>
      </Reveal>
      <Reveal as="section" className="vx-section mx-auto max-w-5xl !pt-0">
        <div className="grid gap-8 md:grid-cols-2">
          <div><h2 className="text-2xl font-bold text-white">{a.forTitle}</h2><List items={a.forList} /></div>
          <div><h2 className="text-2xl font-bold text-white">{a.checkTitle}</h2><List items={a.checkList} /></div>
        </div>
      </Reveal>
      <Reveal as="section" id="plan" className="vx-section mx-auto max-w-3xl !pt-0">
        <SectionHead title={a.planTitle} />
        <dl data-reveal data-agency-plan className="card mt-8 divide-y divide-white/10">
          {a.rows.map(([k, v]) => <div key={k} className="flex flex-wrap justify-between gap-2 p-4"><dt className="text-slate-400">{k}</dt><dd className="font-bold text-white">{v}</dd></div>)}
        </dl>
        <p data-reveal data-manual className="mt-4 card p-4 text-slate-300">{a.manual}</p>
        <p data-reveal className="mt-4 text-center"><Link href={`/${lang}/pricing`} className="btn-outline">{a.pricing}</Link></p>
      </Reveal>
      <Reveal as="section" className="vx-section mx-auto max-w-3xl !pt-0">
        <SectionHead title={a.sellTitle} />
        <ol className="mt-8 space-y-3">{a.sell.map((x, i) => <li data-reveal key={x} className="card p-4 text-slate-300"><b className="text-white">{i + 1}. </b>{x}</li>)}</ol>
        <p data-reveal className="mt-4 text-center text-slate-400">{a.sellNote}</p>
      </Reveal>
      <Reveal as="section" className="vx-section mx-auto max-w-3xl !pt-0">
        <div className="grid gap-6 md:grid-cols-2">
          <div data-reveal className="card p-5"><h2 className="text-xl font-bold text-white">{a.fixTitle}</h2><p className="mt-2 text-slate-300">{a.fix}</p></div>
          <div data-reveal className="card p-5"><h2 className="text-xl font-bold text-white">{a.noTitle}</h2><p className="mt-2 text-slate-300">{a.no}</p></div>
        </div>
      </Reveal>
      <Reveal as="section" className="vx-section mx-auto max-w-3xl !pt-0">
        <SectionHead title={a.faqTitle} />
        <dl className="mt-8 space-y-5">{a.faq.map(([q, ans]) => <div data-reveal key={q} className="card p-5"><dt className="font-bold text-white">{q}</dt><dd className="mt-2 text-slate-300">{ans}</dd></div>)}</dl>
      </Reveal>
      <Reveal as="section" id="contact" className="vx-section mx-auto max-w-3xl !pt-0 pb-32">
        <SectionHead title={a.ctaTitle} />
        <div data-reveal className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/${lang}/scan`} className="btn-cta">{a.ctaScan}</Link>
          <a href={mail} className="btn-outline" data-contact>{a.ctaContact}</a>
          <WhatsAppLink label="WhatsApp" />
        </div>
        <p data-reveal className="mt-4 text-center text-sm text-slate-400">{a.contactNote} <a href={mail} dir="ltr" className="underline">{CONTACT_EMAIL}</a></p>
      </Reveal>
    </main></div><Footer t={t} lang={lang} /></>);
}
