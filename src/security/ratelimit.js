// In-memory sliding-window rate limiter (single process; use Redis if you scale out).
export function createRateLimiter({ windowMs = 10 * 60 * 1000, max = 5, keyFn = q => q.ip, now = () => Date.now(), onLimit } = {}) {
  const hits = new Map();
  const mw = (q, r, next) => {
    const k = keyFn(q) || 'unknown', t = now(); const arr = (hits.get(k) || []).filter(x => t - x < windowMs);
    if (arr.length >= max) { const retry = Math.ceil((windowMs - (t - arr[0])) / 1000); r.set('Retry-After', String(retry)); hits.set(k, arr);
      return onLimit ? onLimit(q, r, retry) : r.status(429).send('Too many requests'); }
    arr.push(t); hits.set(k, arr); next();
  };
  mw.reset = () => hits.clear();
  const sweep = setInterval(() => { const t = now(); for (const [k, a] of hits) if (!a.some(x => t - x < windowMs)) hits.delete(k); }, windowMs); sweep.unref?.();
  return mw;
}
