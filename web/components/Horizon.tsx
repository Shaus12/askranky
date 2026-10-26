"use client";
import { useEffect, useRef } from "react";
import { reducedMotion, motionStopped } from "@/lib/motion";

/** Ranky's own background: a glowing horizon arc with AI "answer" bubbles drifting up from map-like city lights. Canvas, ~60 particles, paused when hidden or under reduced motion. */
export default function Horizon() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return;
    let w = 0, h = 0, raf = 0, t = 0; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const lights = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28 }));
    const bubbles = Array.from({ length: 9 }, (_, i) => ({ x: 0.08 + i * 0.105 + Math.random() * 0.03, y: Math.random(), s: 0.6 + Math.random() * 0.6, v: 0.0006 + Math.random() * 0.0008, g: i % 3 === 0 }));
    const resize = () => { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const cy = h * 1.9, r = h * 1.55; // horizon arc
      const g = ctx.createRadialGradient(w / 2, cy, r * 0.9, w / 2, cy, r * 1.18);
      g.addColorStop(0, "rgba(37,99,235,0)"); g.addColorStop(0.7, "rgba(59,130,246,.45)"); g.addColorStop(0.78, "rgba(147,197,253,.9)"); g.addColorStop(0.8, "rgba(59,130,246,.25)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#050506"; ctx.beginPath(); ctx.arc(w / 2, cy, r, 0, Math.PI * 2); ctx.fill();
      for (const l of lights) { // city lights on the planet surface
        const x = l.x * w, y = cy - r + 12 + l.y * h * 0.5; const a = 0.25 + 0.35 * Math.sin(t * 0.03 + l.p);
        if ((x - w / 2) ** 2 + (y - cy) ** 2 > r * r) continue;
        ctx.fillStyle = `rgba(147,197,253,${a})`; ctx.fillRect(x, y, 2, 2);
      }
      for (const b of bubbles) { // answer bubbles
        const x = b.x * w, y = (cy - r) - b.y * h * 0.75; const a = Math.min(1, b.y * 4) * (1 - b.y);
        const bw = 46 * b.s, bh = 22 * b.s;
        ctx.globalAlpha = a; ctx.fillStyle = b.g ? "rgba(37,99,235,.28)" : "rgba(96,165,250,.18)"; ctx.strokeStyle = b.g ? "rgba(191,219,254,.7)" : "rgba(147,197,253,.6)";
        ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.7)"; for (let k = 0; k < 3; k++) ctx.fillRect(x + bh / 2 + k * 8 * b.s, y + bh / 2 - 1, 4 * b.s, 2);
        ctx.globalAlpha = 1; b.y += b.v; if (b.y > 1) b.y = 0;
      }
    };
    const loop = () => { t++; draw(); if (motionStopped()) return; raf = requestAnimationFrame(loop); };
    resize(); window.addEventListener("resize", resize);
    const still = reducedMotion();
    const io = new IntersectionObserver(([e]) => { cancelAnimationFrame(raf); if (e.isIntersecting && !still) loop(); else draw(); });
    io.observe(c); if (still) draw();
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} aria-hidden className="horizon" />;
}
