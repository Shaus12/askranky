"use client";
import { useEffect, useState } from "react";
import { reducedMotion } from "@/lib/motion";

/** Rotates the live engine names in the hero headline. Server HTML shows "ChatGPT"; screen readers get both names once (no live updates). Static under reduced motion. */
export default function EngineRotator({ names }: { names: readonly string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const id = setInterval(() => setI((n) => (n + 1) % names.length), 2600);
    return () => clearInterval(id);
  }, [names.length]);
  return (
    <span className="hm-rot" dir="ltr">
      <span className="sr-only">{names.join(" / ")}</span>
      {names.map((n, k) => <span key={n} aria-hidden="true" className={k === i ? "on" : undefined}>{n}</span>)}
    </span>
  );
}
