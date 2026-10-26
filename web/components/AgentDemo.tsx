"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { Home3 } from "@/lib/home-v3";
import { reducedMotion } from "@/lib/motion";

/** Hero product demo (Profound-style "agent at work"): a fictional business, three Recents projects, each played as a GSAP timeline
 *  (prompt → working timer → steps ticking → result card). Auto-cycles while visible; a click on a Recent picks it and stops the cycle.
 *  Server HTML holds the first project's final state, so no-JS and reduced-motion visitors see a complete, readable frame. */
export default function AgentDemo({ d }: { d: Home3["demo"] }) {
  const [i, setI] = useState(0); const [auto, setAuto] = useState(true); const [secs, setSecs] = useState(0); const [done, setDone] = useState(true);
  const root = useRef<HTMLDivElement>(null); const p = d.projects[i];

  useEffect(() => {
    const el = root.current; if (!el) return;
    if (reducedMotion()) { setDone(true); return; }
    setDone(false); setSecs(0);
    const q = gsap.utils.selector(el); const timer = { s: 0 };
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.set(q("[data-a]"), { autoAlpha: 0, y: 12 })
      .set(q("[data-tick]"), { scale: 0, autoAlpha: 0 })
      .set(q("[data-step]"), { autoAlpha: 0, x: 0, y: 8 })
      .to(q("[data-a='bub']"), { autoAlpha: 1, y: 0, duration: .7 }, .1)
      .to(q("[data-a='stat']"), { autoAlpha: 1, y: 0, duration: .6 }, .5)
      .to(timer, { s: p.steps.length * 0.9 + 0.6, duration: p.steps.length * 0.9 + 0.6, ease: "none", onUpdate: () => setSecs(Math.floor(timer.s)) }, .5);
    p.steps.forEach((_, k) => {
      tl.to(q(`[data-step='${k}']`), { autoAlpha: 1, y: 0, duration: .5 }, .7 + k * .9)
        .to(q(`[data-tick='${k}']`), { autoAlpha: 1, scale: 1, duration: .35, ease: "back.out(3)" }, 1.4 + k * .9);
    });
    const end = 1.2 + p.steps.length * .9;
    tl.call(() => setDone(true), [], end)
      .to(q("[data-a='res']"), { autoAlpha: 1, y: 0, duration: .8 }, end)
      .fromTo(q("[data-line]"), { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: .5, stagger: .14 }, end + .2)
      .to(q("[data-a='foot']"), { autoAlpha: 1, y: 0, duration: .6 }, end + .7);

    let next: ReturnType<typeof setTimeout> | undefined;
    if (auto) tl.call(() => { next = setTimeout(() => setI((n) => (n + 1) % d.projects.length), 3800); }, [], end + 1);
    // pause while off-screen (saves CPU; resumes where it left off)
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) tl.resume(); else tl.pause(); });
    io.observe(el);
    return () => { tl.kill(); io.disconnect(); if (next) clearTimeout(next); };
  }, [i, auto, p.steps.length, d.projects.length]);

  const pick = (k: number) => { setAuto(false); setI(k); };
  return (
    <figure className="v3-win" aria-labelledby="v3-demo-cap">
      <div className="v3-tb"><span className="v3-dots" aria-hidden="true"><i /><i /><i /></span><span className="v3-illus">{d.illus}</span></div>
      <div className="v3-app" ref={root}>
        <aside className="v3-side">
          <div className="v3-ws"><span className="v3-av" aria-hidden="true">S</span>{d.biz}</div>
          <div className="v3-seg" aria-hidden="true"><span className="on">{d.seg[0]}</span><span>{d.seg[1]}</span></div>
          <div aria-hidden="true">{d.nav.map((n, k) => <span key={n} className={k === 0 ? "v3-si on" : "v3-si"}>{n}</span>)}</div>
          <div className="v3-lbl" id="v3-recents">{d.recents}</div>
          <div role="group" aria-labelledby="v3-recents" className="v3-recents">
            {d.projects.map((pr, k) => (
              <button key={pr.id} type="button" onClick={() => pick(k)} aria-pressed={k === i} className={k === i ? "v3-rec on" : "v3-rec"} data-demo-project={pr.id}>
                {pr.label}{k === i && auto && <span className="v3-prog" aria-hidden="true" key={`${i}-p`} />}
              </button>))}
          </div>
        </aside>
        <div className="v3-main" aria-live="off">
          <div className="v3-mh"><b>{p.label}</b><span className="v3-x" aria-hidden="true">ChatGPT · Gemini</span></div>
          <div className="v3-chat" key={p.id}>
            <div className="v3-bub" data-a="bub">{p.prompt}</div>
            <div className="v3-stat" data-a="stat">
              <span className={done ? "v3-spin ok" : "v3-spin"} aria-hidden="true" />
              <span>{done ? d.done : d.working} <span dir="ltr">{done ? `${Math.max(secs, p.steps.length)}s` : `${secs}s`}</span></span>
            </div>
            <ol className="v3-steps">
              {p.steps.map((s, k) => (
                <li key={k} data-step={k}><span className="v3-tick" data-tick={k} aria-hidden="true">✓</span>{s}</li>))}
            </ol>
            <div className="v3-res" data-a="res">
              <div className="v3-rt">{p.title}</div>
              <ul>{p.lines.map(([a, b]) => <li key={a} data-line><b>{a}</b><span>{b}</span></li>)}</ul>
            </div>
            <p className="v3-foot" data-a="foot">{p.foot}</p>
          </div>
          <div className="v3-inp" aria-hidden="true"><span>{d.ask}</span><span className="v3-send">↑</span></div>
        </div>
      </div>
      <figcaption id="v3-demo-cap" className="v3-cap">{d.hint}</figcaption>
    </figure>
  );
}
