# Day-1 scan scripts

Spec: `/workspace/business/marketing/day1-scan-spec.md`. Real data only, ChatGPT + Gemini only, 4 scans (IL-1 he "רופא שיניים"/"תל אביב", US-1 en "dentist"/"Austin, TX", 2 runs each, 5 questions x 2 engines).

## 1. Scan (`scripts/day1-scan.js`): ONE scan per invocation, default = DRY RUN

```
# dry run (default): prints the plan, estimated cost ($0.17/scan, $0.68 for 4), the question assertion, which env var NAMES are set. No network, no DB, writes nothing.
node scripts/day1-scan.js
node scripts/day1-scan.js --market IL-1 --run 1

# live (spends money; only after Shai approved the spend). Env var NAMES required (values never printed):
#   SCAN_MODE=live  LIVE_ENGINES=chatgpt,gemini  OPENAI_API_KEY  GEMINI_API_KEY
#   DATABASE_URL (production Postgres, used ONLY for the spend counter)  DAILY_SPEND_CAP_USD (the production value)
node scripts/day1-scan.js --market IL-1 --run 1 --confirm-spend
node scripts/day1-scan.js --market US-1 --run 1 --confirm-spend --usage-checked   # after comparing IL-1 run 1 token usage with the OpenAI/Google dashboards
node scripts/day1-scan.js --market IL-1 --run 2 --confirm-spend
node scripts/day1-scan.js --market US-1 --run 2 --confirm-spend
```
Order is enforced (IL-1 r1 -> pause -> US-1 r1 -> IL-1 r2 -> US-1 r2). A valid run is never repeated unless `--rerun`. Output dir: `$DAY1_DIR` or `<repo>/../research/scans/day1` (`--out DIR`). Raw files are PRIVATE (they contain competitor names) and are never committed.

**Spend accounting.** The app store (`src/store.js`) is forced to a throwaway temp JSON store (`FORCE_JSON_STORE=1`, temp `DATA_DIR`, `DATABASE_URL` removed from the app's env before import; refuses to run otherwise), so the probe business/scan/account never exist in production and `src/weekly.js` can never pick them up. Production is touched only by `openProdSpend()`: `SELECT usd FROM spend WHERE day=<UTC day>` before each scan and, after it, an atomic `INSERT ... ON CONFLICT (day) DO UPDATE SET usd = spend.usd + <cost>` (+ `spend.day1_scan` and, at >= 80% of the cap, `spend.alert` rows in `events`, same shape as the app). Cost = `scan.summary.estCostUsd` (successful checks only); if a scan throws after spending (e.g. Gemini fully down) the cost is taken from the temp store counter. Before each scan it refuses if `prod spend today + $0.17 > cap - $1.00` or if its own recorded total (`day1-spend-ledger.json`) + $0.17 would exceed $0.85. If the production write fails, the cost is printed loudly and the exit code is 3 (ledger shows `recordedInDailyCounter:false`; add it by hand).

Output is **invalid** (saved as `<ID>-run<N>.invalid-<ts>.json`, exit 1, cost still recorded) if any result is mock/errored, an engine skipped/failed, errors > 0, or the questions differ from the spec table.

## 2. Analysis (`scripts/day1-analyze.js`): offline, no network, zero cost
Needs `<ID>-run<N>.json` (from the scan) and a human-curated `businesses-<ID>.json` (`[{name, aliases[], website, ...}]` or `{source, businesses:[...]}`, exactly 12). Optional `review-<ID>.json`: `{"overrides":[{"business","run?","engine?","q?","named":true|false,"reason"}]}` (override wins, each one is logged).
```
node scripts/day1-analyze.js            # writes results-<ID>.json/.md, review-<ID>.md, placeholders-all.json into the dir
```
`.json` outputs hold aggregates only (business names appear as "(private)"); names are only in `results-<ID>.md` and `review-<ID>.md`. Definitions follow spec §5.2; choices where the spec was open: aliases are tried one by one with the product's `analyzeAnswer` and OR-ed; `n_cited_hosts_total` = distinct hosts counted (and `n_citations_counted` = total citations counted); `variance_finding` X = names named in run 1 (either engine) that neither engine named in run 2; fix titles containing a listed business name are never used for `fix_1..3`; `common_trait` stays `null` (manual).

Tests: `node test/day1.js` (stubbed engines at fetch level, pg-mem as the "production" DB, no keys, no network).
