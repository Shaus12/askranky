"use client";
import Link from "next/link";
import LangLink from "@/components/LangLink";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { Dict, Locale } from "@/lib/i18n";
import { reducedMotion } from "@/lib/motion";
import BlurText from "@/components/BlurText";
import Horizon from "@/components/Horizon";

/** Vexel-inspired hero, ported to GSAP. Staged entrance: masthead → line 1 → line 2 (masked rise) → subhead (BlurText) → actions → horizon. */
export default function Hero({ t, lang }: { t: Dict; lang: Locale }) {
  const ref = useRef<HTMLDivElement>(null); const h = t.hero; const base = `/${lang}`; const other = lang === "en" ? "he" : "en";
  useEffect(() => {
    if (reducedMotion() || !ref.current) return;
    const q = gsap.utils.selector(ref.current); const ease = "expo.out";
    const tl = gsap.timeline({ defaults: { ease } });
    tl.fromTo(q(".mast > *"), { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.1)
      .fromTo(q(".hair"), { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power3.inOut" }, 0.2)
      .fromTo(q(".mline > span"), { yPercent: 110 }, { yPercent: 0, duration: 1.3, stagger: 0.14 }, 0.35)
      .fromTo(q(".hact > *"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08 }, 1.05)
      .fromTo(q(".horizon-wrap"), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.8, ease: "power2.out" }, 0.6);
    return () => { tl.progress(1).kill(); };
  }, []);
  return (
    <div ref={ref} className="vx-hero relative overflow-hidden text-white">
      <header className="relative z-10 mx-auto flex flex-col items-center pt-[calc(var(--u)*28)]">
        <div className="mast flex w-full max-w-6xl items-center justify-between px-5">
          <Link href={`${base}/login`} className="vx-link text-sm opacity-75">{t.login.nav}</Link>
          <Link href={base} className="vx-link font-head text-[calc(var(--u)*22)] font-bold tracking-tight">{t.brand}</Link>
          <LangLink to={other} hrefTo={`/${other}`} className="vx-link text-sm opacity-75">{other === "he" ? "עברית" : "English"}</LangLink>
        </div>
        <span className="hair mt-[calc(var(--u)*16)] block h-px w-[min(88vw,calc(var(--u)*520))] bg-white/20" />
        <nav className="mast mt-[calc(var(--u)*14)] flex gap-[calc(var(--u)*32)] text-sm text-slate-300" aria-label="primary">
          <a className="vx-link" href="#how">{t.nav.how}</a><a className="vx-link" href="#sample">{t.nav.sample}</a><a className="vx-link" href="#pricing">{t.nav.pricing}</a>
        </nav>
      </header>
      <section className="relative z-10 mx-auto max-w-5xl px-5 pt-[calc(var(--u)*72)] text-center">
        <h1 className="vx-h1 font-head font-bold" aria-label={`${h.l1} ${h.l2}`}>
          <span className="mline" aria-hidden><span>{h.l1}</span></span>
          <span className="mline" aria-hidden><span className="vx-grad">{h.l2}</span></span>
        </h1>
        <p className="mx-auto mt-[calc(var(--u)*24)] max-w-[36rem] text-[clamp(1rem,calc(var(--u)*18),1.25rem)] leading-relaxed text-slate-300"><BlurText text={h.lede} delay={0.85} /></p>
        <div className="hact mt-[calc(var(--u)*36)] flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
          <Link href={`${base}/scan`} className="btn-cta !px-7 !py-4 text-base" data-cta="hero">{h.cta} <span aria-hidden className="rtl:rotate-180">→</span></Link>
          <a href="#scan-form" className="vx-link inline-flex items-center gap-2 text-sm font-medium text-slate-200">{h.discover} <span aria-hidden className="vx-arrow">↓</span></a>
        </div>
      </section>
      <div className="horizon-wrap pointer-events-none relative -mt-[calc(var(--u)*20)] h-[calc(var(--u)*340)] min-h-[220px] w-full"><Horizon /></div>
    </div>
  );
}
