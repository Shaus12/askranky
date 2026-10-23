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
const Lock = () => (<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>);
const Warn = () => (<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>);
// `amount`: display-only label of what the server will charge (e.g. "₪79"); the server re-prices and the client never sends an amount.
export default function CardForm({ embedded, lang, onPaid, onAlready, amount }: { embedded: Embedded; lang: Locale; onPaid: () => void; onAlready?: () => void; amount?: string }) {
  const tt = payText[lang]; const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const lock = useRef(false); const errBox = useRef<HTMLDivElement>(null);
  useEffect(() => { let on = true; loadSumit().then(() => on && setReady(true)).catch(() => on && setErr(tt.loadErr)); return () => { on = false; wipe(); }; }, [tt.loadErr]);
  useEffect(() => { if (err) errBox.current?.scrollIntoView({ block: "nearest" }); }, [err]);
  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setErr("");
    try {
      const token = await tokenize(embedded, lang, tt); wipe();
      try { await api("/api/checkout/charge", { body: { identifier: embedded.identifier, token, lang } }); onPaid(); }
      catch (x: any) { const c = x?.data?.error; if (c === "already_subscribed" && onAlready) return onAlready(); setErr(c === "declined" ? tt.declined : c === "invalid_checkout" || c === "prelaunch" ? tt.invalid : c === "rate_limited" ? tt.rate : c === "busy" ? tt.busy : tt.failed); }
    } catch (x: any) { setErr(String(x?.message || tt.tokenErr)); } finally { wipe(); lock.current = false; setBusy(false); }
  }
  // Card fields are always LTR digits (dir="ltr"), labels follow the page direction. readOnly (not disabled) while busy keeps the DOM values readable for payments.js.
  const f = { type: "text", inputMode: "numeric", dir: "ltr", className: "pay-input", readOnly: busy, autoCapitalize: "off", spellCheck: false } as const;
  return (
    <form id={FORM} onSubmit={submit} autoComplete="on" noValidate aria-busy={busy} className="card pay-panel space-y-5" data-sumit-card-form>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3"><h2 className="font-head text-lg font-bold text-white">{tt.title}</h2><span className="pay-secure"><Lock />{tt.secureShort}</span></div>
        <p className="text-sm leading-relaxed text-slate-400">{tt.sub}</p>
      </div>
      <div className="pay-field">
        <label htmlFor="cf-number" className="pay-label">{tt.card}</label>
        <input id="cf-number" {...f} autoComplete="cc-number" maxLength={23} placeholder="1234 5678 9012 3456" aria-describedby="cf-err" data-og="cardnumber" />
      </div>
      <div>
        <div className="pay-grid3">
          <div className="pay-field"><label htmlFor="cf-month" className="pay-label">{tt.month}</label><input id="cf-month" {...f} autoComplete="cc-exp-month" maxLength={2} placeholder="MM" aria-describedby="cf-err" data-og="expirationmonth" /></div>
          <div className="pay-field"><label htmlFor="cf-year" className="pay-label">{tt.year}</label><input id="cf-year" {...f} autoComplete="cc-exp-year" maxLength={4} placeholder="YYYY" aria-describedby="cf-err" data-og="expirationyear" /></div>
          <div className="pay-field"><label htmlFor="cf-cvv" className="pay-label">{tt.cvv}</label><input id="cf-cvv" {...f} autoComplete="cc-csc" maxLength={4} placeholder="•••" aria-describedby="cf-cvv-hint cf-err" data-og="cvv" /></div>
        </div>
        <p id="cf-cvv-hint" className="pay-hint">{tt.cvvHint}</p>
      </div>
      <div className="pay-field">
        <label htmlFor="cf-id" className="pay-label">{tt.id}</label>
        <input id="cf-id" {...f} autoComplete="off" maxLength={12} placeholder="123456789" aria-describedby="cf-id-hint cf-err" data-og="citizenid" />
        <p id="cf-id-hint" className="pay-hint">{tt.idHint}</p>
      </div>
      <div id="cf-err" ref={errBox} role="alert" aria-live="assertive" aria-atomic="true">{err && <p className="pay-error"><Warn /><span>{err}</span></p>}</div>
      <button className="btn-cta pay-submit" disabled={!ready || busy}>
        {busy ? <><span className="pay-spin" aria-hidden="true" />{tt.paying}</> : ready ? <>{tt.pay}{amount && <> · <span dir="ltr">{amount}</span></>}</> : <><span className="pay-spin" aria-hidden="true" />{tt.loading}</>}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400"><Lock />{tt.secure}</p>
    </form>);
}
