"use client";
import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "@/lib/motion";

export default function SmoothScroll() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (reducedMotion()) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0);
    let off = false; const stop = () => { off = true; lenis.destroy(); gsap.ticker.remove(tick); };
    window.addEventListener("ranky:nomotion", stop); // "Stop animations" in the accessibility widget
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href^='#']") as HTMLAnchorElement | null;
      if (a && !off) { e.preventDefault(); lenis.scrollTo(a.getAttribute("href")!, { offset: -72 }); }
    };
    document.addEventListener("click", onClick);
    return () => { window.removeEventListener("ranky:nomotion", stop); gsap.ticker.remove(tick); if (!off) lenis.destroy(); document.removeEventListener("click", onClick); };
  }, []);
  return null;
}
