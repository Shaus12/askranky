// Unguessable access tokens + single-use magic links.
import crypto from 'node:crypto';
export const token = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(sha256(a)), y = Buffer.from(sha256(b)); return crypto.timingSafeEqual(x, y) && a === b;
}
export const MAGIC_TTL_MS = 15 * 60 * 1000;
// Store only the hash of the magic token on the account; the raw token travels only by email.
export function issueMagicLink(account, base, now = Date.now()) {
  const t = token(32); account.magic = { hash: sha256(t), exp: now + MAGIC_TTL_MS };
  return `${base}/auth/magic?a=${encodeURIComponent(account.id)}&t=${encodeURIComponent(t)}`;
}
export function consumeMagic(account, t, now = Date.now()) {
  const m = account?.magic; if (!m || typeof t !== 'string' || now > m.exp || !safeEqual(sha256(t), m.hash)) return false;
  delete account.magic; return true;
}
