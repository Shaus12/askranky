// Accessibility-widget settings. Stored in localStorage only; applied as classes on <html> (see components/site-chrome.css).
export const A11Y_KEY = "ranky_a11y_v1";
export const MOTION_OFF_EVENT = "ranky:nomotion";
export type A11yState = { t: number; hc: boolean; lc: boolean; gray: boolean; links: boolean; font: boolean; motion: boolean; cursor: boolean };
export const A11Y_DEFAULT: A11yState = { t: 0, hc: false, lc: false, gray: false, links: false, font: false, motion: false, cursor: false };
export const TEXT_MIN = -1, TEXT_MAX = 4;
export const A11Y_CLASSES = ["a11y-hc", "a11y-lc", "a11y-gray", "a11y-links", "a11y-font", "a11y-nomotion", "a11y-cursor", "a11y-tm1", "a11y-t1", "a11y-t2", "a11y-t3", "a11y-t4"];
export function sanitize(x: unknown): A11yState {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const t = Math.max(TEXT_MIN, Math.min(TEXT_MAX, Math.round(Number(o.t) || 0)));
  const b = (k: string) => o[k] === true;
  const hc = b("hc"), lc = !hc && b("lc");
  return { t, hc, lc, gray: b("gray"), links: b("links"), font: b("font"), motion: b("motion"), cursor: b("cursor") };
}
export function loadA11y(): A11yState { try { return sanitize(JSON.parse(localStorage.getItem(A11Y_KEY) || "null")); } catch { return { ...A11Y_DEFAULT }; } }
export function saveA11y(s: A11yState) {
  try { if (JSON.stringify(s) === JSON.stringify(A11Y_DEFAULT)) localStorage.removeItem(A11Y_KEY); else localStorage.setItem(A11Y_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}
export function classesFor(s: A11yState): string[] {
  const c: string[] = [];
  if (s.hc) c.push("a11y-hc"); if (s.lc) c.push("a11y-lc"); if (s.gray) c.push("a11y-gray"); if (s.links) c.push("a11y-links");
  if (s.font) c.push("a11y-font"); if (s.motion) c.push("a11y-nomotion"); if (s.cursor) c.push("a11y-cursor");
  if (s.t) c.push(s.t < 0 ? "a11y-tm1" : `a11y-t${s.t}`);
  return c;
}
export function applyA11y(s: A11yState, root: HTMLElement = document.documentElement) { root.classList.remove(...A11Y_CLASSES); root.classList.add(...classesFor(s)); }
/** Really stops JS-driven motion (GSAP timelines / ScrollTriggers) and tells Lenis + the canvas to stand down. CSS animations are stopped by the class. */
export async function stopJsMotion() {
  try {
    const { default: gsap } = await import("gsap"); const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    gsap.globalTimeline.getChildren(true, true, true).forEach((t) => { try { (t as any).scrollTrigger?.kill?.(); t.progress(1); } catch { /* ignore */ } });
    ScrollTrigger.getAll().forEach((s) => s.kill());
  } catch { /* gsap not loaded: nothing to stop */ }
  window.dispatchEvent(new Event(MOTION_OFF_EVENT));
}
