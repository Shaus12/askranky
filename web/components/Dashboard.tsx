"use client";
import { paidLoginText } from "@/lib/i18n-free";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";
import { api, idFromPath } from "@/lib/api";
import ScoreGauge from "./ScoreGauge";
import TrendChart from "./TrendChart";
import DashInsights from "./DashInsights";

// /[lang]/dashboard/<accountId>?key=<dashboard key> (from the magic link). The key is moved from the URL into
// sessionStorage right away and sent as the x-dashboard-key header, so it doesn't linger in history or screenshots.
export default function Dashboard({ t, lang }: { t: Dict; lang: Locale }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState("");
  const [auth, setAuth] = useState<{ id: string; key: string } | null>(null);
  const [confirming, setConfirming] = useState(false); const [cancelMsg, setCancelMsg] = useState("");
  useEffect(() => {
    const id = idFromPath("dashboard"); const q = new URLSearchParams(location.search); const sk = `ranky-key-${id}`;
    const key = q.get("key") || sessionStorage.getItem(sk) || "";
    if (q.get("key")) { sessionStorage.setItem(sk, key); history.replaceState(null, "", location.pathname); }
    if (!id || !key) { setErr(t.dash.bad); return; }
    setAuth({ id, key });
    api(`/api/dashboard/${encodeURIComponent(id)}`, { headers: { "x-dashboard-key": key } }).then(setD).catch(() => setErr(t.dash.bad));
  }, [t]);
  async function rescan(businessId: string) {
    if (!auth) return; setBusy(businessId);
    try { const j = await api<{ reportId: string }>(`/api/dashboard/${encodeURIComponent(auth.id)}/rescan`, { body: { businessId }, headers: { "x-dashboard-key": auth.key } }); location.href = `/${lang}/r/${j.reportId}`; }
    catch (e: any) { setErr(e.message); setBusy(""); }
  }
  async function cancel() {
    if (!auth) return; setBusy("cancel"); setErr("");
    try { const j = await api<{ paidThrough: string }>(`/api/dashboard/${encodeURIComponent(auth.id)}/cancel`, { body: { confirm: true, lang }, headers: { "x-dashboard-key": auth.key } });
      setD({ ...d, account: { ...d.account, status: "cancelled", active: false, paidThrough: j.paidThrough } }); setCancelMsg(`${t.dash.cancelDone} ${String(j.paidThrough).slice(0, 10)}`); setConfirming(false); }
    catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  }
  if (err && !d) return <main className="mx-auto max-w-md px-4 py-20 text-center"><p role="alert" className="card p-6 text-red-200">{err}</p><Link href={`/${lang}/login`} className="btn-cta mt-8">{t.login.nav}</Link></main>;
  if (!d) return <main className="min-h-[60vh] py-20 text-center text-slate-400">{t.live.loading}</main>;
  return (
    <main className="mx-auto max-w-5xl px-5 py-[clamp(3rem,calc(var(--u)*80),5rem)]">
      <h1 className="font-head vx-h3">{t.dash.title}</h1>
      <span className="hairline mt-6 block w-40" /><p className="mt-5 text-slate-300"><span dir="ltr">{d.account.email}</span> · {t.dash.plan}: <b className="text-white">{d.account.plan}</b>{d.account.comp && <span className="ms-2 rounded-full border border-white/15 px-2 py-0.5 text-xs text-slate-300" data-comp>{lang === "he" ? "חשבון מתנה" : "Complimentary"}</span>} · {t.dash.usage}: <span dir="ltr">{d.usage.used}/{d.usage.cap}</span></p>
      {d.account.plan !== "free" && <p data-back-to-scan className="mt-4"><a href={`/${lang}/scan`} className="btn-cta !py-2">{paidLoginText[lang].returnScan} <span aria-hidden className="rtl:rotate-180">→</span></a></p>}
      {err && <p role="alert" className="mt-4 text-red-200">{err}</p>}
      {d.account.plan !== "free" && d.account.status && (
        <section className="card mt-8 p-6" data-subscription aria-labelledby="sub-h">
          <h2 id="sub-h" className="text-lg font-bold">{t.dash.sub}</h2>
          <p className="mt-2 text-slate-300">{d.account.status === "cancelled" ? `${t.dash.cancelled} ${String(d.account.paidThrough || "").slice(0, 10)}` : d.account.status === "past_due" ? t.dash.pastDue : t.dash.active}</p>
          {cancelMsg && <p role="status" className="mt-3 text-blue-200">{cancelMsg}</p>}
          {d.account.status !== "cancelled" && !confirming && <button onClick={() => setConfirming(true)} className="btn-outline mt-4 !py-2" data-cancel>{t.dash.cancel}</button>}
          {confirming && (
            <div role="alertdialog" aria-labelledby="cancel-h" aria-describedby="cancel-b" className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/10 p-5" data-cancel-confirm>
              <h3 id="cancel-h" className="font-bold">{t.dash.cancelTitle}</h3><p id="cancel-b" className="mt-2 text-slate-300">{t.dash.cancelBody}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={cancel} disabled={busy === "cancel"} className="btn-outline !py-2 !border-red-300/60 disabled:opacity-60">{busy === "cancel" ? "…" : t.dash.cancelYes}</button>
                <button onClick={() => setConfirming(false)} autoFocus className="btn-cta !py-2">{t.dash.cancelNo}</button>
              </div>
            </div>)}
        </section>)}
      {!d.businesses.length && <p className="card mt-8 p-6">{t.dash.none}</p>}
      <div className="mt-8 grid gap-6">
        {d.businesses.map((b: any) => { const last = b.scans.at(-1); return (
          <div key={b.id} className="card grid gap-6 p-6  md:grid-cols-[200px_1fr_auto] md:items-center">
            <div>{last && <ScoreGauge score={last.summary.score} label={t.dash.last} />}</div>
            <div><h2 className="text-xl font-bold">{b.name}</h2><p className="text-slate-400">{b.category} · {b.city} · {b.scans.length} {t.dash.scans}</p>
              {b.scans.length > 1 && <div className="mt-3 max-w-sm"><TrendChart values={b.scans.map((s: any) => s.summary.score)} weekLabel={t.report.weeks} /></div>}</div>
            <div className="flex flex-col gap-2">
              {last && <a href={`/${lang}/r/${last.id}`} className="btn-outline !py-2">{t.dash.open}</a>}
              {d.account.plan !== "free" && <button onClick={() => rescan(b.id)} disabled={!!busy} className="btn-cta !py-2 disabled:opacity-60">{busy === b.id ? "…" : t.dash.rescan}</button>}
            </div>
            <div className="md:col-span-3"><DashInsights ins={(d.insights || []).find((x: any) => x.businessId === b.id)} lang={lang} auth={auth} /></div>
          </div>); })}
      </div>
    </main>
  );
}
