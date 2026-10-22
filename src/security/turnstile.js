// Cloudflare Turnstile hook. Disabled (always passes) unless TURNSTILE_SECRET_KEY is set.
export const turnstileEnabled = () => !!process.env.TURNSTILE_SECRET_KEY;
export const turnstileSiteKey = () => (turnstileEnabled() && process.env.TURNSTILE_SITE_KEY) || null;
export async function verifyTurnstile(tokenValue, ip, fetchImpl = globalThis.fetch) {
  if (!turnstileEnabled()) return { ok: true, skipped: true };
  if (!tokenValue) return { ok: false, error: 'Please complete the CAPTCHA.' };
  try {
    const r = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: String(tokenValue), ...(ip ? { remoteip: ip } : {}) }) });
    const j = await r.json(); return j.success ? { ok: true } : { ok: false, error: 'CAPTCHA verification failed.' };
  } catch { return { ok: false, error: 'CAPTCHA verification unavailable, try again.' }; }
}
