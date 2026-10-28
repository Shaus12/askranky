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
  // Paid lists only name what runs today. The manual re-scan line becomes the automatic one, and the digest line is added, only when the server reports the job on.
  const item = (id: string, it: string) => data?.autoRescan && CAD[id] && /re-scan|סריקה חוזרת/i.test(it) ? t.pricing.live.rescan[CAD[id]] : it;
  const items = (id: string, list: readonly string[]) => [...list.map((x) => item(id, x)), ...(data?.digest && CAD[id] ? [t.pricing.live.digest] : [])];
  const price = (id: string) => data?.plans.find((p) => p.id === id)?.prices[cur] ?? PRICES[id][cur];
  return (<>
    {/* Main offer: one-time Fix-up (src/plans.js PRODUCTS.fixup, ILS only). Same checkout path as before; only the layout changed.
        The guarantee line is the exact refunds §1A wording (HE/EN); nothing here goes beyond terms §4.6. */}
    <div data-reveal data-product="fixup" data-main-offer className="card vx-hot mt-10 grid gap-6 border-brand-600/50 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
      <div><span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">{t.pricing.fixup.badge}</span>
        <h3 className="mt-3 text-xl font-bold text-white sm:text-2xl">{t.pricing.fixup.name}</h3>
        <p className="mt-2 text-slate-300">{t.pricing.fixup.sub}</p>
        <p className="mt-4 text-sm font-semibold text-slate-200">{t.pricing.fixup.stackTitle}</p>
        <ul className="mt-2 grid gap-2 text-slate-300 sm:grid-cols-2" data-fixup-stack>{t.pricing.fixup.items.map((it) => <li key={it} className="flex gap-2"><span aria-hidden className="text-sky-400">✓</span>{it}</li>)}</ul>
        <p className="mt-3 text-sm text-slate-400">{t.pricing.fixup.manual}</p>
        <p className="mt-2 text-sm text-slate-300" data-fixup-guarantee>{t.pricing.fixup.guarantee} <Link className="underline" href={`/${lang}/legal/refunds`}>{t.pricing.fixup.terms}</Link></p></div>
      <div className="text-center md:text-end"><div className="font-head text-5xl font-bold text-white"><span dir="ltr" data-price="fixup">{t.pricing.fixup.price}</span></div><p className="text-sm text-slate-400">{t.pricing.fixup.once}</p>
        <Link href={`/${lang}/checkout?plan=fixup`} className="btn-cta mt-4">{t.pricing.fixup.cta}</Link></div>
    </div>
    <div data-reveal className="mt-12 text-center"><h3 className="text-lg font-bold text-white">{t.pricing.fixup.monthlyTitle}</h3><p className="mt-1 text-sm text-slate-400">{t.pricing.fixup.monthlySub}</p></div>
    {usd && <div data-reveal className="mt-6 flex justify-center">
      <div role="radiogroup" aria-label={t.pricing.currency} dir="ltr" className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-sm font-semibold">
        {(["ILS", "USD"] as Currency[]).map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cur === c} onClick={() => pick(c)} data-currency={c}
            className={`rounded-full px-4 py-1.5 transition ${cur === c ? "bg-brand-600 text-white" : "text-sky-300 hover:bg-white/5"}`}>{c === "ILS" ? "₪ ILS" : "$ USD"}</button>))}
      </div>
    </div>}
    <div className={`${usd ? "mt-8" : "mt-6"} grid gap-5 sm:grid-cols-2 lg:grid-cols-4`}>
      {t.pricing.plans.map((p) => { const v = price(p.id); return (
        <div data-reveal key={p.id} data-plan={p.id} className="card relative flex flex-col p-6">
          <h3 className="text-lg font-bold">{p.name}</h3>
          <div className="font-head mt-3 text-4xl font-bold text-white"><span dir="ltr" data-price={p.id}>{fmt(v, cur)}</span><span className="text-base font-medium text-slate-400">{v ? t.pricing.mo : ""}</span></div>
          <ul className="mt-4 flex-1 space-y-2 text-slate-300">{items(p.id, p.items).map((it) => <li key={it} className="flex gap-2"><span aria-hidden className="text-sky-400">✓</span>{it}</li>)}</ul>
          <Link href={v ? `/${lang}/checkout?plan=${p.id}` : `/${lang}/scan`} className="mt-6 btn-outline">{p.cta}</Link>
        </div>); })}
    </div>
    {/* Founding-member offer (policy text only; FOUNDING_MEMBER_LIMIT from /api/pricing, 0 hides it). No live counter: we never claim how many are left. */}
    {!!data?.founding?.limit && <div data-reveal data-founding className="card mt-5 border-brand-600/40 p-6 text-center">
      <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">{t.pricing.founding.badge}</span>
      <h3 className="mt-3 text-lg font-bold text-white">{t.pricing.founding.title.replace("{n}", String(data.founding.limit))}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-slate-300">{t.pricing.founding.body.replace("{n}", String(data.founding.limit))}</p>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400" data-guarantee>{t.pricing.founding.guarantee} <Link className="underline" href={`/${lang}/legal/refunds`}>{t.pricing.founding.terms}</Link></p>
    </div>}
    <p data-reveal className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-400">{t.pricing.vatNote}</p>
  </>);
}
