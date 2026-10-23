// Cookie-notice record. Stored ONLY in this browser (localStorage), never sent to a server. There are no optional categories
// (no analytics / advertising), so the record is an acknowledgement of the information notice.
export const CONSENT_KEY = "ranky_consent_v1";
export const CONSENT_OPEN_EVENT = "ranky:consent-open";
export const CONSENT_MAX_AGE_MS = 365 * 24 * 3600 * 1000; // ask again (show the notice) after 12 months
export type ConsentRecord = { v: 1; at: string; essential: true; optional: Record<string, never> };
export function readConsent(): ConsentRecord | null {
  try {
    const r = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
    if (!r || r.v !== 1 || typeof r.at !== "string" || Number.isNaN(Date.parse(r.at))) return null;
    return r as ConsentRecord;
  } catch { return null; }
}
export const consentFresh = (r: ConsentRecord | null, now = Date.now()) => !!r && now - Date.parse(r.at) < CONSENT_MAX_AGE_MS;
export function writeConsent(now = new Date()): ConsentRecord {
  const r: ConsentRecord = { v: 1, at: now.toISOString(), essential: true, optional: {} };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(r)); } catch { /* storage blocked: the notice just shows again next visit */ }
  return r;
}
export const openConsent = () => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
