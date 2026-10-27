// WhatsApp contact number for the site (env WHATSAPP_NUMBER). Digits only, international format without "+" or leading zeros
// (e.g. 972501234567), 8-15 digits (E.164). Anything else (spaces, dashes, +, letters, 0-prefixed local numbers) = not set, so the
// button stays hidden. Exposed through /api/config (the site is a static export, so a build-time value would need a rebuild to change).
export function whatsappNumber(v = process.env.WHATSAPP_NUMBER) { const s = String(v ?? '').trim(); return /^[1-9]\d{7,14}$/.test(s) ? s : null; }
