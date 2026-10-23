// Offline analysis of the Day-1 scans (spec §5): reads research/scans/day1/<ID>-run<N>.json + businesses-<ID>.json (+ optional review-<ID>.json overrides).
// No network, no provider, no cost. Usage: node scripts/day1-analyze.js [--out DIR]
import fs from 'node:fs'; import path from 'node:path';
import { analyzeMarket, resultsMd, businessList } from './lib/day1-analysis.js';
import { MARKETS, defaultOutDir, runFile } from './lib/day1-common.js';

const argv = process.argv.slice(2); const oi = argv.indexOf('--out'); const dir = path.resolve(oi >= 0 ? argv[oi + 1] : defaultOutDir());
if (argv.includes('--help')) { console.log('Usage: node scripts/day1-analyze.js [--out DIR]\nWrites results-<ID>.json/.md, review-<ID>.md and placeholders-all.json into DIR. Business names stay in the .md files (private); the .json files hold aggregates only.'); process.exit(0); }
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const write = (name, data) => fs.writeFileSync(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2), { mode: 0o600 });
const merged = {}; let anyInvalid = false, any = false;
for (const id of Object.keys(MARKETS)) {
  const runs = [1, 2].map(n => readJson(runFile(dir, id, n))).filter(Boolean); if (!runs.length) { console.log(`${id}: no run files in ${dir}; skipped`); continue; } any = true;
  const biz = businessList(readJson(path.join(dir, `businesses-${id}.json`))); const overrides = readJson(path.join(dir, `review-${id}.json`))?.overrides || [];
  const r = analyzeMarket({ id, runs, businesses: biz, overrides });
  const { review, mdLines, privateRows, overridesApplied, ...pub } = r; pub.overridesAppliedCount = overridesApplied?.length || 0; write(`results-${id}.json`, pub); write(`results-${id}.md`, resultsMd(r)); if (r.valid) { write(`review-${id}.md`, review.md); merged[id] = r.placeholders; }
  console.log(`${id}: ${r.valid ? `valid, ${r.placeholders.n_checks} checks, ${r.placeholders.k_named} of 12 named (${r.placeholders.pct_mentioned}%)` : `INVALID: ${r.invalidReasons.join('; ')}`}`); if (!r.valid) anyInvalid = true;
}
if (any) write('placeholders-all.json', merged);
process.exit(!any || anyInvalid ? 1 : 0);
