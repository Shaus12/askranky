"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import type { Home3 } from "@/lib/home-v3";
import type { Locale } from "@/lib/i18n";
import { reducedMotion } from "@/lib/motion";

const HREF: Record<string, string> = { vis: "/scan", comp: "/report", qs: "/report", src: "/scan", fix: "/scan", track: "#pricing" };

/** "Ranky does that job for you": WAI-ARIA tabs (arrow keys, Home/End). Each panel is copy + an example chat + an output card,
 *  animated in with GSAP on change. All tab panels are server-rendered (hidden ones carry `hidden`), so the copy is crawlable. */
export default function JobsTabs({ jobs, lang, ex }: { jobs: Home3["jobs"]; lang: Locale; ex: string }) {
  const [a, setA] = useState(0); const tabs = useRef<(HTMLButtonElement | null)[]>([]); const panels = useRef<HTMLDivElement>(null); const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reducedMotion() || !panels.current) return;
    const q = gsap.utils.selector(panels.current);
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "expo.out" } })
        .fromTo(q(`[data-jp='${a}'] [data-jc]`), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .8, stagger: .06 })
        .fromTo(q(`[data-jp='${a}'] [data-jb]`), { autoAlpha: 0, y: 10, scale: .98 }, { autoAlpha: 1, y: 0, scale: 1, duration: .6, stagger: .35 }, .1)
        .fromTo(q(`[data-jp='${a}'] [data-jr]`), { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: .5, stagger: .08 }, .7);
    }, panels);
    return () => ctx.revert();
  }, [a]);
  const key = (e: React.KeyboardEvent, k: number) => {
    const n = jobs.length; const rtl = document.documentElement.dir === "rtl"; let to = -1;
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) to = (k + 1) % n; else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) to = (k - 1 + n) % n; else if (e.key === "Home") to = 0; else if (e.key === "End") to = n - 1;
    if (to < 0) return; e.preventDefault(); setA(to); tabs.current[to]?.focus();
  };
  return (
    <div className="v3-jobs">
      <div role="tablist" aria-label="Ranky" className="v3-tabs">
        {jobs.map((j, k) => (
          <button key={j.id} ref={(el) => { tabs.current[k] = el; }} role="tab" id={`jt-${j.id}`} aria-controls={`jp-${j.id}`} aria-selected={k === a} tabIndex={k === a ? 0 : -1}
            className={k === a ? "v3-tab on" : "v3-tab"} onClick={() => setA(k)} onKeyDown={(e) => key(e, k)} data-job-tab={j.id}>{j.tab}</button>))}
      </div>
      <div ref={panels}>
        {jobs.map((j, k) => (
          <div key={j.id} role="tabpanel" id={`jp-${j.id}`} aria-labelledby={`jt-${j.id}`} hidden={k !== a} className="v3-jp" data-jp={k} tabIndex={0}>
            <div className="v3-jcopy">
              <h3 data-jc className="v3-h3">{j.title}</h3>
              <p data-jc className="v3-p">{j.body}</p>
              <Link data-jc href={`/${lang}${HREF[j.id]}`} className="v3-link">{j.next} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span></Link>
            </div>
            <div className="v3-jdemo" aria-label={ex}>
              <span className="v3-ex">{ex}</span>
              <div data-jb className="v3-jyou"><b>{lang === "he" ? "את/ה:" : "You:"}</b> {j.you}</div>
              <div data-jb className="v3-jr"><span className="v3-mark" aria-hidden="true">R</span><div><b>Ranky</b><p>{j.ranky}</p></div></div>
              <div data-jb className="v3-jout">
                <div className="v3-jh">{j.head}</div>
                <ul>{j.rows.map(([l, r]) => <li key={l} data-jr><span>{l}</span><b>{r}</b></li>)}</ul>
              </div>
            </div>
          </div>))}
      </div>
    </div>
  );
}
