"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import { getConfig, type Config } from "@/lib/api";
import { demoNotices } from "@/lib/notices";
import { ISRAELI_CITIES } from "@/lib/cities";
import Turnstile, { type TsState } from "./Turnstile";
import { cityHint } from "@/lib/city-hint";
import { GATE } from "@/lib/gate";
import { track } from "@/lib/track";
import { TRADES } from "@/lib/trades";
import { turnstileSubmitAction } from "@/lib/turnstile-gate";

// gate1 + trade1: trade (from a list of ~20, or "other" with free text) + city, then the business name (needed to find it in the answers).
// Website, other names and an optional email live under "more options". The trade id goes to POST /api/scan as `trade`.
const extra = ["website", "email"] as const;
// Shown on the submit button while Turnstile is in progress. The server check is unchanged.
const TSB = {
  he: { waiting: "ממתין לבדיקת אבטחה…", blocked: "בדיקת האבטחה נכשלה, נסו שוב למעלה", wait: "בדיקת האבטחה עוד לא הושלמה. נשלח את הטופס ברגע שתהיה מוכנה.", failed: "בדיקת האבטחה לא נטענה. לחצו \"נסו שוב\" בהודעה שמעל הכפתור.", storage: "הדפדפן חסם שמירת הטופס. נסו שוב, או פתחו את הדף בדפדפן (⋮ ← פתח בדפדפן)." },
  en: { waiting: "Waiting for the security check…", blocked: "Security check failed, retry above", wait: "The security check isn't complete yet. We'll send the form as soon as it is ready.", failed: "The security check didn't load. Press \"Try again\" in the message above the button.", storage: "This browser blocked saving the form. Try again, or open the page in your browser (⋮ → Open in browser)." },
} as const;
export const PENDING = "ranky-pending-scan";
// Collects the business details, then hands off to /[lang]/scan which calls POST /api/scan while showing progress.
// `onStart`: used when the form already lives on /[lang]/scan (router.push to the same URL would do nothing); the parent runs the scan directly.
// `cta`: optional data-cta on the submit button (the hero's single primary action).
export default function ScanForm({ t, lang, onStart, cta }: { t: Dict; lang: Locale; onStart?: (p: Record<string, string>) => void; cta?: string }) {
  const h = t.hero; const router = useRouter();
  const a = t.accuracy; const [confirm, setConfirm] = useState<{ d: Record<string, string>; city: string } | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null); const [err, setErr] = useState(""); const [cfg, setCfg] = useState<Config | null>(null); const [more, setMore] = useState(false); const [trade, setTrade] = useState(""); const tc = GATE[lang].trade; const nt = demoNotices(cfg, t);
  const [ts, setTs] = useState<TsState>("off"); const [tsReset, setTsReset] = useState(0);
  const root = useRef<HTMLFormElement>(null); const viewed = useRef(false); const resume = useRef(false);
  useEffect(() => { getConfig().then((c) => { setSiteKey(c.turnstileSiteKey); setCfg(c); }); }, []);
  // Count a view only once the form is actually on screen. A mount-time event would fire for a form the visitor has not reached.
  useEffect(() => {
    const el = root.current;
    if (!el || viewed.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (viewed.current) return;
      if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.25)) {
        viewed.current = true; track("scan_form_viewed"); io.disconnect();
      }
    }, { threshold: [0, 0.25, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  function fields(form: HTMLFormElement) { const fd = new FormData(form); const d: Record<string, string> = {}; fd.forEach((v, k) => { d[k] = String(v).trim(); }); return d; }
  // Returns an error, or null after dropping the unused trade/category field. Mutates `d` the same way the submit always did.
  function problem(d: Record<string, string>) {
    if (d.name && !d.city) return a.cityRequired;
    if (!d.trade || (d.trade === "other" && !d.category)) return tc.required;
    if (d.trade === "other") delete d.trade; else delete d.category;
    if (!d.name || !d.city) return t.form.required;
    return null;
  }
  function go(d: Record<string, string>) {
    setConfirm(null);
    const pending = { ...d, lang, turnstileToken: d["cf-turnstile-response"] };
    if (onStart) return onStart(pending);
    try { sessionStorage.setItem(PENDING, JSON.stringify(pending)); }
    catch { return setErr(TSB[lang].storage); }
    router.push(`/${lang}/scan`);
  }
  function send(d: Record<string, string>) {
    // Gentle check: the name/website names a different city (e.g. "The Ritz-Carlton Herzliya" entered as Tel Aviv).
    const hint = cityHint({ name: d.name, website: d.website, city: d.city });
    if (hint) { setErr(""); track("city_confirm_shown"); return setConfirm({ d, city: hint[lang] }); }
    go(d);
  }
  // `problem` mutates trade/category, so call it once per read of the form.
  function afterReady(d: Record<string, string>) { const msg = problem(d); if (msg) return setErr(msg); send(d); }
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const d = fields(e.currentTarget); track("form_submit_attempted");
    const msg = problem(d); if (msg) return setErr(msg);
    const action = turnstileSubmitAction(siteKey, d["cf-turnstile-response"], ts);
    // Loading: do not reset the challenge. One early tap arms a single auto-send for when the token arrives.
    if (action === "wait") { track("turnstile_missing"); track("turnstile_blocked"); resume.current = true; return setErr(TSB[lang].wait); }
    if (action === "reset") { track("turnstile_missing"); track("turnstile_blocked"); resume.current = false; setTsReset((k) => k + 1); return setErr(ts === "failed" ? TSB[lang].failed : TSB[lang].wait); }
    resume.current = false;
    send(d);
  }
  return (
    <form ref={root} onSubmit={submit} className="card space-y-3 p-6 md:p-7" noValidate data-scan-form>
      <div className="grid gap-3 sm:grid-cols-2" data-trade-city>
        <label className="vx-label">{tc.label}<span className="text-sky-300" aria-hidden> *</span>
          <select name="trade" required value={trade} onChange={(e) => setTrade(e.target.value)} className="vx-input" data-trade>
            <option value="" disabled>{tc.placeholder}</option>
            {TRADES.map((x) => <option key={x.id} value={x.id}>{x[lang]}</option>)}
            <option value="other">{tc.other}</option>
          </select></label>
        {(["city"] as const).map((f) => (<label key={f} className="vx-label">{h.form[f]}<span className="text-sky-300" aria-hidden> *</span>
          <input name={f} type="text" placeholder={h.ph[f]} list="il-cities" autoComplete="off" required className="vx-input" onChange={() => setConfirm(null)} /></label>))}
      </div>
      {trade === "other" && <label className="vx-label">{tc.otherLabel}<span className="text-sky-300" aria-hidden> *</span>
        <input name="category" type="text" maxLength={80} placeholder={tc.otherPh} className="vx-input" data-trade-other /></label>}
      <label className="vx-label">{h.form.name}<span className="text-sky-300" aria-hidden> *</span>
        <input name="name" type="text" placeholder={h.ph.name} autoComplete="organization" required className="vx-input" /></label>
      <div data-more-options>
          <button type="button" aria-expanded={more} aria-controls="scan-more-options" data-more-toggle onClick={() => setMore((m) => !m)}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-slate-300 underline-offset-4 hover:underline">
            <span aria-hidden className={`inline-block transition-transform ${more ? "rotate-90" : "rtl:rotate-180"}`}>›</span>{a.moreOptions}</button>
          <div id="scan-more-options" hidden={!more} className="space-y-3">
            {extra.map((f) => (<label key={f} className="vx-label">{f === "email" ? GATE[lang].emailOptional : h.form[f]}
              <input name={f} type={f === "email" ? "email" : f === "website" ? "url" : "text"} placeholder={h.ph[f]} dir={f === "website" || f === "email" ? "ltr" : undefined}
                autoComplete={f === "email" ? "email" : undefined} className="vx-input" /></label>))}
            <label className="vx-label">{a.otherNames}
              <input name="otherNames" type="text" maxLength={300} placeholder={a.otherNamesPh} className="vx-input" data-other-names />
              <span className="mt-1 block text-xs font-normal text-slate-400">{a.otherNamesHint}</span></label>
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <input type="checkbox" name="marketingConsent" value="on" defaultChecked={false} className="mt-0.5 h-6 w-6 shrink-0 accent-blue-600" data-consent />
              <span>{t.form.consent}</span></label>
          </div></div>
      <p className="text-sm text-slate-300" data-gate-note>{GATE[lang].formNote}</p>
      <p className="-mt-1 text-xs text-slate-400" data-existing-note>{t.existing.formNote}</p>
      <datalist id="il-cities">{ISRAELI_CITIES.map((c) => <option key={c.slug} value={c[lang]} />)}</datalist>
      <p className="text-xs text-slate-400" data-privacy>{nt.privacy} <a className="vx-link underline" href={`/${lang}/legal/privacy`}>{t.form.privacyLink}</a>.</p>
      {nt.formNote && <p role="note" data-demo-note className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-200">{nt.formNote}</p>}
      <Turnstile siteKey={siteKey} lang={lang} resetKey={tsReset} onState={(s) => {
        setTs(s);
        if (s === "failed") { resume.current = false; return; }
        if (s !== "ready") return;
        setErr("");
        if (!resume.current || !root.current) return;
        resume.current = false;
        const d = fields(root.current);
        if (!d["cf-turnstile-response"]) return setErr(TSB[lang].wait);
        afterReady(d);
      }} />
      {confirm && <div role="alertdialog" aria-live="polite" data-city-confirm className="rounded-lg border border-sky-300/40 bg-sky-400/10 px-3 py-3 text-sm text-sky-100">
        <p>{a.cityConfirm.replaceAll("{city}", confirm.city)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn-cta !py-1.5 !px-3 text-sm" onClick={() => { const el = document.querySelector<HTMLInputElement>('input[name="city"]'); if (el) el.value = confirm.city; go({ ...confirm.d, city: confirm.city }); }}>{a.useCity.replaceAll("{city}", confirm.city)}</button>
          <button type="button" className="btn-outline !py-1.5 !px-3 text-sm" onClick={() => go(confirm.d)}>{a.keepCity.replaceAll("{entered}", confirm.d.city)}</button>
        </div></div>}
      {err && <p role="alert" className="rounded-lg bg-score-low/15 px-3 py-2 text-sm text-red-200">{err}</p>}
      <div className="scan-submit-bar" data-submit-bar><button className="btn-cta w-full" data-ts-submit={siteKey ? ts : "off"} {...(cta ? { "data-cta": cta } : {})} aria-disabled={siteKey && ts !== "ready" ? true : undefined}>{siteKey && ts === "loading" ? TSB[lang].waiting : siteKey && ts === "failed" ? TSB[lang].blocked : t.form.submit}</button></div>
    </form>
  );
}
