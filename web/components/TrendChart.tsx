"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "@/lib/motion";

export default function TrendChart({ values, weekLabel }: { values: number[]; weekLabel: string }) {
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
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ direction: "ltr" }} role="img" aria-label={values.join(", ")}>
      <defs><linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5cf6" stopOpacity=".3" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient></defs>
      {[25, 50, 75].map((g) => <line key={g} x1={P} x2={W - P} y1={H - P - (g / 100) * (H - 2 * P)} y2={H - P - (g / 100) * (H - 2 * P)} stroke="#e6e6f2" />)}
      <path data-area d={`${d} L${pts.at(-1)![0]} ${H - P} L${P} ${H - P} Z`} fill="url(#g-area)" />
      <path data-line d={d} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#fff" stroke="#6366f1" strokeWidth="2" />)}
      {pts.map((p, i) => <text key={i} x={p[0]} y={H - 6} fontSize="9" textAnchor="middle" fill="#94a3b8">{weekLabel} {i + 1}</text>)}
    </svg>
  );
}
