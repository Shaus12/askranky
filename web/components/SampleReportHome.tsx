import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";
import { homeSample } from "@/lib/sample-home";
import ScoreGauge from "./ScoreGauge";
import Bars from "./Bars";

/** Home-page sample report card. Clearly labelled example data with a masked business name (never a real customer). */
export default function SampleReportHome({ t, lang }: { t: Dict; lang: Locale }) {
  const s = homeSample(lang); const g = t.growth; const maxC = s.competitors[0]?.count || 1;
  return (
    <figure className="card relative overflow-hidden p-5 sm:p-7" aria-label={g.sampleLabel} data-sample-report>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-head text-xl font-bold break-words" aria-label={g.maskedName}>{s.name}</div>
          <div className="text-sm text-slate-400">{s.meta}</div>
        </div>
        <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-bold tracking-wide text-amber-200" data-sample-badge>{g.sampleLabel}</span>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 p-4"><ScoreGauge score={s.score} label={t.report.score} />
          <p className="mt-2 text-center text-sm text-slate-400">{Math.round(s.mentionRate * 100)}% {t.report.mention} · {s.checks} {t.report.checks}</p></div>
        <div className="rounded-2xl border border-white/10 p-4"><h3 className="mb-4 font-bold">{t.report.byEngine}</h3><Bars data={s.engines.map((e) => ({ label: e.engine, value: e.rate }))} /></div>
        <div className="rounded-2xl border border-white/10 p-4"><h3 className="mb-4 font-bold">{t.report.competitors}</h3>
          <ol className="space-y-3">{s.competitors.map((c, i) => (
            <li key={c.name} className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-xs font-bold text-sky-300">{i + 1}</span>
              <span className="min-w-0 flex-1 break-words">{c.name}</span><span className="h-2 shrink-0 rounded-full bg-brand-400/60" style={{ width: `${(c.count / maxC) * 48}px` }} /><span className="w-8 shrink-0 text-end text-sm text-slate-400">{c.count}×</span></li>))}</ol></div>
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 p-4">
        <h3 className="mb-3 font-bold">{t.report.fixes}</h3>
        <ol className="space-y-3">{s.fixes.map((f, i) => (<li key={i}><div className="font-semibold"><span className="text-sky-400">{i + 1}.</span> {f.title}</div><p className="text-sm text-slate-400">{f.why}</p></li>))}</ol>
      </div>
      <figcaption className="mt-5 flex flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
        <span>{g.sampleNote}</span>
        <Link href={`/${lang}/scan`} className="btn-cta shrink-0" data-cta="sample">{g.freeScan} <span aria-hidden className="rtl:rotate-180">→</span></Link>
      </figcaption>
    </figure>
  );
}
