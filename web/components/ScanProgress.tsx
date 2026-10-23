"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import { reducedMotion } from "@/lib/motion";
import { api, errMessage, getConfig } from "@/lib/api";
import ScanForm, { PENDING } from "./ScanForm";
import Reveal from "./Reveal";
import MaskHeading from "./MaskHeading";


const STEP_MS = 1100;
type Pending = { name: string; website?: string; category: string; city: string; email: string; turnstileToken?: string };

// Shows the scan form when nothing is pending; otherwise POSTs /api/scan and animates progress until the real report id comes back.
// ?step=N freezes a demo state (used for screenshots).
export default function ScanProgress({ t, lang }: { t: Dict; lang: Locale }) {
  const s = t.scan; const n = s.steps.length; const router = useRouter();
  const [mode, setMode] = useState<"init" | "form" | "run" | "demo">("init");
  const [biz, setBiz] = useState<Pending | null>(null); const [mock, setMock] = useState(true);
  const [step, setStep] = useState(0); const [reportId, setReportId] = useState(""); const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    getConfig().then((c) => setMock(c.mock || !!c.prelaunch));
    const q = new URLSearchParams(window.location.search);
    if (q.has("step")) { setMode("demo"); setBiz({ name: lang === "he" ? "אינסטלציה אקמה" : "Acme Plumbing", category: lang === "he" ? "אינסטלטור" : "Plumber", city: lang === "he" ? "תל אביב-יפו" : "Austin, TX", email: "" }); setStep(Math.min(Number(q.get("step")), n)); return; }
    const raw = sessionStorage.getItem(PENDING); if (!raw) { setMode("form"); return; }
    if (started.current) return; started.current = true;
    const p: Pending = JSON.parse(raw); setBiz(p); setMode("run");
    api<{ reportId: string }>("/api/scan", { body: { ...p, lang } })
      .then((j) => { sessionStorage.removeItem(PENDING); setReportId(j.reportId); })
      .catch((e) => { sessionStorage.removeItem(PENDING); setError(errMessage(e, t)); });
  }, [lang, n]);
  // Animate up to the last step; only finish once the server answered.
  useEffect(() => {
    if (mode !== "run") return;
    if (reducedMotion()) { setStep(reportId ? n : n - 1); return; }
    const id = setInterval(() => setStep((x) => (x >= n - 1 ? (reportId ? n : x) : x + 1)), reportId ? 250 : STEP_MS);
    return () => clearInterval(id);
  }, [mode, reportId, n]);
  useEffect(() => { if (mode === "run" && step >= n && reportId) { const id = setTimeout(() => location.assign(`/${lang}/r/${reportId}`), 900); return () => clearTimeout(id); } }, [mode, step, n, reportId, lang, router]);

  if (mode === "init") return <main className="min-h-[60vh]" />;
  if (mode === "form") return (
    <main><Reveal className="mx-auto max-w-xl px-5 py-[clamp(3rem,calc(var(--u)*80),5rem)]">
      <MaskHeading as="h1" className="vx-h3" text={t.hero.title} />
      <span data-hair className="hairline mx-auto my-8 block w-40" />
      <div data-reveal><ScanForm t={t} lang={lang} /></div>
    </Reveal></main>);
  const done = step >= n; const TOTAL = 15;
  const pct = Math.round((step / n) * 100);
  const checks = Math.min(TOTAL, Math.max(0, Math.round(((step - 1) / 3) * TOTAL)));
  const engineState = (i: number) => (step > i + 1 ? "done" : step === i + 1 ? "active" : "wait");
  const link = mode === "demo" ? `/${lang}/report` : `/${lang}/r/${reportId}`;
  return (
    <main className="mx-auto max-w-2xl px-5 py-[clamp(3rem,calc(var(--u)*80),5rem)]">
      {mock && <p className="mx-auto w-fit rounded-full border border-[#e8b04b]/30 bg-[#e8b04b]/10 text-amber-100 px-4 py-1.5 text-center text-xs">{s.mock}</p>}
      <h1 className="font-head vx-h3 mt-8 text-center" aria-live="polite">{error ? t.scanErr.title : done ? s.done : s.title}</h1>
      {biz && <p className="mt-2 text-center text-slate-400">{[biz.name, biz.category, biz.city].join(" · ")}</p>}
      {error ? (
        <div className="card mt-10 p-6 text-center"><p role="alert" className="text-red-200">{error}</p>
          <button onClick={() => { setError(""); setMode("form"); }} className="btn-cta mt-6">{t.scanErr.retry}</button></div>
      ) : (<>
      <div className="mt-10 grid grid-cols-3 gap-3">
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
