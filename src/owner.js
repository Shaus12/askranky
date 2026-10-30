// Owner allowlist (OWNER_EMAILS, comma-separated, case-insensitive, trimmed; unset = empty = no change anywhere).
// Owner emails may run unlimited free-form scans (outreach prospects): the per-email free-scan rule, the per-IP free-scan limit and the
// "sign in to continue" existing-account guard are skipped on POST /scan and /api/scan. CAPTCHA, validation, the scan rate limiter and the
// DAILY_SPEND_CAP_USD / plan budget still apply. Scans on an owner account are stored with internal:true and kept out of the funnel.
// This never grants a session, a dashboard key or access to any account: it only changes scan admission. Never log the addresses.
export const ownerEmails = (env = process.env) => String(env.OWNER_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
export const isOwnerEmail = (email, env = process.env) => { const e = String(email || '').trim().toLowerCase(); return !!e && ownerEmails(env).includes(e); };
