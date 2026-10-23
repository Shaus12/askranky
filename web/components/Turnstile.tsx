"use client";
import { useEffect, useRef } from "react";
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
  const ref = useRef<HTMLDivElement>(null); const id = useRef<string | null>(null);
  useEffect(() => {
    if (!siteKey || !ref.current) return; let dead = false; const el = ref.current;
    load().then(() => { if (!dead && !id.current) id.current = (window as any).turnstile?.render(el, { sitekey: siteKey, language: lang, theme: "dark" }) ?? null; }).catch(() => {});
    return () => { dead = true; if (id.current) { try { (window as any).turnstile?.remove(id.current); } catch {} id.current = null; } };
  }, [siteKey, lang]);
  useEffect(() => { if (resetKey && id.current) { try { (window as any).turnstile?.reset(id.current); } catch {} } }, [resetKey]);
  if (!siteKey) return null;
  return <div ref={ref} className="min-h-[65px]" data-testid="turnstile" dir="ltr" />;
}
