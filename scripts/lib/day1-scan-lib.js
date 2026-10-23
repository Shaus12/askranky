// Logic of scripts/day1-scan.js (kept separate so tests can drive it with stubbed engines and a fake production store).
// Design (spec §3): scan DATA lives only in the temp JSON store src/store.js was loaded with (and in the output file);
// the PRODUCTION Postgres is touched only to (a) read spend[today] and (b) add the scan's cost to spend[today] (+ two audit rows in events).
// No accounts, businesses or scans are ever written to production, so src/weekly.js can never pick up the probe.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { ENGINES, MARKETS, ORDER, OWN_SPEND_LIMIT_USD, CAP_HEADROOM_USD, QUESTIONS_PER_SCAN, probeBusiness, round4, utcDay, runFile, isoIsrael, questionProblems, validateScan } from './day1-common.js';

export const REQUIRED_ENV = ['SCAN_MODE', 'LIVE_ENGINES', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'DATABASE_URL', 'DAILY_SPEND_CAP_USD'];
export const HELP = `Usage: node scripts/day1-scan.js [--market IL-1|US-1 --run 1|2] [--confirm-spend] [--usage-checked] [--rerun] [--out DIR]
  default (no --confirm-spend): DRY RUN. Prints the plan and the estimated cost; no engine calls, no database access, nothing written.
  --confirm-spend   really run ONE scan (needs --market and --run; one scan per invocation, no loops, no retries)
  --usage-checked   required for US-1 run 1: confirms you compared the IL-1 run 1 token usage with the provider dashboards
  --rerun           allow re-running a scan whose valid file already exists (a deliberate second spend)
  --out DIR         output dir (default: <repo>/../research/scans/day1, or $DAY1_DIR)`;

export function parseArgs(argv) {
  const o = { confirm: false, usageChecked: false, rerun: false, help: false }; const bad = [];
  for (let i = 0; i < argv.length; i++) { const a = argv[i];
    if (a === '--confirm-spend') o.confirm = true; else if (a === '--usage-checked') o.usageChecked = true; else if (a === '--rerun') o.rerun = true; else if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--market') o.market = argv[++i]; else if (a === '--run') o.run = Number(argv[++i]); else if (a === '--out') o.out = argv[++i]; else bad.push(a); }
  if (bad.length) throw new Error(`unknown argument(s): ${bad.join(' ')}`);
  if (o.market !== undefined && !MARKETS[o.market]) throw new Error('--market must be IL-1 or US-1');
  if (o.run !== undefined && ![1, 2].includes(o.run)) throw new Error('--run must be 1 or 2');
  return o;
}

export const estimateScanUsd = (costPerCheck) => round4(ENGINES.reduce((s, e) => s + costPerCheck[e] * QUESTIONS_PER_SCAN, 0));
export const ledgerPath = dir => path.join(dir, 'day1-spend-ledger.json');
export function readLedger(dir) { try { return JSON.parse(fs.readFileSync(ledgerPath(dir), 'utf8')); } catch { return { entries: [] }; } }
export const ledgerTotal = dir => round4(readLedger(dir).entries.reduce((s, e) => s + e.usd, 0));
function writeJson(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`; fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 }); fs.renameSync(tmp, file); }
const validFile = (dir, id, run) => { try { const j = JSON.parse(fs.readFileSync(runFile(dir, id, run), 'utf8')); return validateScan(j.scan, id).length === 0; } catch { return false; } };

// Dependencies of the step that must be satisfied before it may run (spec execution order + the pause).
export function orderProblems(dir, id, run, { usageChecked, rerun }) {
  const out = []; const idx = ORDER.findIndex(s => s.id === id && s.run === run);
  if (validFile(dir, id, run) && !rerun) out.push(`${id} run ${run} already exists (${runFile(dir, id, run)}); pass --rerun only for a deliberate second spend`);
  if (idx > 0) { const prev = ORDER[idx - 1]; if (!validFile(dir, prev.id, prev.run)) out.push(`order: ${prev.id} run ${prev.run} must be done (valid file) before ${id} run ${run}`); }
  if (ORDER[idx]?.pauseBefore && !usageChecked) out.push('pause: compare the printed token usage of IL-1 run 1 with the OpenAI/Google dashboards, then re-run with --usage-checked');
  return out;
}
export function envProblems(env) {
  const out = REQUIRED_ENV.filter(k => !env[k]).map(k => `missing env var ${k}`);
  if (env.SCAN_MODE && env.SCAN_MODE !== 'live') out.push('SCAN_MODE must be "live"');
  if (env.LIVE_ENGINES) { const l = env.LIVE_ENGINES.split(',').map(s => s.trim()).filter(Boolean).sort().join(','); if (l !== [...ENGINES].sort().join(',')) out.push('LIVE_ENGINES must be exactly chatgpt,gemini'); }
  if (env.DAILY_SPEND_CAP_USD && !(Number(env.DAILY_SPEND_CAP_USD) > 0)) out.push('DAILY_SPEND_CAP_USD must be a positive number (use the production value)');
  return out;
}

// ---- Production spend writer: the ONLY thing that touches the production database. ----
export async function openProdSpend(url, { Pool } = {}) {
  const S = await import('../../src/store-pg.js'); Pool ||= await S.poolClass(url);
  const pool = new Pool({ connectionString: url, ssl: S.driverFor(url) === 'neon' ? undefined : S.sslFor(url), max: 1 });
  return {
    async read(day) { const { rows } = await pool.query('SELECT usd FROM spend WHERE day = $1', [day]); return rows.length ? round4(rows[0].usd) : 0; },
    // Atomic increment in SQL (no read-modify-write of the whole store; the app's spend table is (day text PK, usd numeric)).
    async add(day, usd) { const { rows } = await pool.query('INSERT INTO spend (day, usd) VALUES ($1, $2) ON CONFLICT (day) DO UPDATE SET usd = spend.usd + EXCLUDED.usd RETURNING usd', [day, round4(usd)]); return round4(rows[0].usd); },
    // Audit rows in the events list (same shape the app uses). ON CONFLICT DO NOTHING so a concurrent app write is never overwritten.
    async event(data) { const { rows } = await pool.query('SELECT coalesce(max(seq) + 1, 0) AS n FROM events'); await pool.query('INSERT INTO events (seq, data) VALUES ($1, $2::jsonb) ON CONFLICT (seq) DO NOTHING', [Number(rows[0].n), JSON.stringify(data)]); },
    close: () => pool.end(),
  };
}

export function renderPlan({ costPerCheck, ledger, cap, dir, steps = ORDER }) {
  const est = estimateScanUsd(costPerCheck); const lines = ['DRY RUN (default): no engine calls, no database access, nothing written.', '', `Plan: ${steps.length} scans x (${QUESTIONS_PER_SCAN} questions x ${ENGINES.length} engines = ${QUESTIONS_PER_SCAN * ENGINES.length} checks) with ChatGPT + Gemini only.`];
  steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s.id} run ${s.run}${s.pauseBefore ? '   (PAUSE before: compare IL-1 run 1 token usage with the provider dashboards, then pass --usage-checked)' : ''}`));
  lines.push('', `Estimated cost: $${est} per scan, $${round4(est * steps.length)} for ${steps.length} scans (ceiling with one re-run: $${round4(est * (steps.length + 1))}; script hard-stops above its own $${OWN_SPEND_LIMIT_USD}).`,
    `Own spend recorded so far in ${dir}: $${ledger}.`, cap ? `Daily cap: $${cap}; a scan is refused if production spend today + $${est} > cap - $${CAP_HEADROOM_USD.toFixed(2)}.` : 'Daily cap: set DAILY_SPEND_CAP_USD (production value) for the live run.',
    '', 'Questions asserted against the spec table:'); return lines.join('\n');
}

