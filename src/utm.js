// Marketing attribution without identifiers: only utm_source and utm_campaign, each max 64 chars of [A-Za-z0-9_.-]; anything else is dropped (not truncated).
// No IP, no user agent, no referrer. Stored on scan records (scan.utm) and, first touch only, on account records (account.utm); never exposed publicly.
const OK = /^[A-Za-z0-9_.-]{1,64}$/;
// Long all-digit values are dropped too: they could be mistaken for card numbers by the checkout card-data guard (and are never a campaign name).
export const cleanUtm = v => typeof v === 'string' && OK.test(v) && !/^\d{12,}$/.test(v) ? v : null;
// body: { utm_source, utm_campaign } as sent by the web app. Returns { source, campaign } (missing = null) or null when neither is valid.
export function utmFrom(body) { const source = cleanUtm(body?.utm_source), campaign = cleanUtm(body?.utm_campaign); return source || campaign ? { source, campaign } : null; }
// First touch: never overwrites an account's existing attribution. Returns true when the record changed (caller saves).
export function applyUtm(account, body) { if (account.utm) return false; const u = utmFrom(body); if (!u) return false; account.utm = u; return true; }
