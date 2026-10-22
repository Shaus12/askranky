"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";
import { api, idFromPath } from "@/lib/api";
import ScoreGauge from "./ScoreGauge";
import TrendChart from "./TrendChart";

// /[lang]/dashboard/<accountId>?key=<dashboard key> (from the magic link). The key is moved from the URL into
// sessionStorage right away and sent as the x-dashboard-key header, so it doesn't linger in history or screenshots.
export default function Dashboard({ t, lang }: { t: Dict; lang: Locale }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState("");
  const [auth, setAuth] = useState<{ id: string; key: string } | null>(null);
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
  if (err && !d) return <main className="mx-auto max-w-md px-4 py-20 text-center"><p role="alert" className="glass p-6 text-red-200">{err}</p><Link href={`/${lang}/login`} className="btn-cta mt-8">{t.login.nav}</Link></main>;
  if (!d) return <main className="min-h-[60vh] py-20 text-center text-slate-400">{t.live.loading}</main>;
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">{t.dash.title}</h1>
      <p className="mt-2 text-slate-400"><span dir="ltr">{d.account.email}</span> · {t.dash.plan}: <b className="text-white">{d.account.plan}</b> · {t.dash.usage}: <span dir="ltr">{d.usage.used}/{d.usage.cap}</span></p>
      {err && <p role="alert" className="mt-4 text-red-200">{err}</p>}
      {!d.businesses.length && <p className="glass mt-8 p-6">{t.dash.none}</p>}
      <div className="mt-8 grid gap-6">
        {d.businesses.map((b: any) => { const last = b.scans.at(-1); return (
          <div key={b.id} className="card grid gap-6 p-6 text-slate-900 md:grid-cols-[200px_1fr_auto] md:items-center">
            <div>{last && <ScoreGauge score={last.summary.score} label={t.dash.last} />}</div>
            <div><h2 className="text-xl font-bold">{b.name}</h2><p className="text-slate-500">{b.category} · {b.city} · {b.scans.length} {t.dash.scans}</p>
              {b.scans.length > 1 && <div className="mt-3 max-w-sm"><TrendChart values={b.scans.map((s: any) => s.summary.score)} weekLabel={t.report.weeks} /></div>}</div>
            <div className="flex flex-col gap-2">
              {last && <a href={`/${lang}/r/${last.id}`} className="rounded-full border border-brand-200 px-5 py-2 text-center font-semibold text-brand-700">{t.dash.open}</a>}
              {d.account.plan !== "free" && <button onClick={() => rescan(b.id)} disabled={!!busy} className="btn-cta !py-2 disabled:opacity-60">{busy === b.id ? "…" : t.dash.rescan}</button>}
            </div>
          </div>); })}
      </div>
    </main>
  );
}
