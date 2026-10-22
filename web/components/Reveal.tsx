"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "@/lib/motion";

/** Fades/slides children marked [data-reveal] into view with ScrollTrigger, staggered. */
export default function Reveal({ children, className = "", as: Tag = "div", id }: { children: React.ReactNode; className?: string; as?: "div" | "section"; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reducedMotion() || !ref.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const items = ref.current!.querySelectorAll("[data-reveal]");
      gsap.fromTo(items, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", stagger: 0.12,
        scrollTrigger: { trigger: ref.current, start: "top 82%", once: true } });
    }, ref);
    return () => ctx.revert();
  }, []);
  return <Tag ref={ref as React.Ref<HTMLDivElement>} className={className} id={id}>{children}</Tag>;
}
