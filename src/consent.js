// Marketing / weekly-email consent: signed unsubscribe tokens + opt-in/opt-out history with timestamps.
// a.consentHistory = [{ at, channel: 'marketing'|'weekly', granted, source }], a.emailPrefs = { marketing, weekly }.
// Weekly reports default ON for paid plans (part of the plan) until the customer unsubscribes; marketing defaults OFF
// unless explicitly opted in. Transactional mail (magic link, receipts, cancel confirmations) is never suppressed.
import crypto from 'node:crypto'; import { safeEqual } from './security/tokens.js';
const DEV_SECRET = 'ranky-dev-unsubscribe-secret';
const secret = () => process.env.UNSUBSCRIBE_SECRET || DEV_SECRET;
export const usingDevSecret = () => !process.env.UNSUBSCRIBE_SECRET;
const mac = s => crypto.createHmac('sha256', secret()).update(s).digest('base64url');
export const CHANNELS = ['marketing', 'weekly', 'all'];
export function unsubToken(accountId, channel = 'all') { const p = `${accountId}.${channel}`; return `${Buffer.from(p).toString('base64url')}.${mac(p)}`; }
export function verifyUnsubToken(t) {
  const [p64, sig] = String(t || '').split('.'); if (!p64 || !sig) return null; let p; try { p = Buffer.from(p64, 'base64url').toString(); } catch { return null; }
  if (!safeEqual(sig, mac(p))) return null; const i = p.lastIndexOf('.'); const channel = p.slice(i + 1); return CHANNELS.includes(channel) ? { accountId: p.slice(0, i), channel } : null;
}
export const unsubUrl = (base, a, channel = 'all', lang = 'en') => `${base}/unsubscribe?t=${encodeURIComponent(unsubToken(a.id, channel))}&lang=${lang}`;
export function setConsent(a, channel, granted, source, now = new Date()) {
  const chans = channel === 'all' ? ['marketing', 'weekly'] : [channel]; a.emailPrefs ||= {}; a.consentHistory ||= [];
  for (const c of chans) { a.emailPrefs[c] = granted; a.consentHistory.push({ at: now.toISOString(), channel: c, granted, source }); }
  if (chans.includes('marketing')) a.marketingConsent = { ...(a.marketingConsent || {}), granted, at: now.toISOString(), source };
}
export function canSend(a, channel) {
  if (channel === 'transactional') return true; const p = a?.emailPrefs?.[channel];
  if (channel === 'marketing') return p === true || (p === undefined && a?.marketingConsent?.granted === true);
  if (channel === 'weekly') return p !== false;
  return false;
}
// RFC 8058 one-click headers for marketing/weekly mail.
export const unsubHeaders = url => ({ 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
