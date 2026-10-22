"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { reducedMotion } from "@/lib/motion";

/** React Bits–style "BlurText": words blur/slide in one by one. Local implementation. */
export default function BlurText({ text, className = "", wordClassName = "", delay = 0 }: { text: string; className?: string; wordClassName?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reducedMotion() || !ref.current) return;
    const words = ref.current.querySelectorAll("span[data-w]");
    const tw = gsap.fromTo(words, { opacity: 0, y: 24, filter: "blur(10px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out", stagger: 0.07, delay });
    return () => { tw.kill(); };
  }, [delay]);
  return (
    <span ref={ref} className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} data-w aria-hidden className={`inline-block whitespace-pre ${wordClassName}`}>{w + " "}</span>
      ))}
    </span>
  );
}
