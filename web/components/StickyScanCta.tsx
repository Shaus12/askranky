"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

/** Floating "free scan" button on the home page: appears after the hero, sits on the inline-end side (the accessibility button is on the start side)
 *  and above the cookie notice (--rc-h). Hidden again while the scan form is on screen. */
export default function StickyScanCta({ lang, label }: { lang: Locale; label: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const forms = ["hero-scan", "scan-form"].map((i) => document.getElementById(i)).filter(Boolean) as HTMLElement[];
    const vis = new Map<Element, boolean>(); let formVisible = false;
    const io = forms.length ? new IntersectionObserver((es) => { es.forEach((e) => vis.set(e.target, e.isIntersecting)); formVisible = [...vis.values()].some(Boolean); update(); }) : null;
    forms.forEach((f) => io?.observe(f));
    function update() { setShow(window.scrollY > 600 && !formVisible); }
    update(); window.addEventListener("scroll", update, { passive: true });
    return () => { window.removeEventListener("scroll", update); io?.disconnect(); };
  }, []);
  return (
    <Link href={`/${lang}/scan`} data-cta="sticky" aria-hidden={!show} tabIndex={show ? 0 : -1}
      className={`btn-cta fixed z-[9990] !px-5 !py-3 text-sm transition-all duration-300 ${show ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-4"}`}
      style={{ insetInlineEnd: 12, bottom: "calc(12px + var(--rc-h, 0px))" }}>{label} <span aria-hidden className="rtl:rotate-180">→</span></Link>
  );
}
