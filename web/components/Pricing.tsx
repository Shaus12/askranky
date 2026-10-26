"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { api } from "@/lib/api";
import { PRICES, fmt, setCurrencyCookie, type Currency, type Pricing as P } from "@/lib/prices";
// Plan cards + ILS/USD toggle. Currency comes from /api/pricing (cookie > CF-IPCountry > Hebrew locale > Accept-Language);
// the toggle saves ranky_currency and refetches. Amounts shown are server prices; checkout re-prices server-side anyway.
export default function Pricing({ t, lang }: { t: Dict; lang: Locale }) {
  const [cur, setCur] = useState<Currency>("ILS"); const [data, setData] = useState<P | null>(null);
  const load = (c?: Currency) => api<P>(`/api/pricing?lang=${lang}${c ? `&currency=${c}` : ""}`).then((j) => { setData(j); setCur(j.usdBilling ? j.currency : "ILS"); }).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Billing is ILS only unless the server reports usdBilling: prices are shown in ILS and the currency toggle is hidden (no USD in public copy).
  const usd = !!data?.usdBilling;
  const pick = (c: Currency) => { setCurrencyCookie(c); setCur(c); load(c); };
  // Cadence / digest lines: the static copy says "coming soon"; only when the server reports the job enabled (AUTO_RESCAN_ENABLED /
  // MONTHLY_DIGEST_ENABLED via /api/pricing) is the line swapped for the "it runs" wording. Starter monthly, Pro/Agency weekly (src/plans.js).
  const CAD: Record<string, "monthly" | "weekly"> = { starter: "monthly", pro: "weekly", agency: "weekly" };
  const item = (id: string, it: string) => data?.autoRescan && CAD[id] && /re-scan|סריקה חוזרת/.test(it) ? t.pricing.live.rescan[CAD[id]] : data?.digest && /summary|סיכום חודשי/.test(it) ? t.pricing.live.digest : it;
  const price = (id: string) => data?.plans.find((p) => p.id === id)?.prices[cur] ?? PRICES[id][cur];
  return (<>
    {usd && <div data-reveal className="mt-10 flex justify-center">
      <div role="radiogroup" aria-label={t.pricing.currency} dir="ltr" className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-sm font-semibold">
        {(["ILS", "USD"] as Currency[]).map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cur === c} onClick={() => pick(c)} data-currency={c}
            className={`rounded-full px-4 py-1.5 transition ${cur === c ? "bg-brand-600 text-white" : "text-sky-300 hover:bg-white/5"}`}>{c === "ILS" ? "₪ ILS" : "$ USD"}</button>))}
      </div>
    </div>}
    <div className={`${usd ? "mt-12" : "mt-10"} grid gap-5 sm:grid-cols-2 lg:grid-cols-4`}>
      {t.pricing.plans.map((p) => { const hot = p.id === "pro"; const v = price(p.id); return (
        <div data-reveal key={p.id} className={`card relative flex flex-col p-6 ${hot ? "vx-hot lg:-translate-y-2" : ""}`}>
          {hot && <span className="absolute -top-3 start-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">{t.pricing.popular}</span>}
          <h3 className="text-lg font-bold">{p.name}</h3>
          <div className="font-head mt-3 text-4xl font-bold text-white"><span dir="ltr" data-price={p.id}>{fmt(v, cur)}</span><span className="text-base font-medium text-slate-400">{v ? t.pricing.mo : ""}</span></div>
          <ul className="mt-4 flex-1 space-y-2 text-slate-300">{p.items.map((x) => item(p.id, x)).map((it) => <li key={it} className="flex gap-2"><span aria-hidden className="text-sky-400">✓</span>{it}</li>)}</ul>
          <Link href={v ? `/${lang}/checkout?plan=${p.id}` : `/${lang}/scan`} className={`mt-6 ${hot ? "btn-cta" : "btn-outline"}`}>{p.cta}</Link>
        </div>); })}
    </div>
    <p data-reveal className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-400">{t.pricing.vatNote}</p>
  </>);
}
