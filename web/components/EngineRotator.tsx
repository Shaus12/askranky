"use client";
import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "@/lib/motion";

export type RotEngine = { name: string; soon?: boolean };
/** Rotates the engine names in the hero headline. Engines Ranky does not measure yet carry a visible "soon" tag while shown, so the
 *  headline never implies tracking that does not exist. The box width follows the current word (no gap before the full stop).
 *  Server HTML shows the first name; screen readers get the full list once (no live updates). Static under reduced motion. */
export default function EngineRotator({ names, soon }: { names: readonly RotEngine[]; soon: string }) {
  const [i, setI] = useState(0); const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const id = setInterval(() => setI((n) => (n + 1) % names.length), 2600);
    return () => clearInterval(id);
  }, [names.length]);
  useEffect(() => {
    const el = box.current; const cur = el?.querySelectorAll<HTMLElement>("[data-rot]")[i]; if (!el || !cur) return;
    el.style.width = `${cur.offsetWidth}px`;
  }, [i]);
  return (
    <span className="hm-rot" dir="ltr" ref={box} data-engine-rotator>
      <span className="sr-only">{names.map((n) => (n.soon ? `${n.name} (${soon})` : n.name)).join(" / ")}</span>
      {names.map((n, k) => <span key={n.name} data-rot aria-hidden="true" className={k === i ? "on" : undefined}>{n.name}{n.soon && <sup className="hm-soon-tag">{soon}</sup>}</span>)}
    </span>
  );
}
