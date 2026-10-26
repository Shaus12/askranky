import type { Dict, Locale } from "./i18n";
import { mockReport } from "./mock";
import { sampleFacts, sampleSentiment, type Facts, type Sentiment } from "./perception";
import type { Alert } from "@/components/AlertsCard";
export type ReportData = ReturnType<typeof mockReport> & { sentiment?: Sentiment | null; facts?: Facts | null; alerts?: Alert[] | null; mock?: boolean; live?: boolean; id?: string; trendDates?: string[]; date?: string; engines?: { ran: string[]; skipped: { engine: string; reason: string }[] } };
export type Me = { signedIn: boolean; google?: boolean; csrf?: string; account?: { id: string; email: string; plan: string; hasPassword: boolean; googleLinked: boolean } };
let me: Promise<Me> | null = null;
// Current session (cookie-based). Cached per page; refreshMe() after sign-in/out or a password change (the CSRF token rotates).
export const getMe = () => (me ||= fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" }).then((r) => r.json()).catch(() => ({ signedIn: false })));
export const refreshMe = () => { me = null; return getMe(); };
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const method = opts.method || (opts.body ? "POST" : "GET");
  // State-changing requests carry the session's CSRF token when signed in (the server also checks Origin).
  const csrf = method !== "GET" && !path.startsWith("/api/auth/me") ? (await getMe()).csrf : undefined;
  const r = await fetch(path, { method, credentials: "same-origin", headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || j.error || `Request failed (${r.status})`), { status: r.status, code: typeof j.error === "string" ? j.error : undefined, data: j });
  return j as T;
}
// Server CAPTCHA errors carry a stable code in `error`; show the localized string instead of the English message.
export const errMessage = (x: any, t: Dict): string => x?.code === "captcha_required" ? t.form.captcha : x?.code === "captcha_failed" ? t.form.captchaFailed : x?.code === "captcha_unavailable" ? t.form.captchaUnavailable : x?.code === "rate_limited" ? t.form.rateLimited.replace("{m}", String(Math.max(1, Math.ceil((Number(x?.data?.retryAfter) || 60) / 60)))) : x?.code === "free_limit_reached" ? t.form.freeLimit : x?.code === "scan_unavailable" ? t.scanErr.unavailable : x?.message || String(x);
export type Config = { turnstileSiteKey: string | null; googleAuth?: boolean; mock: boolean; prelaunch?: boolean; emailMock?: boolean; brand: { name: string; domain: string } };
let cfg: Promise<Config> | null = null;
export const getConfig = () => (cfg ||= api<Config>("/api/config").catch(() => ({ turnstileSiteKey: null, mock: true, prelaunch: true, emailMock: true, brand: { name: "Ranky", domain: "askranky.com" } })));
const LABEL: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity" };
// Map the Express /api/report/:id payload onto the shape ReportBody renders.
export function toReport(j: any): ReportData {
  const s = j.scan.summary;
  return {
    id: j.scan.id, mock: !!j.scan.mock, live: true, date: String(j.scan.at).slice(0, 10),
    business: { name: j.business.name, category: j.business.category, city: j.business.city },
    score: s.score, mentionRate: s.mentionRate, avgRank: s.avgRank || 0, checks: s.checks,
    byEngine: Object.entries(s.byEngine as Record<string, { checks: number; mentions: number }>).map(([e, v]) => ({ engine: LABEL[e] || e, rate: v.checks ? v.mentions / v.checks : 0 })),
    trend: j.history?.length ? j.history : [j.previousScore, s.score].filter((x: number | null) => x != null),
    trendDates: j.historyAt?.length === j.history?.length ? j.historyAt : undefined,
    competitors: s.topCompetitors, sources: s.topCitedHosts.map((h: any) => ({ host: h.host, count: h.count, own: !!h.isOwnSite })),
    fixes: j.scan.fixes, engines: s.engines, sentiment: s.sentiment || null, facts: s.facts || null, alerts: j.scan.alerts || null,
  };
}
// Path segment after a marker, e.g. idFromPath("r") on /he/r/abc -> "abc".
export const idFromPath = (marker: string) => { const p = window.location.pathname.split("/").filter(Boolean); const i = p.indexOf(marker); return i >= 0 ? decodeURIComponent(p[i + 1] || "") : ""; };
export const sample = (l: Locale): ReportData => ({ ...mockReport(l), sentiment: sampleSentiment(l), facts: sampleFacts(l), mock: true, live: false });
