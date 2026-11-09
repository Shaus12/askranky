// Marketing attribution without identifiers (utm1). FIRST touch of the browser tab: utm_source / utm_campaign / utm_medium from the
// landing URL, or, when the URL has no utm, the referring site's host name (no path, no query). The first page is also reduced to a
// landing bucket (he / en / blog / report / agencies / other) — never a full URL, query string, or report id. Kept in sessionStorage
// for the tab only (same sanitizing as the server, src/utm.js) and sent with scan / waitlist / checkout requests, plus ONE landing
// beacon per tab session (POST /api/v/land). Not a cookie, no id, nothing about the person.
import { pathBucket, BUCKETS } from "./path-bucket";
const KEY = "ranky-utm"; const SENT = "ranky-utm-sent";
const bucket = (v: unknown) => (typeof v === "string" && (BUCKETS as readonly string[]).includes(v) ? v : undefined);
const OK = /^[A-Za-z0-9_.-]{1,64}$/;
const HOST = /^(?=.{1,64}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const clean = (v: string | null | undefined) => (v && OK.test(v) && !/^\d{12,}$/.test(v) ? v : undefined);
const cleanRef = (v: string | null | undefined) => { const h = (v || "").toLowerCase().replace(/^(?:www|m|l|lm|mobile|out)\./, ""); return HOST.test(h) && !/^\d+(?:\.\d+)+$/.test(h) ? h : undefined; };
export type Utm = { utm_source?: string; utm_campaign?: string; utm_medium?: string; utm_ref?: string; path?: string };
export function readTouch(search: string, referrer: string, ownHost: string): Utm {
  const q = new URLSearchParams(search); const u: Utm = {};
  const s = clean(q.get("utm_source")), c = clean(q.get("utm_campaign")), m = clean(q.get("utm_medium"));
  if (s) u.utm_source = s; if (c) u.utm_campaign = c; if (m && (s || c)) u.utm_medium = m;
  if (!s && !c) { try { const h = referrer ? new URL(referrer).hostname : ""; const r = h && h !== ownHost ? cleanRef(h) : undefined; if (r) u.utm_ref = r; } catch { /* bad referrer */ } }
  return u;
}
export function captureUtm(): void {
  try {
    // First touch only: once this tab has an attribution (or was marked direct), later pages / internal links never overwrite it.
    if (sessionStorage.getItem(KEY) === null) sessionStorage.setItem(KEY, JSON.stringify({ ...readTouch(window.location.search, document.referrer, window.location.hostname), path: pathBucket(window.location.pathname) }));
    if (!sessionStorage.getItem(SENT)) {
      sessionStorage.setItem(SENT, "1");
      fetch("/api/v/land", { method: "POST", keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(getUtm()) }).catch(() => {});
    }
  } catch { /* storage unavailable: no attribution */ }
}
export function getUtm(): Utm {
  try { const j = JSON.parse(sessionStorage.getItem(KEY) || "{}"); const u: Utm = {}; const s = clean(j.utm_source), c = clean(j.utm_campaign), m = clean(j.utm_medium), r = cleanRef(j.utm_ref);
    if (s) u.utm_source = s; if (c) u.utm_campaign = c; if (m && (s || c)) u.utm_medium = m; if (r && !s && !c) u.utm_ref = r; const p = bucket(j.path); if (p) u.path = p; return u; } catch { return {}; }
}
