"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import { getConfig, type Config } from "@/lib/api";
import { demoNotices } from "@/lib/notices";
import { ISRAELI_CITIES } from "@/lib/cities";
import Turnstile from "./Turnstile";
import { cityHint } from "@/lib/city-hint";

const fields = ["name", "website", "category", "city", "email"] as const;
export const PENDING = "ranky-pending-scan";
// Collects the business details, then hands off to /[lang]/scan which calls POST /api/scan while showing progress.
// `onStart`: used when the form already lives on /[lang]/scan (router.push to the same URL would do nothing); the parent runs the scan directly.
export default function ScanForm({ t, lang, onStart }: { t: Dict; lang: Locale; onStart?: (p: Record<string, string>) => void }) {
  const h = t.hero; const router = useRouter();
  const a = t.accuracy; const [confirm, setConfirm] = useState<{ d: Record<string, string>; city: string } | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null); const [err, setErr] = useState(""); const [cfg, setCfg] = useState<Config | null>(null); const [more, setMore] = useState(false); const nt = demoNotices(cfg, t);
  useEffect(() => { getConfig().then((c) => { setSiteKey(c.turnstileSiteKey); setCfg(c); }); }, []);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const d: Record<string, string> = {};
    fd.forEach((v, k) => { d[k] = String(v).trim(); });
    if (d.name && d.category && d.email && !d.city) return setErr(a.cityRequired);
    if (!d.name || !d.category || !d.city || !d.email) return setErr(t.form.required);
    if (siteKey && !d["cf-turnstile-response"]) return setErr(t.form.captcha);
    // Gentle check: the name/website names a different city (e.g. "The Ritz-Carlton Herzliya" entered as Tel Aviv).
    const hint = cityHint({ name: d.name, website: d.website, city: d.city });
    if (hint) { setErr(""); return setConfirm({ d, city: hint[lang] }); }
    go(d);
  }
  function go(d: Record<string, string>) {
    setConfirm(null);
    const pending = { ...d, lang, turnstileToken: d["cf-turnstile-response"] };
    if (onStart) return onStart(pending);
    sessionStorage.setItem(PENDING, JSON.stringify(pending));
    router.push(`/${lang}/scan`);
  }
  return (
    <form onSubmit={submit} className="card space-y-3 p-6 md:p-7" noValidate>
      {fields.map((f) => (<div key={f} className="contents">
        <label className="vx-label">{f === "email" && nt.emailLabel ? nt.emailLabel : h.form[f]}{f !== "website" && <span className="text-sky-300" aria-hidden> *</span>}
          <input name={f} type={f === "email" ? "email" : f === "website" ? "url" : "text"} placeholder={h.ph[f]} dir={f === "website" || f === "email" ? "ltr" : undefined}
            list={f === "city" ? "il-cities" : undefined} autoComplete={f === "email" ? "email" : f === "city" ? "off" : undefined} required={f !== "website"}
            className="vx-input" onChange={f === "city" ? () => setConfirm(null) : undefined} />
        </label>
        {f === "name" && <div data-more-options>
          <button type="button" aria-expanded={more} aria-controls="scan-more-options" data-more-toggle onClick={() => setMore((m) => !m)}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-slate-300 underline-offset-4 hover:underline">
            <span aria-hidden className={`inline-block transition-transform ${more ? "rotate-90" : "rtl:rotate-180"}`}>›</span>{a.moreOptions}</button>
          <div id="scan-more-options" hidden={!more}>
            <label className="vx-label">{a.otherNames}
              <input name="otherNames" type="text" maxLength={300} placeholder={a.otherNamesPh} className="vx-input" data-other-names />
              <span className="mt-1 block text-xs font-normal text-slate-400">{a.otherNamesHint}</span></label>
          </div></div>}
      </div>))}
      <p className="-mt-1 text-xs text-slate-400" data-existing-note>{t.existing.formNote}</p>
      <datalist id="il-cities">{ISRAELI_CITIES.map((c) => <option key={c.slug} value={c[lang]} />)}</datalist>
      <label className="flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" name="marketingConsent" value="on" defaultChecked={false} className="mt-0.5 h-6 w-6 shrink-0 accent-blue-600" data-consent />
        <span>{t.form.consent}</span></label>
      <p className="text-xs text-slate-400" data-privacy>{nt.privacy} <a className="vx-link underline" href={`/${lang}/legal/privacy`}>{t.form.privacyLink}</a>.</p>
      {nt.formNote && <p role="note" data-demo-note className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-200">{nt.formNote}</p>}
      <Turnstile siteKey={siteKey} lang={lang} />
      {confirm && <div role="alertdialog" aria-live="polite" data-city-confirm className="rounded-lg border border-sky-300/40 bg-sky-400/10 px-3 py-3 text-sm text-sky-100">
        <p>{a.cityConfirm.replaceAll("{city}", confirm.city)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn-cta !py-1.5 !px-3 text-sm" onClick={() => { const el = document.querySelector<HTMLInputElement>('input[name="city"]'); if (el) el.value = confirm.city; go({ ...confirm.d, city: confirm.city }); }}>{a.useCity.replaceAll("{city}", confirm.city)}</button>
          <button type="button" className="btn-outline !py-1.5 !px-3 text-sm" onClick={() => go(confirm.d)}>{a.keepCity.replaceAll("{entered}", confirm.d.city)}</button>
        </div></div>}
      {err && <p role="alert" className="rounded-lg bg-score-low/15 px-3 py-2 text-sm text-red-200">{err}</p>}
      <div className="scan-submit-bar" data-submit-bar><button className="btn-cta w-full">{t.form.submit}</button></div>
    </form>
  );
}
