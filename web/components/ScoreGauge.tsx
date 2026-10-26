"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { reducedMotion } from "@/lib/motion";
import { bandColor } from "@/lib/mock";

/** Semi-circle gauge with softened red→neutral→blue track; needle arc + number count up together. */
export default function ScoreGauge({ score, label, size = 280 }: { score: number; label: string; size?: number }) {
  const arcRef = useRef<SVGPathElement>(null);
  const [n, setN] = useState(score);
  const R = 100, C = Math.PI * R;
  useEffect(() => {
    const arc = arcRef.current!;
    if (reducedMotion()) { arc.style.strokeDashoffset = String(C * (1 - score / 100)); return; }
    const o = { v: 0 }; setN(0);
    const tw = gsap.to(o, { v: score, duration: 2, ease: "power3.out", delay: 0.3,
      onUpdate: () => { setN(Math.round(o.v)); arc.style.strokeDashoffset = String(C * (1 - o.v / 100)); } });
    return () => { tw.kill(); };
  }, [score, C]);
  return (
    <div className="relative mx-auto" style={{ width: size, maxWidth: "100%" }} role="img" aria-label={`${label}: ${score}/100`}>
      <svg viewBox="0 0 240 140" className="w-full" style={{ direction: "ltr" }}>
        <defs>
          <linearGradient id="g-track" x1="0" x2="1"><stop offset="0" stopColor="#e97a6f" /><stop offset=".5" stopColor="#d4d4d8" /><stop offset="1" stopColor="#60a5fa" /></linearGradient>
        </defs>
        <path d="M20 120 A100 100 0 0 1 220 120" fill="none" stroke="url(#g-track)" strokeOpacity=".18" strokeWidth="18" strokeLinecap="round" />
        <path ref={arcRef} d="M20 120 A100 100 0 0 1 220 120" fill="none" stroke="url(#g-track)" strokeWidth="18" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C} />
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <div className="text-6xl font-bold font-head tabular-nums" style={{ color: bandColor(score) }}>{n}<span className="text-xl text-slate-400">/100</span></div>
        <div className="text-sm text-slate-400">{label}</div>
      </div>
    </div>
  );
}
