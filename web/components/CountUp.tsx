"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "@/lib/motion";

export default function CountUp({ to, decimals = 0, suffix = "", duration = 1.6 }: { to: number; decimals?: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    if (reducedMotion() || !ref.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const o = { n: 0 }; setV(0);
    const tw = gsap.to(o, { n: to, duration, ease: "power2.out", onUpdate: () => setV(o.n),
      scrollTrigger: { trigger: ref.current, start: "top 90%", once: true } });
    return () => { tw.kill(); };
  }, [to, duration]);
  return <span ref={ref} className="tabular-nums">{v.toFixed(decimals)}{suffix}</span>;
}
