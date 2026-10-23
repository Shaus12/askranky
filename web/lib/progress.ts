// Scan progress model. A real live scan takes ~1-2 minutes (15 live calls), so the bar must keep moving the whole time
// instead of stopping at a fixed step: it creeps asymptotically toward CAP and only reaches 100% when the server answered.
export const CAP = 95;            // creeping never exceeds this until the real report id arrives
export const TAU_MS = 30_000;     // time constant: ~63% after 30 s, ~86% after 60 s, ~93% after 90 s
export const SLOW_AFTER_MS = 60_000; // show the calm "a real scan takes a little longer" note after this long
export const creepPct = (elapsedMs: number): number => CAP * (1 - Math.exp(-Math.max(0, elapsedMs) / TAU_MS));
// Step index (0..n-1) matching the creeping percentage; the last step is only "done" when the report is ready.
export const stepForPct = (pct: number, n: number): number => Math.min(n - 1, Math.floor((pct / 100) * n));
export const isSlow = (elapsedMs: number): boolean => elapsedMs >= SLOW_AFTER_MS;
