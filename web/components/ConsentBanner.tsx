"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { consentText } from "@/lib/i18n-consent";
import { CONSENT_OPEN_EVENT, consentFresh, readConsent, writeConsent, type ConsentRecord } from "@/lib/consent";
import type { Locale } from "@/lib/i18n";

// Non-blocking cookie / local-storage notice. The site uses ONLY strictly necessary and functional storage (no analytics, no advertising),
// so this is an information notice with "OK", a link to the cookie policy, and a footer link ("Cookie settings") that reopens it.
// The record (ranky_consent_v1 + timestamp) lives in localStorage only. No inline styles and no inline scripts (CSP-safe).
export default function ConsentBanner({ lang }: { lang: Locale }) {
  const t = consentText[lang]; const [open, setOpen] = useState(false); const [detail, setDetail] = useState(false); const [rec, setRec] = useState<ConsentRecord | null>(null);
  const [gpc, setGpc] = useState(false); const ref = useRef<HTMLElement>(null); const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const r = readConsent(); setRec(r); setOpen(!consentFresh(r)); setGpc(!!(navigator as any).globalPrivacyControl);
    const reopen = () => { setRec(readConsent()); setDetail(true); setOpen(true); setTimeout(() => titleRef.current?.focus(), 0); };
    window.addEventListener(CONSENT_OPEN_EVENT, reopen); return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);
  // Tell the rest of the page how tall the notice is, so the accessibility button can sit above it on small screens.
  useEffect(() => {
    const root = document.documentElement; const el = ref.current;
    if (!open || !el) { root.style.removeProperty("--rc-h"); return; }
    const set = () => root.style.setProperty("--rc-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    set(); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null; ro?.observe(el);
    return () => { ro?.disconnect(); root.style.removeProperty("--rc-h"); };
  }, [open, detail]);
  const accept = useCallback(() => { setRec(writeConsent()); setOpen(false); setDetail(false); }, []);
  if (!open) return null;
  const date = rec ? new Date(rec.at).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB") : null;
  return (
    <section ref={ref} role="region" aria-labelledby="rc-title" lang={lang} dir={lang === "he" ? "rtl" : "ltr"} className="rc-banner" data-testid="consent-banner"
      onKeyDown={(e) => { if (e.key === "Escape" && detail && rec) accept(); }}>
      <h2 id="rc-title" ref={titleRef} tabIndex={-1} className="rc-title">{t.title}</h2>
      <p className="rc-text">{t.body}</p>
      {detail && (<div className="rc-detail" data-testid="consent-detail"><h3 className="rc-sub">{t.detailsTitle}</h3>
        <ul><li>{t.essential}</li><li>{t.functional}</li><li>{t.none}</li><li>{gpc ? t.gpc : t.gpcNo}</li></ul>
        {date && <p className="rc-meta">{t.saved} {date}</p>}</div>)}
      <div className="rc-actions">
        <button type="button" className="rc-btn rc-primary" onClick={accept} data-testid="consent-ok">{detail && rec ? t.close : t.ok}</button>
        <a className="rc-link" href={`/${lang}/legal/cookies`}>{t.policy}</a>
        {!detail && <button type="button" className="rc-link rc-linkbtn" aria-expanded={detail} onClick={() => setDetail(true)}>{t.detailsTitle}</button>}
      </div>
    </section>
  );
}
