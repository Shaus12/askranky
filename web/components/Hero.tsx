"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { Dict, Locale } from "@/lib/i18n";
import { reducedMotion } from "@/lib/motion";
import BlurText from "@/components/BlurText";
import Horizon from "@/components/Horizon";

/** Vexel-inspired hero, ported to GSAP. Staged entrance: masthead → line 1 → line 2 (masked rise) → subhead (BlurText) → actions → horizon. */
export default function Hero({ t, lang }: { t: Dict; lang: Locale }) {
  const ref = useRef<HTMLDivElement>(null); const h = t.hero; const base = `/${lang}`;
  useEffect(() => {
    if (reducedMotion() || !ref.current) return;
    const q = gsap.utils.selector(ref.current); const ease = "expo.out";
    const tl = gsap.timeline({ defaults: { ease } });
    tl.fromTo(q(".mline > span"), { yPercent: 110 }, { yPercent: 0, duration: 1.3, stagger: 0.14 }, 0.35)
      .fromTo(q(".hact > *"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08 }, 1.05)
      .fromTo(q(".horizon-wrap"), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.8, ease: "power2.out" }, 0.6);
    return () => { tl.progress(1).kill(); };
  }, []);
  return (
    <div ref={ref} className="vx-hero relative overflow-hidden text-white">
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
