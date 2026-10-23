// Email sender. Mock mode writes to $DATA_DIR/outbox (HTML; a .json sidecar with from/replyTo/subject/headers goes to $DATA_DIR/outbox-meta).
// Live mode uses Resend (EMAIL_MODE=live|resend + RESEND_API_KEY).
// EMAIL_FROM (default "Ranky <hello@askranky.com>"; the domain must be verified in Resend) and EMAIL_REPLY_TO (default BRAND.supportEmail) are configurable.
// EMAIL_FROM may be a plain address ("hello@askranky.com") or a display name + address ("Ranky <hello@askranky.com>").
import fs from 'node:fs'; import path from 'node:path'; import { BRAND } from '../brand.js'; import { dataPath } from '../paths.js';
export const emailFrom = () => process.env.EMAIL_FROM || `${BRAND.name} <hello@${BRAND.domain}>`;
export const emailReplyTo = () => process.env.EMAIL_REPLY_TO || BRAND.supportEmail;
// True when emails are only written to the local outbox (nothing is delivered). Exposed to the UI via /api/config.
export const emailIsMock = () => !["live", "resend"].includes(process.env.EMAIL_MODE) || !process.env.RESEND_API_KEY;
// Parses EMAIL_FROM: "addr" or "Display Name <addr>". Returns { name, address, domain } or null when malformed.
export function parseFrom(v) {
  const m = String(v ?? '').trim().match(/^(?:"?([^<>"@]*?)"?\s*<([^\s<>@"]+@[^\s<>@",;]+)>|([^\s<>@"]+@[^\s<>@",;]+))$/); if (!m) return null;
  const address = (m[2] || m[3]).toLowerCase(); const domain = address.split('@')[1]; if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return null;
  return { name: (m[1] || '').trim(), address, domain };
}
// Resend error bodies look like {"statusCode":403,"name":"validation_error","message":"The x.y domain is not verified. ..."}.
// Keep the useful part for logs, minus anything secret or personal (API keys, email addresses, bearer tokens).
export function describeResendError(status, bodyText) {
  let name = '', message = String(bodyText ?? ''); try { const j = JSON.parse(message); name = String(j.name || j.error?.name || ''); message = String(j.message ?? j.error?.message ?? j.error ?? ''); } catch { /* not JSON: use the raw text */ }
  message = message.replace(/\bre_[A-Za-z0-9_-]{6,}/g, '[key]').replace(/Bearer\s+\S+/gi, 'Bearer [key]').replace(/[^\s<>"',;()]+@[^\s<>"',;()]+/g, '[email]').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  return `Resend ${status}${name ? ' ' + name.replace(/[^\w.-]/g, '').slice(0, 60) : ''}${message ? ': ' + message : ''}`;
}
let seq = 0;
export async function sendEmail({ to, subject, html, headers = {}, kind = 'transactional' }) {
  const msg = { from: emailFrom(), reply_to: emailReplyTo(), to, subject, html, headers };
  if (emailIsMock()) {
    const dir = dataPath('outbox'); fs.mkdirSync(dir, { recursive: true });
    const name =  `${Date.now()}-${String(++seq).padStart(4, '0')}-${to.replace(/[^a-z0-9]/gi, '_')}`;
    const meta = dataPath('outbox-meta'); fs.mkdirSync(meta, { recursive: true }); fs.writeFileSync(path.join(dir, name + '.html'), html); fs.writeFileSync(path.join(meta, name + '.json'), JSON.stringify({ from: msg.from, replyTo: msg.reply_to, to, subject, headers, kind }, null, 2));
    return { mock: true, file: path.join(dir, name + '.html') };
  }
  let r;
  try { r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(msg), signal: AbortSignal.timeout(15000) }); }
  catch (e) { const err = new Error(`Resend request failed (${e?.name || 'Error'})`); console.error(`[email] ${kind} send failed: ${err.message}`); throw err; }
  if (!r.ok) { const err = Object.assign(new Error(describeResendError(r.status, await r.text().catch(() => ''))), { status: r.status }); console.error(`[email] ${kind} send failed: ${err.message}`); throw err; }
  return r.json();
}
// For emails that follow something that already happened (a scan ran, a payment went through): a delivery problem is logged by
// sendEmail and must not turn that success into an error for the user. Returns true when sent.
export async function sendEmailSoft(msg) { try { await sendEmail(msg); return true; } catch { return false; } }
