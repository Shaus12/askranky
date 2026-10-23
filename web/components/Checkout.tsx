"use client";
import { useEffect, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { api, errMessage, getConfig } from "@/lib/api";
import Turnstile from "./Turnstile";
import CardForm, { type Embedded } from "./CardForm";
import { payText } from "@/lib/i18n-pay";
import { fmt, type Billing, type Pricing } from "@/lib/prices";
type CheckoutRes = { redirectUrl?: string, embedded?: Embedded };
// ?plan=starter → email form → POST /api/checkout → mock: redirect to the stand-in page; SUMIT: embedded card form (CardForm) on this page.
// ?account=… → mock payment page (stands in for the SUMIT hosted page while PAYMENTS_PROVIDER=mock).
export default function Checkout({ t, lang }: { t: Dict; lang: Locale }) {
  const [q, setQ] = useState<URLSearchParams | null>(null); const [err, setErr] = useState(""); const [bill, setBill] = useState<Billing | null>(null);
  const [pre, setPre] = useState<boolean | null>(null); const [joined, setJoined] = useState(false);
  const [siteKey, setSiteKey] = useState<string | null>(null); const [rk, setRk] = useState(0);
  const [emb, setEmb] = useState<Embedded | null>(null); const [paid, setPaid] = useState(false);
  useEffect(() => { const sp = new URLSearchParams(location.search); setQ(sp); getConfig().then((c) => { setPre(!!c.prelaunch); setSiteKey(c.turnstileSiteKey); });
    // Show exactly what the server will charge (server re-prices on POST; the client never sends an amount).
    api<Pricing>(`/api/pricing?lang=${lang}`).then((j) => setBill(j.plans.find((p) => p.id === (sp.get("plan") || "starter"))?.billing || null)).catch(() => {}); }, [lang]);
  if (!q || pre === null) return <main className="min-h-[60vh]" />;
  const c = t.checkout; const account = q.get("account");
  // Pre-launch: never start a payment; collect a waitlist email instead.
  // Admin test checkout (server verified ADMIN_TEST_TOKEN and marked this checkout; /billing/return re-checks): show the mock card page.
  if (pre && !(account && q.get("admintest") === "1")) {
    const join = async (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); setErr(""); const fd = new FormData(e.currentTarget); const token = String(fd.get("cf-turnstile-response") || "");
      if (siteKey && !token) return setErr(t.form.captcha);
      try { await api("/api/waitlist", { body: { email: String(fd.get("email") || ""), lang, plan: q.get("plan"), "cf-turnstile-response": token || undefined } }); setJoined(true); } catch (x: any) { setErr(errMessage(x, t)); setRk((n) => n + 1); } };
    return (
      <main className="mx-auto max-w-md px-5 py-[clamp(3rem,calc(var(--u)*96),6rem)] text-center" data-prelaunch><div className="card space-y-4 p-8">
        <span className="rounded-full border border-[#e8b04b]/30 bg-[#e8b04b]/10 text-amber-100 px-3 py-1 text-xs">{c.soon}</span>
        <h1 className="font-head vx-h3 mt-3 !text-3xl">{c.soonTitle}</h1><p className="text-slate-400">{c.soonSub}</p>
        {joined ? <p role="status" className="text-emerald-200">{c.joined}</p> : <form onSubmit={join} className="space-y-4 text-start">
          <label className="vx-label">{c.email}<input name="email" type="email" required dir="ltr" className="vx-input" /></label>
          <Turnstile siteKey={siteKey} lang={lang} resetKey={rk} />
          {err && <p role="alert" className="text-sm text-red-200">{err}</p>}
          <button className="btn-cta w-full">{c.join}</button></form>}
        <p className="text-xs text-slate-500">{c.demo}</p>
      </div></main>);
  }
  if (account) { const a = encodeURIComponent(account); return (
    <main className="mx-auto max-w-md px-4 py-[clamp(3rem,calc(var(--u)*96),6rem)] text-center"><div className="card p-8">
      <span className="rounded-full border border-[#e8b04b]/30 bg-[#e8b04b]/10 text-amber-100 px-3 py-1 text-xs">{c.pill}</span>
      <h1 className="font-head vx-h3 mt-5 !text-3xl">{c.title}</h1><p className="mt-2 text-slate-400">{c.sub}</p>
      <div className="mt-8 flex flex-col gap-3"><a className="btn-cta" href={`/billing/return?Valid=1&Token=tok_test&Identifier=${a}`}>{c.pay}</a><a className="btn-ghost" href={`/billing/return?Valid=0&Identifier=${a}`}>{c.decline}</a></div>
    </div></main>); }
  const plan = q.get("plan") || "starter";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const email = String(fd.get("email") || ""); const token = String(fd.get("cf-turnstile-response") || "");
    if (siteKey && !token) return setErr(t.form.captcha); setErr("");
    try { const j = await api<CheckoutRes>("/api/checkout", { body: { plan, email, lang, currency: bill?.displayCurrency, "cf-turnstile-response": token || undefined } }); if (j.embedded) setEmb(j.embedded); else if (j.redirectUrl) location.href = j.redirectUrl; }
    catch (x: any) { if (x.data?.prelaunch) setPre(true); else { setErr(errMessage(x, t)); setRk((n) => n + 1); } }
  }
  const p = t.pricing.plans.find((x) => x.id === plan) || t.pricing.plans[1];
  if (paid) return (<main className="mx-auto max-w-md px-5 py-[clamp(3rem,calc(var(--u)*96),6rem)] text-center" data-paid><div className="card space-y-3 p-8"><h1 className="font-head vx-h3 !text-3xl">{payText[lang].paidTitle}</h1><p role="status" className="text-slate-300">{payText[lang].paidSub}</p></div></main>);
  if (emb) return (
    <main className="mx-auto max-w-md px-5 py-[clamp(3rem,calc(var(--u)*96),6rem)]"><div className="card space-y-4 p-8" data-embedded-checkout>
      <h1 className="font-head text-2xl font-bold">{p.name}{bill && <> · <span dir="ltr">{fmt(bill.displayAmount, bill.displayCurrency)}</span>{t.pricing.mo}</>}</h1>
      {bill && <div className="vx-copy p-3 text-sm text-slate-300" data-billing={bill.currency}>
        <p>{c.charged}: <b dir="ltr" className="text-white">{fmt(bill.amount, bill.currency)}</b>{t.pricing.mo}</p>
        {bill.fallback && <p className="mt-1 text-amber-100">{c.fallback}</p>}<p className="mt-1 text-slate-400">{c.noVat}</p></div>}
      <p className="text-xs text-slate-400" data-disclosure>{c.renew} {t.footer.seller}</p>
      <CardForm embedded={emb} lang={lang} onPaid={() => setPaid(true)} />
    </div></main>);
  return (
    <main className="mx-auto max-w-md px-5 py-[clamp(3rem,calc(var(--u)*96),6rem)]"><form onSubmit={submit} className="card space-y-4 p-8">
      <h1 className="font-head text-2xl font-bold">{p.name}{bill && <> · <span dir="ltr">{fmt(bill.displayAmount, bill.displayCurrency)}</span>{t.pricing.mo}</>}</h1>
      {bill && <div className="vx-copy p-3 text-sm text-slate-300" data-billing={bill.currency}>
        <p>{c.charged}: <b dir="ltr" className="text-white">{fmt(bill.amount, bill.currency)}</b>{t.pricing.mo}</p>
        {bill.fallback && <p className="mt-1 text-amber-100">{c.fallback}</p>}<p className="mt-1 text-slate-400">{c.noVat}</p></div>}
      <p className="text-xs text-slate-400" data-disclosure>{c.renew} {t.footer.seller}</p>
      <label className="vx-label">{c.email}<input name="email" type="email" required dir="ltr" className="vx-input" /></label>
      <Turnstile siteKey={siteKey} lang={lang} resetKey={rk} />
      {err && <p role="alert" className="text-sm text-red-200">{err}</p>}
      <button className="btn-cta w-full">{c.start}</button>
    </form></main>
  );
}
