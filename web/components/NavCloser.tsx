"use client";
import { useEffect } from "react";
/** Closes the header's <details> menus on outside click, Escape, or after a link inside is followed. The menus work without JS. */
export default function NavCloser() {
  useEffect(() => {
    const all = () => Array.from(document.querySelectorAll<HTMLDetailsElement>("details[data-rk-menu]"));
    const click = (e: MouseEvent) => { const el = e.target as Element; for (const d of all()) { if (!d.contains(el) || el.closest("a")) d.open = false; } };
    const key = (e: KeyboardEvent) => { if (e.key !== "Escape") return; for (const d of all()) if (d.open) { d.open = false; d.querySelector("summary")?.focus(); } };
    const toggle = (e: Event) => { const t = e.target as HTMLDetailsElement; if (t.open && !t.closest(".rk-mobile-panel")) for (const d of all()) if (d !== t && !d.contains(t)) d.open = false; };
    document.addEventListener("click", click); document.addEventListener("keydown", key); document.addEventListener("toggle", toggle, true);
    return () => { document.removeEventListener("click", click); document.removeEventListener("keydown", key); document.removeEventListener("toggle", toggle, true); };
  }, []);
  return null;
}
