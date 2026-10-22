// One-off live scan (explicit opt-in). Usage: SCAN_MODE=live DATA_DIR=$(mktemp -d) node scripts/live-scan.js
// Never prints keys; prints answers, extraction and token usage only.
if (process.env.SCAN_MODE !== 'live') { console.error('Refusing: set SCAN_MODE=live'); process.exit(1); }
const { runScan } = await import('../src/scan.js');
const business = { id: 'live-test', name: 'אבו חסן', category: 'חומוסייה', city: 'תל אביב', lang: 'he', website: '' };
const account = { id: 'live-test-acct', plan: process.env.LIVE_PLAN || 'starter' };
const scan = await runScan(account, business, { engines: ['chatgpt', 'gemini'], maxQuestions: 1 });
for (const r of scan.results) console.log(JSON.stringify({ engine: r.engine, mock: r.mock, q: r.question, error: r.error, usage: r.usage, searches: r.searches, mentioned: r.mentioned, rank: r.rank, competitors: r.competitors, hosts: r.citations?.map(c => c.host), answer: r.answer }, null, 1));
console.log('SUMMARY', JSON.stringify(scan.summary));
