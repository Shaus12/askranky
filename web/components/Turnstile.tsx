"use client";
import { useEffect, useRef, useState } from "react";
// Cloudflare Turnstile widget. Rendered only when the server reports a site key (TURNSTILE_SITE_KEY + secret set); otherwise a no-op.
// The widget injects a hidden "cf-turnstile-response" input into the surrounding form (read it via FormData).
// Bump `resetKey` after a failed submit to get a fresh challenge (tokens are single use).
let loader: Promise<void> | null = null;
const load = () => (loader ||= new Promise<void>((res, rej) => {
  if ((window as any).turnstile) return res();
  const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true;
  s.onload = () => res(); s.onerror = () => { loader = null; rej(new Error("turnstile script failed")); }; document.head.appendChild(s);
}));
export default function Turnstile({ siteKey, lang, resetKey = 0 }: { siteKey: string | null; lang: string; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null); const id = useRef<string | null>(null); const [failed, setFailed] = useState(false);
  // audit1: if the script is blocked (in-app browsers, privacy blockers) or the widget errors, say so instead of a silent dead form.
  const fail = () => setFailed(true);
  useEffect(() => {
    if (!siteKey || !ref.current) return; let dead = false; const el = ref.current;
    const t = window.setTimeout(() => { if (!dead && !(window as any).turnstile) fail(); }, 12000);
    load().then(() => { if (!dead && !id.current) { setFailed(false); id.current = (window as any).turnstile?.render(el, { sitekey: siteKey, language: lang, theme: "dark", "error-callback": () => { fail(); return true; }, "unsupported-callback": fail, callback: () => setFailed(false) }) ?? null; } }).catch(() => { if (!dead) fail(); });
    return () => { dead = true; window.clearTimeout(t); if (id.current) { try { (window as any).turnstile?.remove(id.current); } catch {} id.current = null; } };
  }, [siteKey, lang]);
  useEffect(() => { if (resetKey && id.current) { try { (window as any).turnstile?.reset(id.current); } catch {} } }, [resetKey]);
  if (!siteKey) return null;
  return (<>
    <div ref={ref} className="min-h-[65px]" data-testid="turnstile" dir="ltr" />
    {failed && <p role="alert" data-turnstile-failed className="rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{lang === "he"
      ? "בדיקת האבטחה לא נטענה. אם פתחתם מתוך פייסבוק/אינסטגרם, פתחו את הדף בדפדפן (⋮ ← פתח בדפדפן) או כבו חוסם פרסומות, ורעננו."
      : "The security check didn't load. If you opened this from Facebook/Instagram, open the page in your browser (⋮ → Open in browser) or turn off your ad blocker, then refresh."}</p>}
  </>);
}
