// In-memory sliding-window rate limiter (single process; use Redis if you scale out).
export function createRateLimiter({ windowMs = 10 * 60 * 1000, max = 5, keyFn = q => q.ip, now = () => Date.now(), onLimit } = {}) {
  const hits = new Map(); const marks = new WeakMap(); // marks: request -> [key, timestamp] of the hit it added (for refund)
  const mw = (q, r, next) => {
    const k = keyFn(q) || 'unknown', t = now(); const arr = (hits.get(k) || []).filter(x => t - x < windowMs);
    if (arr.length >= max) { const retry = Math.ceil((windowMs - (t - arr[0])) / 1000); r.set('Retry-After', String(retry)); hits.set(k, arr);
      return onLimit ? onLimit(q, r, retry) : r.status(429).send('Too many requests'); }
    arr.push(t); hits.set(k, arr); marks.set(q, [k, t]); next();
  };
  // Give back the hit this request added (e.g. a CAPTCHA failure should not eat the user's attempts). No-op if it never counted.
  mw.refund = q => { const m = marks.get(q); if (!m) return false; marks.delete(q); const a = hits.get(m[0]); const i = a ? a.indexOf(m[1]) : -1; if (i < 0) return false; a.splice(i, 1); return true; };
  mw.reset = () => hits.clear();
  const sweep = setInterval(() => { const t = now(); for (const [k, a] of hits) if (!a.some(x => t - x < windowMs)) hits.delete(k); }, windowMs); sweep.unref?.();
  return mw;
}
