// Day-1 live scan (spec: marketing/day1-scan-spec.md). ONE scan per invocation. Default = DRY RUN.
//   node scripts/day1-scan.js                                   dry run of the whole plan (no network, no writes)
//   node scripts/day1-scan.js --market IL-1 --run 1             dry run of one step
//   SCAN_MODE=live LIVE_ENGINES=chatgpt,gemini ... node scripts/day1-scan.js --market IL-1 --run 1 --confirm-spend
// Scan data goes to a throwaway temp JSON store; only the cost is added to the production spend counter. See scripts/README.md.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { parseArgs, HELP, renderPlan, ledgerTotal, estimateScanUsd, orderProblems, runDay1Scan, openProdSpend } from './lib/day1-scan-lib.js';
import { ORDER, MARKETS, probeBusiness, questionProblems, defaultOutDir, ROOT, QUESTIONS_PER_SCAN } from './lib/day1-common.js';

let args; try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message + '\n\n' + HELP); process.exit(2); }
if (args.help) { console.log(HELP); process.exit(0); }
const dir = path.resolve(args.out || defaultOutDir());
const { buildQuestions } = await import('../src/questions.js'); const { COST_PER_CHECK } = await import('../src/plans.js');   // pure modules: no store, no network

if (!args.confirm) {  // ---- DRY RUN ----
  const steps = args.market ? ORDER.filter(s => s.id === args.market && (!args.run || s.run === args.run)) : ORDER;
  const cap = Number(process.env.DAILY_SPEND_CAP_USD) || null;
  console.log(renderPlan({ costPerCheck: COST_PER_CHECK, ledger: ledgerTotal(dir), cap, dir, steps }));
  let bad = 0; for (const id of Object.keys(MARKETS)) { const p = questionProblems(id, buildQuestions(probeBusiness(id), QUESTIONS_PER_SCAN)); console.log(`  ${id}: ${p.length ? 'MISMATCH ' + p.join('; ') : 'OK (5 questions equal the spec table)'}`); bad += p.length; }
  console.log('\nLive env var NAMES needed (values never printed): SCAN_MODE=live, LIVE_ENGINES=chatgpt,gemini, OPENAI_API_KEY, GEMINI_API_KEY, DATABASE_URL (production), DAILY_SPEND_CAP_USD (production value). Present now: ' + ['SCAN_MODE', 'LIVE_ENGINES', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'DATABASE_URL', 'DAILY_SPEND_CAP_USD'].map(k => `${k}=${process.env[k] ? 'yes' : 'no'}`).join(' '));
  if (args.market && args.run) { const o = orderProblems(dir, args.market, args.run, args); console.log(o.length ? `Blocked now: ${o.join('; ')}` : 'Order/prerequisites: OK for this step.'); }
  console.log('\nTo spend, add --confirm-spend with --market and --run (one scan per call).'); process.exit(bad ? 1 : 0);
}

// ---- LIVE: isolate the app store BEFORE anything imports src/store.js ----
const prodUrl = process.env.DATABASE_URL; const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ranky-day1-'));
delete process.env.DATABASE_URL; delete process.env.DB_FILE; process.env.FORCE_JSON_STORE = '1'; process.env.STORE = 'json'; process.env.DATA_DIR = tempDir; delete process.env.NODE_ENV;
const { runScan } = await import('../src/scan.js'); const store = await import('../src/store.js'); const { dailyCapUsd } = await import('../src/costs.js');
let code = 0, prod = null;
try {
  prod = await openProdSpend(prodUrl);
  let appCommit = null; try { appCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch {}
  const r = await runDay1Scan({ market: args.market, run: args.run, usageChecked: args.usageChecked, rerun: args.rerun, dir }, {
    runScan, buildQuestions, costPerCheck: COST_PER_CHECK, dailyCap: dailyCapUsd, prod, store: { BACKEND: store.BACKEND, DB_FILE: store.DB_FILE }, tempDir,
    tempSpend: day => store.getDb().spend[day] || 0, env: { ...process.env, DATABASE_URL: prodUrl }, appCommit,
    models: { chatgpt: process.env.OPENAI_MODEL || 'gpt-5-mini', gemini: process.env.GEMINI_MODEL || 'gemini-3-flash-preview' } });
  if (r.ok) console.log(`[day1] OK: ${r.file}`); else { console.error(`[day1] STOPPED (${r.code}): ${r.message}`); code = r.code === 'PROD_WRITE' ? 3 : 1; }
} catch (e) { console.error('[day1] unexpected error:', e.message); code = 1; }
finally { await prod?.close().catch(() => {}); fs.rmSync(tempDir, { recursive: true, force: true }); }
process.exit(code);
