"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "@/lib/motion";
import { bandColor } from "@/lib/mock";

export default function Bars({ data }: { data: { label: string; value: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reducedMotion() || !ref.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.from("[data-bar]", { scaleX: 0, duration: 1.2, ease: "power3.out", stagger: 0.15,
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true } });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} className="space-y-4">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{d.label}</span><span className="tabular-nums text-slate-500">{Math.round(d.value * 100)}%</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-brand-50">
            <div data-bar className="h-full origin-left rounded-full rtl:origin-right" style={{ width: `${Math.max(d.value * 100, 4)}%`, background: `linear-gradient(90deg, #6366f1, ${bandColor(d.value * 100)})` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
