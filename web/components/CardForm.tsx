"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api";
import { payText } from "@/lib/i18n-pay";
// Embedded SUMIT Payments JS card form. Card number / expiry / CVV / ID are plain uncontrolled inputs (no `name`, never in React state,
// never read by our code): SUMIT's payments.js reads them from the DOM and tokenizes them browser -> api.sumit.co.il with the PUBLIC key.
// We only ever send { identifier, token, lang } to our own server. payments.js requires jQuery, which we self-host (/vendor, CSP 'self').
export type Embedded = { companyId: number; publicKey: string; identifier: string };
const JQUERY = "/vendor/jquery-3.7.1.min.js", SUMIT = "https://app.sumit.co.il/scripts/payments.js", FORM = "ranky-card-form";
const loading: Record<string, Promise<void>> = {};
const loadScript = (src: string) => (loading[src] ||= new Promise<void>((ok, bad) => { const s = document.createElement("script"); s.src = src; s.async = false; s.onload = () => ok(); s.onerror = () => { delete loading[src]; bad(new Error("load")); }; document.head.appendChild(s); }));
const loadSumit = async () => { await loadScript(JQUERY); await loadScript(SUMIT); };
const wipe = () => { document.querySelectorAll<HTMLInputElement>(`#${FORM} [data-og], #${FORM} #og-token`).forEach((i) => { i.value = ""; }); };
function tokenize(e: Embedded, lang: Locale, tt: (typeof payText)[Locale]): Promise<string> {
  return new Promise((ok, bad) => {
    const og = (window as any).OfficeGuy; if (!og?.Payments?.CreateToken) return bad(new Error(tt.loadErr)); const to = setTimeout(() => bad(new Error(tt.timeout)), 30000);
    og.Payments.CreateToken({ CompanyID: e.companyId, APIPublicKey: e.publicKey, FormSelector: `#${FORM}`, ErrorsClass: ".og-errors-unused", ResponseLanguage: lang,
      ResponseCallback: (x: any) => { clearTimeout(to); const t = x?.Status === 0 && x?.Data?.SingleUseToken; t ? ok(t) : bad(new Error(x?.UserErrorMessage || tt.tokenErr)); } });
  });
}
export default function CardForm({ embedded, lang, onPaid }: { embedded: Embedded; lang: Locale; onPaid: () => void }) {
  const tt = payText[lang]; const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const lock = useRef(false);
  useEffect(() => { let on = true; loadSumit().then(() => on && setReady(true)).catch(() => on && setErr(tt.loadErr)); return () => { on = false; wipe(); }; }, [tt.loadErr]);
  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setErr("");
    try {
      const token = await tokenize(embedded, lang, tt); wipe();
      try { await api("/api/checkout/charge", { body: { identifier: embedded.identifier, token, lang } }); onPaid(); }
      catch (x: any) { const c = x?.data?.error; setErr(c === "declined" ? tt.declined : c === "invalid_checkout" || c === "prelaunch" ? tt.invalid : c === "rate_limited" ? tt.rate : c === "busy" ? tt.busy : tt.failed); }
    } catch (x: any) { setErr(String(x?.message || tt.tokenErr)); } finally { wipe(); lock.current = false; setBusy(false); }
  }
  const inp = "vx-input"; // card fields are always LTR digits
  return (
    <form id={FORM} onSubmit={submit} autoComplete="on" noValidate className="space-y-3" data-sumit-card-form>
      <h2 className="font-head text-lg font-bold">{tt.title}</h2><p className="text-xs text-slate-400">{tt.sub}</p>
      <label className="vx-label">{tt.card}<input type="text" inputMode="numeric" autoComplete="cc-number" maxLength={23} dir="ltr" className={inp} data-og="cardnumber" /></label>
      <div className="grid grid-cols-3 gap-3">
        <label className="vx-label">{tt.month}<input type="text" inputMode="numeric" autoComplete="cc-exp-month" maxLength={2} dir="ltr" className={inp} data-og="expirationmonth" /></label>
        <label className="vx-label">{tt.year}<input type="text" inputMode="numeric" autoComplete="cc-exp-year" maxLength={4} dir="ltr" className={inp} data-og="expirationyear" /></label>
        <label className="vx-label">{tt.cvv}<input type="text" inputMode="numeric" autoComplete="cc-csc" maxLength={4} dir="ltr" className={inp} data-og="cvv" /></label>
      </div>
      <label className="vx-label">{tt.id}<input type="text" inputMode="numeric" autoComplete="off" maxLength={12} dir="ltr" className={inp} data-og="citizenid" /></label>
      {err && <p role="alert" className="text-sm text-red-200">{err}</p>}
      <button className="btn-cta w-full" disabled={!ready || busy}>{busy ? tt.paying : tt.pay}</button>
      <p className="text-center text-xs text-slate-500">{tt.secure}</p>
    </form>);
}
