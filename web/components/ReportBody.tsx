import type { Dict, Locale } from "@/lib/i18n";
import { band } from "@/lib/mock";
import { sample, type ReportData } from "@/lib/api";
import ScoreGauge from "./ScoreGauge";
import Bars from "./Bars";
import TrendChart from "./TrendChart";
import CountUp from "./CountUp";
import Reveal from "./Reveal";

export default function ReportBody({ t, lang, compact = false, data }: { t: Dict; lang: Locale; compact?: boolean; data?: ReportData }) {
  const r = data || sample(lang); const b = band(r.score); const maxC = r.competitors[0]?.count || 1;
  return (
    <div className="space-y-6">
      <Reveal className="grid gap-6 md:grid-cols-3">
        <div data-reveal className="card p-6 md:col-span-1">
          <ScoreGauge score={r.score} label={t.report.score} />
          <div className="mt-4 rounded-xl bg-score-low/10 p-3 text-center">
            <div className="text-sm font-bold text-[#c2544a]">{t.report.band[b]}</div>
            <p className="mt-1 text-xs text-slate-600">{t.report.bandText[b]}</p>
          </div>
        </div>
        <div data-reveal className="grid gap-6 md:col-span-2 sm:grid-cols-2">
          <div className="card p-6"><div className="text-4xl font-extrabold text-brand-700"><CountUp to={Math.round(r.mentionRate * 100)} suffix="%" /></div><p className="text-sm text-slate-500">{t.report.mention} · {r.checks} {t.report.checks}</p></div>
          <div className="card p-6"><div className="text-4xl font-extrabold text-brand-700">{r.avgRank ? <>#<CountUp to={r.avgRank} decimals={1} /></> : "–"}</div><p className="text-sm text-slate-500">{t.report.rank}</p></div>
          <div className="card p-6 sm:col-span-2"><h3 className="mb-4 font-bold">{t.report.byEngine}</h3><Bars data={r.byEngine.map((e) => ({ label: e.engine, value: e.rate }))} /></div>
        </div>
      </Reveal>
      {!compact && (
        <>
          <Reveal className="grid gap-6 md:grid-cols-3">
            <div data-reveal className="card p-6"><h3 className="mb-2 font-bold">{r.live ? t.live.history : t.report.trend}</h3><TrendChart values={r.trend} weekLabel={t.report.weeks} /></div>
            <div data-reveal className="card p-6"><h3 className="mb-4 font-bold">{t.report.competitors}</h3>
              <ol className="space-y-3">{r.competitors.map((c, i) => (
                <li key={c.name} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                  <span className="flex-1">{c.name}</span><span className="h-2 rounded-full bg-brand-400/60" style={{ width: `${(c.count / maxC) * 60}px` }} /><span className="w-8 text-end text-sm text-slate-500">{c.count}×</span></li>))}</ol></div>
            <div data-reveal className="card p-6"><h3 className="mb-4 font-bold">{t.report.sources}</h3>
              <ul className="space-y-3">{r.sources.map((s) => (
                <li key={s.host} className="flex items-center justify-between"><span dir="ltr">{s.host}{s.own && <span className="ms-2 rounded-full bg-score-high/15 px-2 py-0.5 text-xs font-semibold text-[#23845d]">{t.report.yours}</span>}</span><span className="text-sm text-slate-500">{s.count}×</span></li>))}</ul></div>
          </Reveal>
          <Reveal className="space-y-4">
            <h2 data-reveal className="text-2xl font-extrabold">{t.report.fixes}</h2>
            {r.fixes.map((f, i) => (
              <div data-reveal key={i} className="card p-6">
                <h3 className="font-bold"><span className="text-brand-600">{i + 1}.</span> {f.title}</h3>
                <p className="mt-1 text-slate-600">{f.why}</p>
                <div className="mt-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900 whitespace-pre-wrap"><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">{t.report.copy}</div>{f.copy}</div>
              </div>))}
          </Reveal>
        </>
      )}
    </div>
  );
}
