"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";
import { api, idFromPath, sample, toReport, type ReportData } from "@/lib/api";
import ReportBody from "./ReportBody";
import BlurText from "./BlurText";

// /[lang]/r/<id> (served by Express from report.html) loads the real report; /[lang]/report shows the sample.
export default function ReportView({ t, lang }: { t: Dict; lang: Locale }) {
  const [r, setR] = useState<ReportData | null>(null); const [err, setErr] = useState("");
  useEffect(() => {
    const id = idFromPath("r") || new URLSearchParams(location.search).get("id") || "";
    if (!id) { setR(sample(lang)); return; }
    api(`/api/report/${encodeURIComponent(id)}`).then((j) => setR(toReport(j))).catch(() => setErr(t.live.notFound));
  }, [lang, t]);
  if (err || !r) return <div className="hero-bg min-h-[70vh] px-4 py-24 text-center text-white"><h1 className="text-3xl font-extrabold">{err || t.live.loading}</h1>{err && <Link href={`/${lang}/scan`} className="btn-cta mt-8">{t.hero.cta}</Link>}</div>;
  return (
    <>
      <div className="hero-bg text-white">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-10">
          <p className={`inline-block rounded-full border px-3 py-1 text-xs ${r.mock ? "border-cta/30 bg-cta/10 text-amber-200" : "border-score-high/30 bg-score-high/10 text-emerald-200"}`}>{r.mock ? t.report.mock : t.live.real}</p>
          <h1 className="mt-4 text-3xl font-extrabold md:text-5xl"><BlurText key={r.business.name} text={`${t.report.title}: ${r.business.name}`} /></h1>
          <p className="mt-2 text-slate-400">{r.business.category} · {r.business.city} · <span dir="ltr">{r.date || "2026-10-21"}</span></p>
        </div>
      </div>
      <main className="mx-auto -mt-16 max-w-6xl px-4 pb-20">
        <ReportBody t={t} lang={lang} data={r} />
        <div className="hero-bg mt-10 rounded-3xl p-8 text-center text-white">
          <h2 className="text-2xl font-extrabold">{t.report.cta}</h2>
          <Link href={`/${lang}/checkout?plan=starter`} className="btn-cta mt-6">{t.report.ctaBtn} <span className="rtl:rotate-180">→</span></Link>
        </div>
      </main>
    </>
  );
}
