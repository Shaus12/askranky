// Email sender. Mock mode writes to $DATA_DIR/outbox. Live mode uses Resend (set EMAIL_MODE=live + RESEND_API_KEY).
import fs from 'node:fs'; import path from 'node:path'; import { BRAND } from '../brand.js'; import { dataPath } from '../paths.js';
export async function sendEmail({ to, subject, html }) {
  if (!["live", "resend"].includes(process.env.EMAIL_MODE) || !process.env.RESEND_API_KEY) {
    const dir = dataPath('outbox'); fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `${Date.now()}-${to.replace(/[^a-z0-9]/gi, '_')}.html`); fs.writeFileSync(f, html); return { mock: true, file: f };
  }
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${BRAND.name} <reports@${BRAND.domain}>`, to, subject, html }) });
  if (!r.ok) throw new Error('Resend ' + r.status); return r.json();
}
