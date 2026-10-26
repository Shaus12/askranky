// Server-side sessions. The browser holds only a random 32-byte id in an HttpOnly cookie (__Host- prefixed + Secure when BASE_URL is https);
// the store keeps sha256(id) -> { accountId, csrf, createdAt, exp }, so a leaked DB row cannot be replayed as a cookie.
// Rotated on every login (old one destroyed), all of an account's sessions wiped on password change / reset.
import { token, sha256, safeEqual } from '../security/tokens.js';
export const SESSION_TTL_MS = Number(process.env.SESSION_TTL_DAYS || 30) * 864e5;
export const secureCookies = base => /^https:/i.test(base || '');
export const sessionCookieName = base => secureCookies(base) ? '__Host-ranky_sid' : 'ranky_sid';
export const cookieAttrs = (base, maxAgeMs) => `Path=/; HttpOnly; SameSite=Lax${secureCookies(base) ? '; Secure' : ''}${maxAgeMs != null ? `; Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}` : ''}`;
export function readCookie(q, name) {
  for (const part of String(q.get('cookie') || '').split(';')) { const i = part.indexOf('='); if (i < 0) continue; if (part.slice(0, i).trim() === name) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; } } }
  return null;
}
export function createSessionStore({ getDb, save }) {
  const all = () => (getDb().sessions ||= {});
  const sweep = (now = Date.now()) => { const s = all(); let n = 0; for (const [k, v] of Object.entries(s)) if (!v || v.exp <= now) { delete s[k]; n++; } return n; };
  return {
    create(accountId, { now = Date.now(), via = 'password' } = {}) {
      sweep(now); const id = token(32); all()[sha256(id)] = { accountId, csrf: token(24), via, createdAt: new Date(now).toISOString(), exp: now + SESSION_TTL_MS }; save(); return id;
    },
    get(id, now = Date.now()) {
      if (typeof id !== 'string' || id.length < 20 || id.length > 100) return null; const k = sha256(id); const s = Object.hasOwn(all(), k) ? all()[k] : null;
      if (!s) return null; if (s.exp <= now) { delete all()[k]; save(); return null; } return { ...s, key: k };
    },
    destroy(id) { if (typeof id !== 'string') return; const k = sha256(id); if (Object.hasOwn(all(), k)) { delete all()[k]; save(); } },
    destroyAllFor(accountId) { const s = all(); let n = 0; for (const [k, v] of Object.entries(s)) if (v?.accountId === accountId) { delete s[k]; n++; } if (n) save(); return n; },
    csrfOk(sess, t) { return !!sess && typeof t === 'string' && safeEqual(t, sess.csrf); },
    sweep,
  };
}
// Origin / Referer check for state-changing requests: when the browser names an origin it must be ours.
export function sameOrigin(q, base) {
  const allowed = new Set(); try { allowed.add(new URL(base).origin); } catch {} if (q.get('host')) allowed.add(`${q.protocol}://${q.get('host')}`);
  const o = q.get('origin'); if (o && o !== 'null') return allowed.has(o); if (o === 'null') return false;
  const ref = q.get('referer'); if (ref) { try { return allowed.has(new URL(ref).origin); } catch { return false; } }
  return null; // neither header: caller decides (non-browser clients)
}
// Open-redirect guard: only same-site relative paths under /he or /en.
export function safeNext(v, fallback) {
  const s = typeof v === 'string' ? v : ''; if (s.length > 300 || !/^\/(he|en)(\/[A-Za-z0-9\-._~%/]*)?(\?[A-Za-z0-9\-._~%=&]*)?(#[A-Za-z0-9\-_]*)?$/.test(s) || s.includes('//') || s.includes('\\') || /%2f|%5c|%00/i.test(s)) return fallback;
  return s;
}
