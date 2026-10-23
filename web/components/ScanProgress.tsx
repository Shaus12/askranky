"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import { reducedMotion } from "@/lib/motion";
import { api, errMessage, getConfig, type Config } from "@/lib/api";
import { demoNotices } from "@/lib/notices";
import { creepPct, stepForPct, isSlow } from "@/lib/progress";
import ScanForm, { PENDING } from "./ScanForm";
import FreeLimitNotice from "./FreeLimitNotice";
import Reveal from "./Reveal";
import MaskHeading from "./MaskHeading";


const TICK_MS = 500;
type Pending = { name: string; website?: string; category: string; city: string; email: string; turnstileToken?: string };

// Shows the scan form when nothing is pending; otherwise POSTs /api/scan and animates progress until the real report id comes back.
// ?step=N freezes a demo state (used for screenshots).
export default function ScanProgress({ t, lang }: { t: Dict; lang: Locale }) {
  const s = t.scan; const n = s.steps.length; const router = useRouter();
  const [mode, setMode] = useState<"init" | "form" | "run" | "demo">("init");
  const [biz, setBiz] = useState<Pending | null>(null); const [cfg, setCfg] = useState<Config | null>(null); const nt = demoNotices(cfg, t);
  const [step, setStep] = useState(0); const [reportId, setReportId] = useState(""); const [existing, setExisting] = useState(false); const [error, setError] = useState(""); const [used, setUsed] = useState<{ reportId?: string } | null>(null);
  const started = useRef(false); const t0 = useRef(0); const maxPct = useRef(0); const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    getConfig().then(setCfg);
    const q = new URLSearchParams(window.location.search);
    if (q.has("step")) { setMode("demo"); setBiz({ name: lang === "he" ? "אינסטלציה אקמה" : "Acme Plumbing", category: lang === "he" ? "אינסטלטור" : "Plumber", city: lang === "he" ? "תל אביב-יפו" : "Austin, TX", email: "" }); setStep(Math.min(Number(q.get("step")), n)); return; }
    const raw = sessionStorage.getItem(PENDING); if (!raw) { setMode("form"); return; }
    if (started.current) return; started.current = true;
    run(JSON.parse(raw));
  }, [lang, n]);
  // Starts the scan (from the stored pending form after /[lang] → /[lang]/scan, or directly from the form shown on this page).
  function run(p: Pending) {
    t0.current = Date.now(); maxPct.current = 0; setElapsed(0); setBiz(p); setStep(0); setReportId(""); setExisting(false); setError(""); setUsed(null); setMode("run");
    api<{ reportId: string; existing?: boolean }>("/api/scan", { body: { ...p, lang } })
      .then((j) => { sessionStorage.removeItem(PENDING); setExisting(!!j.existing); setReportId(j.reportId); })
      .catch((e) => { sessionStorage.removeItem(PENDING); if (e?.code === "free_scan_used") setUsed({ reportId: typeof e.data?.reportId === "string" ? e.data.reportId : undefined }); else setError(errMessage(e, t)); });
  }
  // Progress creeps asymptotically (never visibly stalls while a real scan takes 1-2 min); it finishes only once the server answered.
  useEffect(() => {
    if (mode !== "run") return;
    const id = setInterval(() => {
      const el = Date.now() - t0.current; setElapsed(el);
      if (reducedMotion()) { setStep(reportId ? n : n - 1); return; }
      if (reportId) setStep((x) => (x >= n ? x : x + 1));
      else setStep((x) => Math.max(x, stepForPct(creepPct(el), n)));
    }, reportId ? 250 : TICK_MS);
    return () => clearInterval(id);
  }, [mode, reportId, n]);
  useEffect(() => { if (mode === "run" && step >= n && reportId) { const id = setTimeout(() => location.assign(`/${lang}/r/${reportId}${existing ? "?existing=1" : ""}`), 900); return () => clearTimeout(id); } }, [mode, step, n, reportId, lang, router, existing]);

  if (mode === "init") return <main className="min-h-[60vh]" />;
  if (mode === "form") return (
    <main><Reveal className="mx-auto max-w-xl px-5 py-[clamp(3rem,calc(var(--u)*80),5rem)]">
      <MaskHeading as="h1" className="vx-h3" text={t.hero.title} />
      <span data-hair className="hairline mx-auto my-8 block w-40" />
      <div data-reveal><ScanForm t={t} lang={lang} onStart={(p) => run(p as unknown as Pending)} /></div>
    </Reveal></main>);
  if (used) return <FreeLimitNotice lang={lang} reportId={used.reportId} prelaunch={cfg ? !!cfg.prelaunch : true} onOther={() => { setUsed(null); setMode("form"); }} />;
  const done = step >= n; const TOTAL = 5 * s.engines.length; // 5 questions × the engines that run live (ChatGPT, Gemini)
  // Never goes backwards: creeping %, then step-based % once the report is ready, 100 when done.
  maxPct.current = Math.max(maxPct.current, done ? 100 : reportId ? (step / n) * 100 : mode === "demo" ? (step / n) * 100 : creepPct(elapsed));
  const pct = Math.round(maxPct.current); const slow = mode === "run" && !reportId && !error && isSlow(elapsed);
  const checks = done ? TOTAL : Math.min(TOTAL - 1, Math.max(0, Math.round((pct / 100) * TOTAL)));
  const engineState = (i: number) => (step > i + 1 ? "done" : step === i + 1 ? "active" : "wait");
  const link = mode === "demo" ? `/${lang}/report` : `/${lang}/r/${reportId}`;
  return (
    <main className="mx-auto max-w-2xl px-5 py-[clamp(3rem,calc(var(--u)*80),5rem)]">
      {nt.progressMock && <p data-mock-note className="mx-auto w-fit rounded-full border border-[#e8b04b]/30 bg-[#e8b04b]/10 text-amber-100 px-4 py-1.5 text-center text-xs">{nt.progressMock}</p>}
      {existing && reportId && <p role="note" data-existing-note className="mx-auto mt-3 w-fit max-w-full rounded-lg border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-center text-sm text-sky-100">{t.existing.runNote}</p>}
      {nt.runNote && <p role="note" data-demo-note className="mx-auto mt-3 w-fit max-w-full rounded-lg border border-[#e8b04b]/30 bg-[#e8b04b]/10 px-4 py-2 text-center text-sm text-amber-100">{nt.runNote}</p>}
      <h1 className="font-head vx-h3 mt-8 text-center" aria-live="polite">{error ? t.scanErr.title : done ? s.done : s.title}</h1>
      {biz && <p className="mt-2 text-center text-slate-400">{[biz.name, biz.category, biz.city].join(" · ")}</p>}
      {error ? (
        <div className="card mt-10 p-6 text-center"><p role="alert" className="text-red-200">{error}</p>
          <button onClick={() => { setError(""); setMode("form"); }} className="btn-cta mt-6">{t.scanErr.retry}</button></div>
      ) : (<>
      <div className={`mt-10 grid gap-3 ${s.engines.length === 2 ? "mx-auto max-w-md grid-cols-2" : "grid-cols-3"}`}>
        {s.engines.map((e, i) => { const st = engineState(i); return (
          <div key={e} className={`card p-4 text-center transition ${st === "active" ? "ring-2 ring-brand-400 shadow-[0_0_40px_-10px_#3b82f6]" : ""}`}>
            <div className={`mx-auto grid h-12 w-12 place-items-center rounded-full text-lg font-bold ${st === "done" ? "bg-score-high/20 text-score-high" : st === "active" ? "bg-white/50/30 text-white" : "bg-white/5 text-slate-400"}`}>
              {st === "done" ? "✓" : e[0]}
            </div>
            <div className="mt-2 text-sm font-semibold">{e}</div>
            <div className="h-4 text-xs text-slate-400">{st === "active" && <span>{s.asking}<span className="dot">.</span><span className="dot [animation-delay:.2s]">.</span><span className="dot [animation-delay:.4s]">.</span></span>}</div>
          </div>); })}
      </div>
      <div className="mt-8">
        <div className="flex justify-between text-sm text-slate-400"><span>{checks}/{TOTAL} {s.checks}</span><span className="tabular-nums">{pct}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-sky-400 transition-[width] duration-700 rtl:bg-gradient-to-l" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {slow && <p role="status" data-slow-note className="mx-auto mt-6 w-fit max-w-full rounded-lg border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-center text-sm text-sky-100">{s.slow}</p>}
      <ol className="card mt-8 space-y-3 p-6">
        {s.steps.map((label, i) => { const st = i < step ? "done" : i === step ? "active" : "wait"; return (
          <li key={label} className={`flex items-center gap-3 ${st === "wait" ? "text-slate-400" : "text-white"}`}>
            <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${st === "done" ? "bg-score-high/20 text-score-high" : st === "active" ? "bg-white/50/40" : "bg-white/5"}`}>
              {st === "done" ? "✓" : st === "active" ? <span className="dot h-2 w-2 rounded-full bg-white" /> : i + 1}
            </span>{label}
          </li>); })}
      </ol>
      <div className="mt-10 text-center">
        {done ? <a href={link} className="btn-cta">{s.view} <span className="rtl:rotate-180">→</span></a> : <span className="text-sm text-slate-400">~60s</span>}
      </div></>)}
    </main>
  );
}
