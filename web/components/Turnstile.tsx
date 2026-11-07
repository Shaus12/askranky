"use client";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { CONTACT_EMAIL } from "@/lib/agencies";
import WhatsAppLink from "./WhatsAppLink";
// Cloudflare Turnstile widget. Rendered only when the server reports a site key (TURNSTILE_SITE_KEY + secret set); otherwise a no-op.
// The widget injects a hidden "cf-turnstile-response" input into the surrounding form (read it via FormData). Server-side verification
// is unchanged (src/security/turnstile.js). This component only reports client state:
// - expiry: the stale token is cleared and the widget is reset (an expired token is never submitted);
// - Cloudflare timeout: token cleared, widget reset, counted as turnstile_timeout;
// - load failure (script blocked, error-callback, unsupported, or no iframe within RENDER_TIMEOUT_MS): visible HE/EN alert + retry.
// RENDER_TIMEOUT_MS stays at 12s (the previous script-load budget). A 9s cutoff marks slow-but-working widgets as failed.
// A callback that arrives after the alert still sets state back to "ready".
// Bump `resetKey` after a submit with no token to get a fresh challenge (tokens are single use).
export type TsState = "off" | "loading" | "ready" | "failed";
export const RENDER_TIMEOUT_MS = 12000;
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loader: Promise<void> | null = null;
const load = () => (loader ||= new Promise<void>((res, rej) => {
  if ((window as any).turnstile) return res();
  document.querySelectorAll("script[data-ts-loader]").forEach((n) => n.remove());
  const s = document.createElement("script"); s.src = SRC; s.async = true; s.dataset.tsLoader = "1";
  s.onload = () => res(); s.onerror = () => { loader = null; rej(new Error("turnstile script failed")); }; document.head.appendChild(s);
}));
type Ev = "turnstile_error" | "turnstile_unsupported" | "turnstile_load_failed" | "turnstile_expired" | "turnstile_timeout";
const TXT = {
  he: { failed: "בדיקת האבטחה (Cloudflare) לא נטענה, ולכן אי אפשר לשלוח את הטופס כרגע.", hint: "נסו שוב. אם זה חוזר: כבו חוסם פרסומות, או אם פתחתם מתוך פייסבוק/אינסטגרם פתחו את הדף בדפדפן (⋮ ← פתח בדפדפן).", retry: "נסו שוב", contact: "או כתבו לנו:", wa: "וואטסאפ" },
  en: { failed: "The security check (Cloudflare) didn't load, so the form can't be sent right now.", hint: "Try again. If it keeps happening, turn off your ad blocker, or if you opened this from Facebook/Instagram, open the page in your browser (⋮ → Open in browser).", retry: "Try again", contact: "Or reach us:", wa: "WhatsApp" },
};
export default function Turnstile({ siteKey, lang, resetKey = 0, onState }: { siteKey: string | null; lang: string; resetKey?: number; onState?: (s: TsState) => void }) {
  const ref = useRef<HTMLDivElement>(null); const id = useRef<string | null>(null);
  const [state, setState0] = useState<TsState>(siteKey ? "loading" : "off"); const [attempt, setAttempt] = useState(0);
  const cb = useRef(onState); cb.current = onState;
  const stateRef = useRef(state); stateRef.current = state;
  const setState = (s: TsState) => { setState0(s); cb.current?.(s); };
  const sent = useRef<Record<string, boolean>>({});
  const once = (e: Ev) => { if (!sent.current[e]) { sent.current[e] = true; track(e); } };
  const clear = () => { ref.current?.querySelectorAll<HTMLInputElement>('input[name="cf-turnstile-response"]').forEach((i) => { i.value = ""; }); };
  function retry() {
    if (id.current) { try { (window as any).turnstile?.remove(id.current); } catch { /* widget already gone */ } id.current = null; }
    if (!(window as any).turnstile) loader = null;
    sent.current = {};
    setAttempt((a) => a + 1);
  }
  useEffect(() => {
    if (!siteKey) { setState("off"); return; }
    if (!ref.current) return;
    let dead = false; const el = ref.current; setState("loading");
    const fail = (e: Ev) => { if (dead) return; once(e); clear(); setState("failed"); };
    const t = window.setTimeout(() => {
      if (dead || el.querySelector("iframe")) return;
      fail((window as any).turnstile ? "turnstile_timeout" : "turnstile_load_failed");
    }, RENDER_TIMEOUT_MS);
    load().then(() => {
      if (dead || id.current) return;
      id.current = (window as any).turnstile?.render(el, {
        sitekey: siteKey, language: lang, theme: "dark", "refresh-expired": "auto", "refresh-timeout": "auto",
        "error-callback": () => { fail("turnstile_error"); return true; },
        "unsupported-callback": () => fail("turnstile_unsupported"),
        "expired-callback": () => { once("turnstile_expired"); clear(); if (!dead) setState("loading"); try { (window as any).turnstile?.reset(id.current); } catch { /* ignore */ } },
        "timeout-callback": () => { once("turnstile_timeout"); clear(); if (!dead) setState("loading"); try { (window as any).turnstile?.reset(id.current); } catch { /* ignore */ } },
        callback: () => { if (!dead) setState("ready"); },
      }) ?? null;
      if (!id.current) fail("turnstile_load_failed");
    }).catch(() => fail("turnstile_load_failed"));
    return () => { dead = true; window.clearTimeout(t); if (id.current) { try { (window as any).turnstile?.remove(id.current); } catch { /* ignore */ } id.current = null; } };
    // attempt is the retry signal; onState is read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, lang, attempt]);
  useEffect(() => {
    if (!resetKey) return;
    clear();
    if (stateRef.current === "failed") { retry(); return; }
    if (id.current) { try { (window as any).turnstile?.reset(id.current); } catch { /* ignore */ } }
    if (stateRef.current === "ready") setState("loading");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  if (!siteKey) return null;
  const x = TXT[lang === "he" ? "he" : "en"];
  return (<>
    <div ref={ref} className="min-h-[65px]" data-testid="turnstile" data-ts-state={state} dir="ltr" />
    {state === "failed" && <div role="alert" data-turnstile-failed className="space-y-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-3 text-sm text-amber-100">
      <p className="font-semibold">{x.failed}</p><p>{x.hint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-outline !py-1.5 !px-3 text-sm" data-turnstile-retry onClick={retry}>{x.retry}</button>
        <span className="text-xs">{x.contact} <a className="underline" href={`mailto:${CONTACT_EMAIL}`} dir="ltr">{CONTACT_EMAIL}</a></span>
        <WhatsAppLink label={x.wa} className="text-xs underline" />
      </div>
    </div>}
  </>);
}
