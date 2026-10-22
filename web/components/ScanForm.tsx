"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import { getConfig } from "@/lib/api";
import { ISRAELI_CITIES } from "@/lib/cities";
import Turnstile from "./Turnstile";

const fields = ["name", "website", "category", "city", "email"] as const;
export const PENDING = "ranky-pending-scan";
// Collects the business details, then hands off to /[lang]/scan which calls POST /api/scan while showing progress.
export default function ScanForm({ t, lang }: { t: Dict; lang: Locale }) {
  const h = t.hero; const router = useRouter();
  const [siteKey, setSiteKey] = useState<string | null>(null); const [err, setErr] = useState("");
  useEffect(() => { getConfig().then((c) => setSiteKey(c.turnstileSiteKey)); }, []);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const d: Record<string, string> = {};
    fd.forEach((v, k) => { d[k] = String(v).trim(); });
    if (!d.name || !d.category || !d.city || !d.email) return setErr(t.form.required);
    if (siteKey && !d["cf-turnstile-response"]) return setErr(t.form.captcha);
    sessionStorage.setItem(PENDING, JSON.stringify({ ...d, lang, turnstileToken: d["cf-turnstile-response"] }));
    router.push(`/${lang}/scan`);
  }
  return (
    <form onSubmit={submit} className="card space-y-3 p-6 md:p-7" noValidate>
      {fields.map((f) => (
        <label key={f} className="vx-label">{h.form[f]}{f !== "website" && <span className="text-sky-300" aria-hidden> *</span>}
          <input name={f} type={f === "email" ? "email" : f === "website" ? "url" : "text"} placeholder={h.ph[f]} dir={f === "website" || f === "email" ? "ltr" : undefined}
            list={f === "city" ? "il-cities" : undefined} autoComplete={f === "email" ? "email" : f === "city" ? "off" : undefined} required={f !== "website"}
            className="vx-input" />
        </label>))}
      <datalist id="il-cities">{ISRAELI_CITIES.map((c) => <option key={c.slug} value={c[lang]} />)}</datalist>
      <Turnstile siteKey={siteKey} lang={lang} />
      {err && <p role="alert" className="rounded-lg bg-score-low/15 px-3 py-2 text-sm text-red-200">{err}</p>}
      <button className="btn-cta mt-2 w-full">{t.form.submit}</button>
    </form>
  );
}
