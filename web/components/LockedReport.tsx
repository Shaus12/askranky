"use client";
import { useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { api } from "@/lib/api";
import { GATE } from "@/lib/gate";
import ScoreGauge from "./ScoreGauge";

// gate1: partial report (served by GET /api/report/:id while the scan is locked). The server sends only the score, engines ran and the
// top competitor names; the locked rows below are static placeholders, not hidden data. Email unlocks via POST /api/report/:id/unlock.
export type Partial = { locked: true; business: { name: string; city: string; category: string }; scan: { id: string; at: string; mock: boolean; summary: { score: number; checks: number; engines: { ran: string[] }; topCompetitors: { name: string; count: number }[] } }; hiddenCompetitors: number };
export default function LockedReport({ t, lang, data, onUnlocked }: { t: Dict; lang: Locale; data: Partial; onUnlocked: () => void }) {
  const g = GATE[lang]; const s = data.scan.summary; const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const email = String(fd.get("email") || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr(g.invalid);
    setBusy(true); setErr("");
    try { await api(`/api/report/${encodeURIComponent(data.scan.id)}/unlock`, { body: { email, lang, marketingConsent: fd.get("marketingConsent") ? "on" : "" } }); onUnlocked(); }
    catch (x: any) { setErr(x?.code === "login_required" ? g.loginRequired : x?.code === "email_invalid" ? g.invalid : x?.code === "rate_limited" ? t.form.rateLimited.replace("{m}", "15") : g.error); }
    finally { setBusy(false); }
  }
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-10" data-locked-report>
      <p className="vx-eyebrow">{g.lockedEyebrow}</p>
      <h1 className="vx-h2 mt-2 break-words">{data.business.name}</h1>
      <p className="mt-2 text-slate-300">{data.business.city} · <span dir="ltr">{String(data.scan.at).slice(0, 10)}</span></p>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="card p-6" data-partial-score><ScoreGauge score={s.score} label={g.scoreLabel} size={220} /></div>
        <div className="card p-6" data-partial-competitors><h2 className="mb-4 font-bold">{g.instead}</h2>
          {s.topCompetitors.length ? <ol className="space-y-3">{s.topCompetitors.map((c, i) => (
            <li key={c.name} className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-xs font-bold text-sky-300">{i + 1}</span><span className="flex-1 break-words">{c.name}</span><span className="text-sm text-slate-400">{c.count}×</span></li>))}</ol>
            : <p className="text-sm text-slate-300">{g.insteadNone}</p>}
          {data.hiddenCompetitors > 0 && <p className="mt-3 text-sm text-slate-400">{g.more(data.hiddenCompetitors)}</p>}
        </div>
      </div>
      <div className="card mt-5 p-6" data-unlock>
        <h2 className="vx-h3">{g.unlockTitle}</h2>
        <p className="mt-2 text-slate-300">{g.unlockBody}</p>
        <ul aria-hidden className="mt-4 grid gap-2 sm:grid-cols-2">{g.lockedRows.map((x) => <li key={x} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400"><span>🔒</span>{x}</li>)}</ul>
        <form onSubmit={submit} noValidate className="mt-5 space-y-3" data-unlock-form>
          <label className="vx-label">{g.emailLabel}<span className="text-sky-300" aria-hidden> *</span>
            <input name="email" type="email" required dir="ltr" autoComplete="email" inputMode="email" placeholder="you@business.com" className="vx-input" /></label>
          <label className="flex items-start gap-2 text-sm text-slate-300">
            <input type="checkbox" name="marketingConsent" value="on" defaultChecked={false} className="mt-0.5 h-6 w-6 shrink-0 accent-blue-600" />
            <span>{t.form.consent}</span></label>
          <p className="text-xs text-slate-400">{g.noSpam} <a className="vx-link underline" href={`/${lang}/legal/privacy`}>{t.form.privacyLink}</a>.</p>
          {err && <p role="alert" className="rounded-lg bg-score-low/15 px-3 py-2 text-sm text-red-200">{err}</p>}
          <button className="btn-cta w-full" disabled={busy}>{busy ? g.unlocking : g.unlockBtn}</button>
        </form>
      </div>
    </main>
  );
}
