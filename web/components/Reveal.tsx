"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "@/lib/motion";

/** Scroll reveals matching Hero v2: masked headline lines (.mline > span) rise in with expo.out, then [data-reveal] items fade/slide up, staggered. */
export default function Reveal({ children, className = "", as: Tag = "div", id }: { children: React.ReactNode; className?: string; as?: "div" | "section"; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reducedMotion() || !ref.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const root = ref.current!;
      const tl = gsap.timeline({ scrollTrigger: { trigger: root, start: "top 82%", once: true } });
      const lines = root.querySelectorAll(".mline > span"); const hairs = root.querySelectorAll("[data-hair]"); const items = root.querySelectorAll("[data-reveal]");
      if (hairs.length) tl.fromTo(hairs, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power3.inOut" }, 0);
      if (lines.length) tl.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 1.2, ease: "expo.out", stagger: 0.12 }, 0.05);
      if (items.length) tl.fromTo(items, { y: 32, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.09 }, lines.length ? 0.35 : 0);
    }, ref);
    return () => ctx.revert();
  }, []);
  return <Tag ref={ref as React.Ref<HTMLDivElement>} className={className} id={id}>{children}</Tag>;
}
