import { metaFor } from "@/lib/seo";
import { dict, isLocale, type Locale } from "@/lib/i18n";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ScanProgress from "@/components/ScanProgress";
import { SCAN_INTRO } from "@/lib/scan-intro";

export const generateMetadata = metaFor("/scan");
export default async function Scan({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: l } = await params; const lang = (isLocale(l) ? l : "en") as Locale; const t = dict(lang); const si = SCAN_INTRO[lang];
  return (
    <div className="vx-page">
      <Nav t={t} lang={lang} path="/scan" />
      <ScanProgress t={t} lang={lang} />
      <section data-scan-intro aria-labelledby="scan-intro-h" className="mx-auto max-w-2xl px-5 pb-16 text-slate-300">
        <h2 id="scan-intro-h" className="font-head text-xl font-bold text-white">{si.title}</h2>
        <p className="mt-3 leading-relaxed">{si.lead}</p>
        <ul className="mt-4 list-disc space-y-1.5 ps-5 leading-relaxed">
          {si.items.map((it, i) => <li key={i}>{typeof it === "string" ? it : <>{it.text}<a className="vx-link text-sky-300 underline" href={it.href}>{it.link}</a>{it.tail}</>}</li>)}
        </ul>
        <p className="mt-4 text-sm text-slate-400">{si.note}</p>
      </section>
      <Footer t={t} lang={lang} />
    </div>
  );
}
