"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "@/lib/motion";

/** Scroll-triggered GSAP effects for server-rendered children, driven by data attributes:
 *  [data-rise] staggered fade-up · [data-grow] bar grows along the inline axis · [data-growy] column grows up ·
 *  [data-draw] SVG path draws in · [data-count="N"] number counts up (keeps any suffix in [data-suffix]) · [data-ticker] endless vertical list.
 *  Final values are in the HTML, so reduced motion and no-JS show the finished state. */
export default function ScrollFx({ children, className = "", as: Tag = "div", id, ...rest }: { children: React.ReactNode; className?: string; as?: "div" | "section"; id?: string; "aria-labelledby"?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || reducedMotion()) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(el); const st = { trigger: el, start: "top 78%", once: true };
      const tl = gsap.timeline({ scrollTrigger: st, defaults: { ease: "expo.out" } });
      const rise = q("[data-rise]"); if (rise.length) tl.fromTo(rise, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 1, stagger: .08 }, 0);
      const grow = q("[data-grow]"); if (grow.length) tl.fromTo(grow, { scaleX: 0 }, { scaleX: 1, duration: 1.4, stagger: .06, ease: "power3.out" }, .3);
      const growy = q("[data-growy]"); if (growy.length) tl.fromTo(growy, { scaleY: 0 }, { scaleY: 1, duration: 1.1, stagger: .04, ease: "power3.out" }, .3);
      q("[data-draw]").forEach((p) => { const path = p as unknown as SVGPathElement; const len = path.getTotalLength(); tl.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 2, ease: "power2.inOut" }, .4); });
      q("[data-count]").forEach((n) => { const to = Number(n.getAttribute("data-count")); const o = { v: 0 }; const fmt = new Intl.NumberFormat("en-US");
        tl.fromTo(o, { v: 0 }, { v: to, duration: 1.8, ease: "power2.out", onUpdate: () => { n.textContent = fmt.format(Math.round(o.v)); } }, .3); });
      q("[data-ticker]").forEach((t) => { const h = (t as HTMLElement).scrollHeight / 2; gsap.to(t, { y: -h, duration: 22, ease: "none", repeat: -1 }); });
    }, el);
    return () => ctx.revert();
  }, []);
  return <Tag ref={ref as React.Ref<HTMLDivElement>} className={className} id={id} {...rest}>{children}</Tag>;
}