// Runs exactly one scan. deps: { runScan, buildQuestions, costPerCheck, dailyCap, prod, store:{BACKEND,DB_FILE}, tempSpend(day), env, now, appCommit, log }.
export async function runDay1Scan(opts, deps) {
  const { market: id, run, usageChecked = false, rerun = false, dir } = opts; const log = deps.log || console.log; const env = deps.env || process.env;
  const fail = (code, msg, extra = {}) => ({ ok: false, code, message: msg, ...extra });
  if (!MARKETS[id] || ![1, 2].includes(run)) return fail('ARGS', '--market and --run are required with --confirm-spend');
  // 1. Guards that need no network.
  if (deps.store?.BACKEND !== 'json' || !deps.store?.DB_FILE || !String(deps.store.DB_FILE).startsWith(deps.tempDir)) return fail('STORE', 'refusing: src/store.js is not the temp JSON store (scan data must never go to production)');
  const envP = envProblems(env); if (envP.length) return fail('ENV', envP.join('; '));
  const ord = orderProblems(dir, id, run, { usageChecked, rerun }); if (ord.length) return fail('ORDER', ord.join('; '));
  const business = probeBusiness(id); const qP = questionProblems(id, deps.buildQuestions(business, QUESTIONS_PER_SCAN)); if (qP.length) return fail('QUESTIONS', `question templates changed: ${qP.join('; ')}`);
  const est = estimateScanUsd(deps.costPerCheck); const own = ledgerTotal(dir);
  if (round4(own + est) > OWN_SPEND_LIMIT_USD) return fail('OWN_LIMIT', `own-spend hard stop: $${own} recorded + $${est} would exceed $${OWN_SPEND_LIMIT_USD}`);
  // 2. Production counter check (read only).
  const day = utcDay(deps.now?.() || new Date()); const cap = deps.dailyCap(); let before;
  try { before = await deps.prod.read(day); } catch (e) { return fail('PROD_READ', `cannot read the production spend counter (${e.message}); nothing was run`); }
  if (round4(before + est) > round4(cap - CAP_HEADROOM_USD)) return fail('DAILY_CAP', `production spend today $${before} + $${est} > cap $${cap} - $${CAP_HEADROOM_USD.toFixed(2)} headroom; nothing was run`);
  log(`[day1] ${id} run ${run}: production spend today (UTC ${day}) before = $${before}, cap = $${cap}, estimate = $${est}`);
  // 3. The scan (fresh in-memory account; business is a probe; data lands only in the temp store).
  const account = { id: 'day1-ops', plan: 'free' }; const startedAt = isoIsrael(deps.now?.() || new Date()); const tBefore = deps.tempSpend(day);
  let scan = null, thrown = null;
  try { scan = await deps.runScan(account, business, { engines: ENGINES }); } catch (e) { thrown = e; }
  // Cost actually incurred: summary.estCostUsd on success; on a thrown scan, whatever the temp store's counter recorded (never silently dropped).
  const incurred = round4(scan ? scan.summary.estCostUsd : deps.tempSpend(day) - tBefore);
  const reasons = thrown ? [`scan threw: ${String(thrown.message).slice(0, 200)}`] : validateScan(scan, id);
  // 4. Save raw file (valid) or an .invalid file, then the local ledger, then production spend.
  const meta = { id, run, startedAt, appCommit: deps.appCommit, models: deps.models, liveEngines: (env.LIVE_ENGINES || '').split(',').map(s => s.trim()), questionsAsserted: true, usageChecked, estCostUsd: incurred, valid: !reasons.length, invalidReasons: reasons, recordedInDailyCounter: false };
  const file = reasons.length ? path.join(dir, `${id}-run${run}.invalid-${Date.now()}.json`) : runFile(dir, id, run);
  if (scan) writeJson(file, { meta, scan });
  if (incurred > 0) { const l = readLedger(dir); l.entries.push({ id, run, usd: incurred, at: startedAt, recordedInDailyCounter: false }); writeJson(ledgerPath(dir), l); }
  let after = before, recorded = incurred === 0;
  if (incurred > 0) {
    try {
      after = await deps.prod.add(day, incurred); recorded = true;
      meta.recordedInDailyCounter = true; if (scan) writeJson(file, { meta, scan });
      const l = readLedger(dir); l.entries.at(-1).recordedInDailyCounter = true; writeJson(ledgerPath(dir), l);
      const at = new Date().toISOString(); const pct = after / cap;
      try { if (pct >= 0.8) await deps.prod.event({ at, type: 'spend.alert', pct: +pct.toFixed(2) }); await deps.prod.event({ at, type: 'spend.day1_scan', id, run, usd: incurred }); } catch (e) { log(`[day1] WARNING: audit event not written (${e.message}); the spend itself IS recorded`); }
    } catch (e) { log(`[day1] !!! COST NOT RECORDED IN THE PRODUCTION DAILY COUNTER: $${incurred} for ${id} run ${run} (${e.message}). Add it by hand to spend[${day}] and record it in the ledger.`); return { ok: false, code: 'PROD_WRITE', message: `cost $${incurred} NOT recorded in production (${e.message})`, incurred, file, meta }; }
  }
  // 5. Print per-engine usage (never keys) + the running day total.
  if (scan) for (const e of ENGINES) { const rs = scan.results.filter(r => r.engine === e && !r.error); const sum = k => rs.reduce((s, r) => s + (r.usage?.[k] || 0), 0);
    log(`[day1]   ${e}: checks=${rs.length} tokens in=${sum('input')} out=${rs.reduce((s, r) => s + (r.usage?.output || 0), 0)} searches=${rs.reduce((s, r) => s + (r.searches || 0), 0)} est cost=$${round4(rs.length * deps.costPerCheck[e])}`); }
  log(`[day1] scan cost $${incurred}; production daily counter ${before} -> ${after} (UTC ${day}); own total $${ledgerTotal(dir)} of $${OWN_SPEND_LIMIT_USD}`);
  if (reasons.length) return { ok: false, code: 'INVALID', message: `output INVALID: ${reasons.join('; ')} (cost was recorded; a re-run is a separate explicit invocation: --rerun)`, incurred, file, meta, recorded };
  const idx = ORDER.findIndex(s => s.id === id && s.run === run);
  if (ORDER[idx + 1]?.pauseBefore) log('[day1] PAUSE: compare the tokens/searches above with the OpenAI and Google dashboards, then run the next step with --usage-checked.');
  return { ok: true, incurred, before, after, file, meta, scan };
}
