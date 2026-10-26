"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "@/lib/motion";

// Score over time. With `dates` (ISO, one per value) the x labels are real scan dates; points use the red / amber / green score scale.
// One point only: shows the point plus `emptyNote` (e.g. "next scan on …") instead of pretending there is a trend.
const scale = (v: number) => (v >= 70 ? "#22c55e" : v >= 40 ? "#f59e0b" : "#ef4444");
const short = (iso: string, lang?: string) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" }); };
export default function TrendChart({ values, weekLabel, dates, lang, emptyNote }: { values: number[]; weekLabel: string; dates?: string[]; lang?: string; emptyNote?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const W = 320, H = 160, P = 24;
  const pts = values.map((v, i) => [P + (values.length > 1 ? (i * (W - 2 * P)) / (values.length - 1) : (W - 2 * P) / 2), H - P - (v / 100) * (H - 2 * P)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  useEffect(() => {
    if (reducedMotion() || !ref.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const path = ref.current.querySelector("path[data-line]") as SVGPathElement;
    const len = path.getTotalLength();
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: ref.current, start: "top 85%", once: true } });
      tl.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut" })
        .from("circle", { scale: 0, transformOrigin: "center", stagger: 0.1, duration: 0.3 }, "-=1")
        .from("path[data-area]", { opacity: 0, duration: 0.8 }, "-=0.6");
    }, ref);
    return () => ctx.revert();
  }, []);
  return (<>
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ direction: "ltr" }} role="img" aria-label={values.map((v, i) => (dates?.[i] ? `${short(dates[i], lang)}: ${v}` : String(v))).join(", ")}>
      <defs><linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".3" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
      {[25, 50, 75].map((g) => <line key={g} x1={P} x2={W - P} y1={H - P - (g / 100) * (H - 2 * P)} y2={H - P - (g / 100) * (H - 2 * P)} stroke="rgba(148,163,184,.15)" />)}
      <path data-area d={`${d} L${pts.at(-1)![0]} ${H - P} L${P} ${H - P} Z`} fill="url(#g-area)" />
      <path data-line d={d} fill="none" stroke="#3f6fd8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#0c0c0e" stroke={scale(values[i])} strokeWidth="2" />)}
      {pts.map((p, i) => <text key={`v${i}`} x={p[0]} y={p[1] - 9} fontSize="9" textAnchor="middle" fill="#cbd5e1">{values[i]}</text>)}
      {pts.map((p, i) => <text key={i} x={p[0]} y={H - 6} fontSize="9" textAnchor="middle" fill="#94a3b8">{dates?.[i] ? short(dates[i], lang) : `${weekLabel} ${i + 1}`}</text>)}
    </svg>
    {values.length < 2 && emptyNote && <p className="mt-2 text-sm text-slate-400" data-trend-empty>{emptyNote}</p>}
  </>);
}
