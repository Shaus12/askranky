// True when the animations should not run: the visitor's "Stop animations" setting (class on <html>, set by the accessibility widget) or the system setting.
export const motionStopped = () => typeof document !== "undefined" && document.documentElement.classList.contains("a11y-nomotion");
export const reducedMotion = () => typeof window !== "undefined" && (motionStopped() || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
