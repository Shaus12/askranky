// Marketing attribution without identifiers: utm_source and utm_campaign from the landing URL, kept in sessionStorage for the tab only
// (same sanitizing as the server, src/utm.js: max 64 chars of [A-Za-z0-9_.-], otherwise dropped) and sent with scan / waitlist / checkout requests.
const KEY = "ranky-utm";
const OK = /^[A-Za-z0-9_.-]{1,64}$/;
const clean = (v: string | null) => (v && OK.test(v) && !/^\d{12,}$/.test(v) ? v : undefined);
export type Utm = { utm_source?: string; utm_campaign?: string };
export function captureUtm(): void {
  try {
    const q = new URLSearchParams(window.location.search); const u: Utm = {};
    const s = clean(q.get("utm_source")), c = clean(q.get("utm_campaign")); if (s) u.utm_source = s; if (c) u.utm_campaign = c;
    if (u.utm_source || u.utm_campaign) sessionStorage.setItem(KEY, JSON.stringify(u));
  } catch { /* storage unavailable: no attribution */ }
}
export function getUtm(): Utm {
  try { const j = JSON.parse(sessionStorage.getItem(KEY) || "{}"); const u: Utm = {}; const s = clean(j.utm_source), c = clean(j.utm_campaign); if (s) u.utm_source = s; if (c) u.utm_campaign = c; return u; } catch { return {}; }
}
