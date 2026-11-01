// Marketing attribution without identifiers: utm_source, utm_campaign, utm_medium (each max 64 chars of [A-Za-z0-9_.-]; anything else is
// dropped, not truncated) and, only when there is no utm, the referring site's HOST name (no path, no query). No IP, no user agent, no id.
// Stored on scan records (scan.utm), first touch only on accounts (account.utm), on funnel events, and as aggregate per-source visit counts
// (src/sources.js). Never exposed publicly.
const OK = /^[A-Za-z0-9_.-]{1,64}$/;
// Long all-digit values are dropped too: they could be mistaken for card numbers by the checkout card-data guard (and are never a campaign name).
export const cleanUtm = v => typeof v === 'string' && OK.test(v) && !/^\d{12,}$/.test(v) ? v : null;
// Referrer host: lower-case hostname only, mobile/link-shim prefixes folded (l.facebook.com, m.facebook.com, lm.facebook.com -> facebook.com).
const HOST = /^(?=.{1,64}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
export const cleanRef = v => { if (typeof v !== 'string') return null; const h = v.trim().toLowerCase().replace(/^(?:www|m|l|lm|mobile|out)\./, ''); return HOST.test(h) && !/^\d+(?:\.\d+)+$/.test(h) ? h : null; };
// body: { utm_source, utm_campaign, utm_medium?, utm_ref? } as sent by the web app. Returns { source, campaign[, medium][, ref] } or null.
export function utmFrom(body) {
  const source = cleanUtm(body?.utm_source), campaign = cleanUtm(body?.utm_campaign), medium = cleanUtm(body?.utm_medium), ref = source || campaign ? null : cleanRef(body?.utm_ref);
  return source || campaign || ref ? { source, campaign, ...(medium ? { medium } : {}), ...(ref ? { ref } : {}) } : null;
}
// First touch: never overwrites an account's existing attribution. Returns true when the record changed (caller saves).
export function applyUtm(account, body) { if (account.utm) return false; const u = utmFrom(body); if (!u) return false; account.utm = u; return true; }
// Grouping key for reports: source (lower-cased) or 'ref:<host>' or 'direct'; campaign / medium lower-cased or '-'. Max 40 chars each.
export const srcOf = u => { const s = cleanUtm(u?.source), r = cleanRef(u?.ref); return { source: s ? s.toLowerCase().slice(0, 40) : r ? `ref:${r}`.slice(0, 44) : 'direct', campaign: (cleanUtm(u?.campaign) || '-').toLowerCase().slice(0, 40), medium: (cleanUtm(u?.medium) || '-').toLowerCase().slice(0, 40) }; };
