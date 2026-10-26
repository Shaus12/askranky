// Local demo data for looking at the dashboard: one Pro account, two businesses (EN + HE), three mock scans each spread over
// three weeks. Mock engines only (no API keys, no spend, no email). Refuses to run against the default ./data directory.
//   DATA_DIR=/tmp/ranky-demo node scripts/demo-dashboard.js   → writes $DATA_DIR/demo-url.txt (open it on a server started with the same DATA_DIR)
import fs from 'node:fs';
for (const k of ['SCAN_MODE', 'LIVE_ENGINES', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'EMAIL_MODE', 'RESEND_API_KEY', 'DATABASE_URL']) delete process.env[k];
const { DATA_DIR, dataPath } = await import('../src/paths.js');
if (!process.env.DATA_DIR || DATA_DIR.endsWith('/data')) { console.error('Set DATA_DIR to a separate demo directory (never ./data).'); process.exit(1); }
const { getDb, save, flush, id } = await import('../src/store.js');
const { runScan } = await import('../src/scan.js');
const crypto = await import('node:crypto');

const db = getDb();
const account = { id: id(10), key: crypto.randomBytes(32).toString('base64url'), email: 'demo@ranky.test', plan: 'pro', createdAt: new Date().toISOString(), usage: {} };
db.accounts[account.id] = account;
const businesses = [
  { id: id(10), accountId: account.id, name: 'Acme Plumbing', category: 'Plumber', city: 'Austin, TX', website: 'https://acmeplumbing.example' },
  { id: id(10), accountId: account.id, name: 'אינסטלציה אקמה', category: 'אינסטלטור', city: 'חולון', website: '' },
];
const day = 86400000; const start = Date.now() - 21 * day;
for (const b of businesses) {
  db.businesses[b.id] = b;
  // A different MOCK_SEED per round makes the mock answers change between scans, so the alerts are real diffs, not hand-written.
  for (let i = 0; i < 3; i++) { process.env.MOCK_SEED = `demo-round-${i}`; const s = await runScan(account, b); s.at = new Date(start + i * 7 * day).toISOString(); }
}
save(); await flush();
const url = `/en/dashboard/${account.id}?key=${encodeURIComponent(account.key)}`;
fs.writeFileSync(dataPath('demo-url.txt'), url + '\n', { mode: 0o600 });
console.log(`Demo data in ${DATA_DIR}: 1 account, ${businesses.length} businesses, 6 scans. Dashboard path written to ${dataPath('demo-url.txt')}`);
