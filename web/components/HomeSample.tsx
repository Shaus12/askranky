import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { REAL_SAMPLE } from "@/lib/sample-real";
import { SAMPLE_COPY } from "@/lib/sample-copy";

const ENG: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini" };
// home-sample: report sample above the home scan form. Real anonymized scan when REAL_SAMPLE has one; otherwise the same layout as a
// numberless placeholder ("structure only"), so nothing on the page is an invented number.
export default function HomeSample({ lang }: { lang: Locale }) {
  const c = SAMPLE_COPY[lang]; const s = REAL_SAMPLE[lang];
  const named = s ? s.named.map((x) => ({ label: x.label, count: `${x.count}×` })) : c.phNamed.map((label) => ({ label, count: "" }));
  const qa = s ? s.qa : [{ question: c.phQuestion, engine: "chatgpt", excerpt: c.phAnswer, mentioned: false }];
  return (
    <figure className="card relative mx-auto max-w-6xl overflow-hidden p-5 sm:p-7" aria-label={s ? c.badgeReal : c.badgePlaceholder} data-home-sample={s ? "real" : "placeholder"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><div className="font-head text-xl font-bold break-words">{s ? c.business : c.phBusiness}</div>
          <div className="text-sm text-slate-400">{s ? `${s.trade} · ${s.city} · ${s.at}` : c.phMeta}</div></div>
        <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-xs font-bold tracking-wide text-blue-200" data-sample-badge>{s ? c.badgeReal : c.badgePlaceholder}</span>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 p-4 text-center" data-sample-score><p className="text-sm text-slate-400">{c.scoreLabel}</p>
          <p className="font-head mt-2 text-5xl font-bold text-white" dir="ltr">{s ? s.score : "—"}<span className="text-lg text-slate-400">/100</span></p>
          <p className="mt-2 text-sm text-slate-400">{s ? c.checks.replace("{n}", String(s.checks)) : c.phChecks}</p></div>
        <div className="rounded-2xl border border-white/10 p-4 md:col-span-2" data-sample-named><h3 className="mb-3 font-bold">{c.namedTitle}</h3>
          <ol className="space-y-2">{named.map((x, i) => (<li key={i} className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-xs font-bold text-sky-300">{i + 1}</span>
            <span className="min-w-0 flex-1 break-words">{x.label}</span>{x.count && <span className="text-sm text-slate-400">{x.count}</span>}</li>))}</ol></div>
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 p-4" data-sample-qa><h3 className="mb-3 font-bold">{c.qaTitle}</h3>
        {qa.map((x, i) => (<div key={i} className="mt-3 first:mt-0"><p className="font-semibold break-words">{x.question} <span className="ms-1 rounded-full border border-white/15 px-2 py-0.5 text-xs font-normal text-slate-300">{ENG[x.engine] || x.engine}</span></p>
          <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-400">{x.excerpt}</p></div>))}</div>
      <figcaption className="mt-5 flex flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
        <span data-sample-note>{s ? c.noteReal : c.notePlaceholder}</span>
        <a href="#scan-form" className="btn-cta shrink-0" data-cta="home-sample">{c.cta} <span aria-hidden>↓</span></a>
      </figcaption>
    </figure>
  );
}
