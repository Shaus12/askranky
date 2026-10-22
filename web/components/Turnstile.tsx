"use client";
import { useEffect, useRef } from "react";
// Cloudflare Turnstile widget. Rendered only when the server reports a site key (TURNSTILE_SITE_KEY + secret set).
// The widget injects a hidden "cf-turnstile-response" input into the surrounding form.
export default function Turnstile({ siteKey, lang }: { siteKey: string | null; lang: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const render = () => (window as any).turnstile?.render(ref.current, { sitekey: siteKey, language: lang, theme: "dark" });
    if ((window as any).turnstile) { render(); return; }
    const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; s.onload = render; document.head.appendChild(s);
  }, [siteKey, lang]);
  if (!siteKey) return null;
  return <div ref={ref} className="min-h-[65px]" data-testid="turnstile" />;
}
