"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { a11yText } from "@/lib/i18n-a11y";
import { A11Y_DEFAULT, TEXT_MAX, TEXT_MIN, applyA11y, loadA11y, saveA11y, stopJsMotion, type A11yState } from "@/lib/a11y";
import type { Locale } from "@/lib/i18n";

// Floating accessibility menu. Settings -> classes on <html> (components/site-chrome.css), persisted in localStorage only.
// Keyboard: aria-expanded/aria-controls on the button, focus moves into the dialog, Tab is trapped inside, Escape closes and returns focus.
const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
export default function A11yWidget({ lang }: { lang: Locale }) {
  const t = a11yText[lang]; const [s, setS] = useState<A11yState>(A11Y_DEFAULT); const [open, setOpen] = useState(false); const [sysMotion, setSysMotion] = useState(false);
  const panel = useRef<HTMLDivElement>(null); const btn = useRef<HTMLButtonElement>(null); const pid = useId(); const loaded = useRef(false);
  useEffect(() => { // runs before the page's own effects (this component is first in <body>), so GSAP/Lenis see the class when they mount
    const st = loadA11y(); applyA11y(st); setS(st); loaded.current = true;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)"); setSysMotion(mq.matches); const f = () => setSysMotion(mq.matches); mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);
  const update = useCallback((patch: Partial<A11yState>) => {
    setS((prev) => { const n = { ...prev, ...patch }; if (patch.hc) n.lc = false; if (patch.lc) n.hc = false; applyA11y(n); saveA11y(n); if (patch.motion && !prev.motion) void stopJsMotion(); return n; });
  }, []);
  const close = useCallback((back = true) => { setOpen(false); if (back) btn.current?.focus(); }, []);
  useEffect(() => { if (open) panel.current?.querySelector<HTMLElement>("button")?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { const n = e.target as Node; if (!panel.current?.contains(n) && !btn.current?.contains(n)) close(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open, close]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return; // handled by the document listener (also covers focus that was lost)
    if (e.key !== "Tab" || !panel.current) return;
    const f = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const dir = lang === "he" ? "rtl" : "ltr";
  const Toggle = ({ k, label, extra }: { k: "hc" | "lc" | "gray" | "links" | "font" | "motion" | "cursor"; label: string; extra?: string }) => {
    const on = s[k] || (k === "motion" && sysMotion);
    return (<button type="button" className="ra-opt" aria-pressed={on} onClick={() => update({ [k]: !s[k] } as Partial<A11yState>)} data-testid={`a11y-${k}`}>
      <span className="ra-optlabel">{label}{extra ? <small>{extra}</small> : null}</span><span className="ra-state" aria-hidden="true">{on ? "✓ " + t.on : t.off}</span></button>);
  };
  return (
    <div className="ra-root" lang={lang} dir={dir} onKeyDown={onKey}>
      <button ref={btn} type="button" className="ra-btn" aria-label={t.open} aria-expanded={open} aria-controls={pid} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)} data-testid="a11y-button">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><circle cx="12" cy="4.2" r="2.2" fill="currentColor" /><path d="M4 8.2h16v2.2h-6.2v3.1l2.4 6.6-2.1.8-2.1-5.6-2.1 5.6-2.1-.8 2.4-6.6v-3.1H4z" fill="currentColor" /></svg>
      </button>
      {open && (
        <div ref={panel} id={pid} role="dialog" aria-modal="true" aria-labelledby={`${pid}-t`} className="ra-panel" data-testid="a11y-panel">
          <div className="ra-head"><h2 id={`${pid}-t`} className="ra-title">{t.title}</h2>
            <button type="button" className="ra-x" aria-label={t.close} onClick={() => close()}><span aria-hidden="true">×</span></button></div>
          <div className="ra-group" role="group" aria-label={t.textSize}>
            <span className="ra-glabel">{t.textSize}</span>
            <div className="ra-row">
              <button type="button" className="ra-opt ra-sq" aria-label={t.smaller} aria-disabled={s.t <= TEXT_MIN} onClick={() => { if (s.t > TEXT_MIN) update({ t: s.t - 1 }); }} data-testid="a11y-smaller"><span aria-hidden="true">A−</span></button>
              <button type="button" className="ra-opt ra-sq" aria-label={t.larger} aria-disabled={s.t >= TEXT_MAX} onClick={() => { if (s.t < TEXT_MAX) update({ t: s.t + 1 }); }} data-testid="a11y-larger"><span aria-hidden="true">A+</span></button>
              <button type="button" className="ra-opt ra-sq ra-wide" aria-disabled={s.t === 0} onClick={() => { if (s.t !== 0) update({ t: 0 }); }} data-testid="a11y-textreset">{t.reset}</button>
            </div>
            <span className="ra-meta" aria-live="polite">{t.level}: {s.t}</span>
          </div>
          <div className="ra-list">
            <Toggle k="hc" label={t.contrast} /><Toggle k="lc" label={t.light} /><Toggle k="gray" label={t.gray} /><Toggle k="links" label={t.links} />
            <Toggle k="font" label={t.font} /><Toggle k="motion" label={t.motion} extra={sysMotion && !s.motion ? t.motionSystem : undefined} /><Toggle k="cursor" label={t.cursor} />
          </div>
          <div className="ra-foot">
            <button type="button" className="ra-opt ra-reset" onClick={() => { update({ ...A11Y_DEFAULT }); }} data-testid="a11y-reset">{t.resetAll}</button>
            <a className="ra-link" href={`/${lang}/legal/accessibility`}>{t.statement}</a>
            <span className="ra-meta">{t.hint}</span>
          </div>
        </div>
      )}
    </div>
  );
}
