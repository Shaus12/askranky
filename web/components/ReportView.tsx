"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";
import { api, getConfig, idFromPath, sample, toReport, type ReportData } from "@/lib/api";
import ReportBody from "./ReportBody";
import Reveal from "./Reveal";
import MaskHeading from "./MaskHeading";

// /[lang]/r/<id> (served by Express from report.html) loads the real report; /[lang]/report shows the sample.
export default function ReportView({ t, lang }: { t: Dict; lang: Locale }) {
  const [r, setR] = useState<ReportData | null>(null); const [noEmail, setNoEmail] = useState(false);
  useEffect(() => { getConfig().then((c) => setNoEmail(!!c.emailMock)); }, []); const [err, setErr] = useState("");
  useEffect(() => {
    const id = idFromPath("r") || new URLSearchParams(location.search).get("id") || "";
    if (!id) { setR(sample(lang)); return; }
    api(`/api/report/${encodeURIComponent(id)}`).then((j) => setR(toReport(j))).catch(() => setErr(t.live.notFound));
  }, [lang, t]);
  if (err || !r) return <div className="min-h-[70vh] px-5 py-24 text-center text-white"><h1 className="font-head vx-h3">{err || t.live.loading}</h1>{err && <Link href={`/${lang}/scan`} className="btn-cta mt-8">{t.hero.cta}</Link>}</div>;
  return (
    <>
      <Reveal className="mx-auto max-w-6xl px-5 pb-12 pt-[clamp(2.5rem,calc(var(--u)*72),4.5rem)]">
        <p data-reveal className={`inline-block rounded-full border px-3 py-1 text-xs ${r.mock ? "border-[#e8b04b]/30 bg-[#e8b04b]/10 text-amber-100" : "border-score-high/30 bg-score-high/10 text-emerald-200"}`}>{r.mock ? t.report.mock : t.live.real}</p>
        {r.live && noEmail && <p data-reveal data-demo-note role="note" className="mt-3 max-w-2xl text-sm text-amber-100">{t.demo.reportNote}</p>}
        <p data-reveal className="vx-eyebrow mt-6">{t.report.title}</p>
        <div className="mt-3"><MaskHeading as="h1" className="vx-h2" text={r.business.name} grad center={false} /></div>
        <span data-hair className="hairline mt-6 block w-[min(80vw,calc(var(--u)*420))] origin-left rtl:origin-right" />
        <p data-reveal className="mt-5 text-slate-300">{r.business.category} · {r.business.city} · <span dir="ltr">{r.date || "2026-10-21"}</span></p>
      </Reveal>
      <main className="mx-auto max-w-6xl px-5 pb-20">
        <ReportBody t={t} lang={lang} data={r} />
        <Reveal className="card relative mt-12 overflow-hidden p-10 text-center md:p-14">
          <span className="vx-glowline" aria-hidden />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-full bg-[radial-gradient(60%_80%_at_50%_120%,rgba(37,99,235,.35),transparent_70%)]" />
          <div className="relative"><MaskHeading text={t.report.cta} className="vx-h3" />
            <div data-reveal className="mt-8"><Link href={`/${lang}/checkout?plan=starter`} className="btn-cta">{t.report.ctaBtn} <span aria-hidden className="rtl:rotate-180">→</span></Link></div></div>
        </Reveal>
      </main>
    </>
  );
}
