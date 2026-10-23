// Cloudflare Turnstile hook. Disabled (always passes) unless TURNSTILE_SECRET_KEY is set.
// Failures carry a stable `code` (captcha_required | captcha_failed | captcha_unavailable) plus an English `error` message;
// clients localize from the code. Never logs the secret or the token, only Cloudflare's error-codes.
export const turnstileEnabled = () => !!process.env.TURNSTILE_SECRET_KEY;
export const turnstileSiteKey = () => (turnstileEnabled() && process.env.TURNSTILE_SITE_KEY) || null;
export const TURNSTILE_TIMEOUT_MS = 5000;
const MESSAGES = { captcha_required: 'Please complete the CAPTCHA.', captcha_failed: 'CAPTCHA verification failed.', captcha_unavailable: 'CAPTCHA verification unavailable, try again.' };
const fail = (code, extra = {}) => ({ ok: false, code, error: MESSAGES[code], ...extra });
// Hostnames a valid token may have been issued for. The check runs in production, or whenever TURNSTILE_HOSTNAMES is set
// explicitly (dev/test skip it, since Cloudflare test keys report a fixed hostname).
export const allowedHostnames = (env = process.env) => String(env.TURNSTILE_HOSTNAMES || 'askranky.com,www.askranky.com').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const hostnameCheckOn = (env = process.env) => env.NODE_ENV === 'production' || !!String(env.TURNSTILE_HOSTNAMES || '').trim();
export async function verifyTurnstile(tokenValue, ip, fetchImpl = globalThis.fetch) {
  if (!turnstileEnabled()) return { ok: true, skipped: true };
  if (!tokenValue) return fail('captcha_required');
  try {
    const r = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: String(tokenValue), ...(ip ? { remoteip: ip } : {}) }) });
    const j = await r.json();
    if (!j || !j.success) { const codes = Array.isArray(j?.['error-codes']) ? j['error-codes'].map(String).slice(0, 8) : []; console.warn(`[turnstile] verification failed: ${codes.join(',') || 'no error-codes'}`); return fail('captcha_failed', { codes }); }
    if (hostnameCheckOn() && !allowedHostnames().includes(String(j.hostname || '').toLowerCase())) { console.warn(`[turnstile] hostname mismatch: ${String(j.hostname || '(none)').slice(0, 100)}`); return fail('captcha_failed', { codes: ['hostname-mismatch'] }); }
    return { ok: true };
  } catch (e) { console.warn(`[turnstile] siteverify unavailable (${e?.name || 'error'}), failing closed`); return fail('captcha_unavailable'); }
}
