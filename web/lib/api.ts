import type { Locale } from "./i18n";
import { mockReport } from "./mock";
export type ReportData = ReturnType<typeof mockReport> & { mock?: boolean; live?: boolean; id?: string; date?: string };
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const r = await fetch(path, { method: opts.method || (opts.body ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `Request failed (${r.status})`), { status: r.status });
  return j as T;
}
export type Config = { turnstileSiteKey: string | null; mock: boolean; prelaunch?: boolean; brand: { name: string; domain: string } };
let cfg: Promise<Config> | null = null;
export const getConfig = () => (cfg ||= api<Config>("/api/config").catch(() => ({ turnstileSiteKey: null, mock: true, prelaunch: true, brand: { name: "Ranky", domain: "askranky.com" } })));
const LABEL: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity" };
// Map the Express /api/report/:id payload onto the shape ReportBody renders.
export function toReport(j: any): ReportData {
  const s = j.scan.summary;
  return {
    id: j.scan.id, mock: !!(j.scan.mock || j.demo), live: true, date: String(j.scan.at).slice(0, 10),
    business: { name: j.business.name, category: j.business.category, city: j.business.city },
    score: s.score, mentionRate: s.mentionRate, avgRank: s.avgRank || 0, checks: s.checks,
    byEngine: Object.entries(s.byEngine as Record<string, { checks: number; mentions: number }>).map(([e, v]) => ({ engine: LABEL[e] || e, rate: v.checks ? v.mentions / v.checks : 0 })),
    trend: j.history?.length ? j.history : [j.previousScore, s.score].filter((x: number | null) => x != null),
    competitors: s.topCompetitors, sources: s.topCitedHosts.map((h: any) => ({ host: h.host, count: h.count, own: !!h.isOwnSite })),
    fixes: j.scan.fixes,
  };
}
// Path segment after a marker, e.g. idFromPath("r") on /he/r/abc -> "abc".
export const idFromPath = (marker: string) => { const p = window.location.pathname.split("/").filter(Boolean); const i = p.indexOf(marker); return i >= 0 ? decodeURIComponent(p[i + 1] || "") : ""; };
export const sample = (l: Locale): ReportData => ({ ...mockReport(l), mock: true, live: false });
