// Email sender. Mock mode writes to $DATA_DIR/outbox (HTML; a .json sidecar with from/replyTo/subject/headers goes to $DATA_DIR/outbox-meta).
// Live mode uses Resend (EMAIL_MODE=live|resend + RESEND_API_KEY).
// EMAIL_FROM (default "Ranky <reports@askranky.com>") and EMAIL_REPLY_TO (default BRAND.supportEmail) are configurable.
import fs from 'node:fs'; import path from 'node:path'; import { BRAND } from '../brand.js'; import { dataPath } from '../paths.js';
export const emailFrom = () => process.env.EMAIL_FROM || `${BRAND.name} <reports@${BRAND.domain}>`;
export const emailReplyTo = () => process.env.EMAIL_REPLY_TO || BRAND.supportEmail;
// True when emails are only written to the local outbox (nothing is delivered). Exposed to the UI via /api/config.
export const emailIsMock = () => !["live", "resend"].includes(process.env.EMAIL_MODE) || !process.env.RESEND_API_KEY;
let seq = 0;
export async function sendEmail({ to, subject, html, headers = {}, kind = 'transactional' }) {
  const msg = { from: emailFrom(), reply_to: emailReplyTo(), to, subject, html, headers };
  if (emailIsMock()) {
    const dir = dataPath('outbox'); fs.mkdirSync(dir, { recursive: true });
    const name =  `${Date.now()}-${String(++seq).padStart(4, '0')}-${to.replace(/[^a-z0-9]/gi, '_')}`;
    const meta = dataPath('outbox-meta'); fs.mkdirSync(meta, { recursive: true }); fs.writeFileSync(path.join(dir, name + '.html'), html); fs.writeFileSync(path.join(meta, name + '.json'), JSON.stringify({ from: msg.from, replyTo: msg.reply_to, to, subject, headers, kind }, null, 2));
    return { mock: true, file: path.join(dir, name + '.html') };
  }
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
  if (!r.ok) throw new Error('Resend ' + r.status); return r.json();
}
