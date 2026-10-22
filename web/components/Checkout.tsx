"use client";
import { useEffect, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { api } from "@/lib/api";
import { fmt, type Billing, type Pricing } from "@/lib/prices";
// ?plan=starter → email form → POST /api/checkout → payment provider redirect.
// ?account=… → mock payment page (stands in for the SUMIT hosted page while PAYMENTS_PROVIDER=mock).
export default function Checkout({ t, lang }: { t: Dict; lang: Locale }) {
  const [q, setQ] = useState<URLSearchParams | null>(null); const [err, setErr] = useState(""); const [bill, setBill] = useState<Billing | null>(null);
  useEffect(() => { const sp = new URLSearchParams(location.search); setQ(sp);
    // Show exactly what the server will charge (server re-prices on POST; the client never sends an amount).
    api<Pricing>(`/api/pricing?lang=${lang}`).then((j) => setBill(j.plans.find((p) => p.id === (sp.get("plan") || "starter"))?.billing || null)).catch(() => {}); }, [lang]);
  if (!q) return <main className="min-h-[60vh]" />;
  const c = t.checkout; const account = q.get("account");
  if (account) { const a = encodeURIComponent(account); return (
    <main className="mx-auto max-w-md px-4 py-[clamp(3rem,calc(var(--u)*96),6rem)] text-center"><div className="card p-8">
      <span className="rounded-full border border-[#e8b04b]/30 bg-[#e8b04b]/10 text-amber-100 px-3 py-1 text-xs">{c.pill}</span>
      <h1 className="font-head vx-h3 mt-5 !text-3xl">{c.title}</h1><p className="mt-2 text-slate-400">{c.sub}</p>
      <div className="mt-8 flex flex-col gap-3"><a className="btn-cta" href={`/billing/return?Valid=1&Token=tok_test&Identifier=${a}`}>{c.pay}</a><a className="btn-ghost" href={`/billing/return?Valid=0&Identifier=${a}`}>{c.decline}</a></div>
    </div></main>); }
  const plan = q.get("plan") || "starter";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const email = String(new FormData(e.currentTarget).get("email") || "");
    try { const j = await api<{ redirectUrl: string }>("/api/checkout", { body: { plan, email, lang, currency: bill?.displayCurrency } }); location.href = j.redirectUrl; } catch (x: any) { setErr(x.message); }
  }
  const p = t.pricing.plans.find((x) => x.id === plan) || t.pricing.plans[1];
  return (
    <main className="mx-auto max-w-md px-5 py-[clamp(3rem,calc(var(--u)*96),6rem)]"><form onSubmit={submit} className="card space-y-4 p-8">
      <h1 className="font-head text-2xl font-bold">{p.name}{bill && <> · <span dir="ltr">{fmt(bill.displayAmount, bill.displayCurrency)}</span>{t.pricing.mo}</>}</h1>
      {bill && <div className="vx-copy p-3 text-sm text-slate-300" data-billing={bill.currency}>
        <p>{c.charged}: <b dir="ltr" className="text-white">{fmt(bill.amount, bill.currency)}</b>{t.pricing.mo}</p>
        {bill.fallback && <p className="mt-1 text-amber-100">{c.fallback}</p>}<p className="mt-1 text-slate-400">{c.noVat}</p></div>}
      <label className="vx-label">{c.email}<input name="email" type="email" required dir="ltr" className="vx-input" /></label>
      {err && <p role="alert" className="text-sm text-red-200">{err}</p>}
      <button className="btn-cta w-full">{c.start}</button>
    </form></main>
  );
}
