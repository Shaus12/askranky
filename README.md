# Ranky (askranky.com)
Free AI-visibility scan → shareable report → weekly tracking plan. Everything runs in **mock mode** with no keys.

## Run
    cd web && npm install && npm run build &## Run
    cd /workspace/business/app && npm install          # API/server deps
    cd web && npm install && cd ..                    # frontend deps (Next.js, GSAP, Lenis, Tailwind)
    npm run build                                     # next build → static export in web/out
    npm start                                         # http://localhost:3000  (UI + API, mock mode)
    npm test                                          # e2e + security + Hebrew tests (temp DATA_DIR, never touches data/)
    npm run weekly                                    # re-scan paid accounts + email reports (cron weekly)
Frontend dev with hot reload: `npm start` (Express on :3000) + `cd web && npm run dev` → http://localhost:3001 (proxies /api, /auth, /billing to Express; override with API_URL).
Screenshots: see header of `web/scripts/screenshots.mjs` (real scan → report → login → dashboard flow, he+en, desktop+mobile).

## Architecture (one codebase)
- **Express (`server.js`) is the only server:** JSON API under `/api/*`, magic-link auth (`/auth/magic`), billing return/webhooks, rate limits, Turnstile check, JSON store.
- **Next.js UI (`web/`) is built as a static export** (`output: "export"` → `web/out`) and served by the same Express process. Pages: `/he`, `/en` (landing), `/:lang/scan`, `/:lang/r/:id` (report), `/:lang/report` (sample), `/:lang/login`, `/:lang/dashboard/:id`, `/:lang/checkout`, `/:lang/legal?doc=`. Hebrew pages are `dir="rtl"`. `/` redirects by cookie/Accept-Language; old short links (`/r/:id`, `/dashboard/:id?key=`, `/login`, `/pricing`, `/mock-checkout`) redirect to the language-prefixed pages. Dynamic segments map onto one exported page whose client code reads the id from the URL.
- **Why static export served by Express (not a Next server proxying to Express, not Next API routes):**
  1. All security work (rate limits, Turnstile, single-use magic links, timing-safe keys, atomic store) already lives in Express with 24 regression tests; moving it into Next API routes would mean rewriting and re-testing it.
  2. One process, one port, one origin: no CORS, the dashboard key never crosses domains, cookies/headers stay simple; cheapest hosting (any Node box; the UI could also go on a CDN later).
  3. Nothing in the UI needs SSR: report/dashboard data is private or per-user and fetched client-side; landing pages are pre-rendered HTML (good for SEO).
  Trade-off: no Next middleware/ISR/server components with data. If needed later, run `next start` and proxy `/api` to Express; the UI code doesn't change.
- **Dashboard key handling:** the magic link lands on `/dashboard/:id?key=…` (no-referrer, no-store); the page moves the key into sessionStorage, strips it from the URL, and sends it as `X-Dashboard-Key`.
- **Turnstile:** the widget renders on the scan form only when `/api/config` returns a site key (both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` set); the token is sent as `turnstileToken`. Off by default.
- **Data dir:** `DATA_DIR` (default `./data`) holds `db.json` and the mock `outbox/`. Tests create a temp `DATA_DIR` and assert `data/` is unchanged.
- **Hebrew:** `src/questions.js` (15 Hebrew templates, chosen when the business is Hebrew or `lang:"he"`), `src/cities.js` (45 Israeli cities he/en + aliases; synced into the UI city picker by `web/scripts/sync-cities.mjs`), `src/extract.js` (strips bidi marks/niqqud/gershayim, Unicode-aware matching, Hebrew prefix letters, Hebrew-letter list numbering, Hebrew stop words), Hebrew fixes in `src/fixes.js`, Hebrew mock answers in `src/providers/mock.js`. Tests: `test/hebrew.js`.

y, the one place to change. `src/plans.js`: ILS/USD prices, caps, cost per check. `src/currency.js`: currency detection + `ENABLE_USD_BILLING` (default off → USD visitors are charged the ILS list price). No VAT (עוסק פטור).
- `src/providers/`: engine interface (`ask(question) -> {text,citations,searches,usage}`): `openai.js` (Responses + web_search), `gemini.js` (Google Search grounding), `perplexity.js` (Agent API; VERIFY endpoint), `mock.js`.
- `src/extract.js`: mentions, rank position, competitors, citations, own-site detection. `src/scan.js`: runs checks, score, summary. `src/fixes.js`: 3 fixes.
- `src/costs.js`: per-plan monthly check budget + global daily $ cap + 80% alert event.
- `src/payments/`: pluggable (`mock`, `sumit`). SUMIT flow: embedded Payments JS card form on our checkout page (card → SUMIT directly, we get a SingleUseToken) → `POST /api/checkout/charge` → `/billing/recurring/charge/` (USD, monthly standing order) → daily `sync()` (SUMIT sends no IPN on renewals).
- `src/email/`: weekly report HTML template + sender (outbox or Resend).
- `legal/`: Terms, Privacy, Refunds, AI disclaimer (DRAFTS).
- Storage: JSON file `$DATA_DIR/db.json` (default `data/`; swap to Postgres for production).

## Going live checklist
Set keys in `.env` (see `.env.example`), `SCAN_MODE=live`, `PAYMENTS_PROVIDER=sumit`, `EMAIL_MODE=live`; no SUMIT redirect URL setting is needed (embedded card form); verify fields marked VERIFY in `src/payments/sumit.js` and `src/providers/perplexity.js`; add a daily cron that calls `sync()` per paid account.

## External cron (free Render plan)
The daily billing sync is triggered from cron-job.org (a GitHub Actions example is in `docs/cron.yml.example`) via `POST /api/internal/cron/sync` with header `X-Cron-Secret` (env `CRON_SECRET`, `openssl rand -hex 32`); `GET /healthz` is the keep-warm ping. Full setup, caveats and cold-start/missed-run behaviour: **GO-LIVE.md → "External cron on the free Render plan"**.

## Ops status endpoint
`GET /api/internal/status` (header `X-Status-Token`, env `STATUS_TOKEN` >= 24 chars) returns read-only aggregate numbers (sync, scans, spend vs cap, signups, subscribers/MRR in ILS, payment failures, mode flags): no PII, no SUMIT data. Disabled, missing or wrong token = the normal unknown-route 404. Details in `GO-LIVE.md`.

## Frontend
Next.js 15 + TypeScript + Tailwind 4 in `web/` (Lenis smooth scroll, GSAP ScrollTrigger reveals, animated score gauge, scan progress, report). Copy in `web/lib/i18n.ts` (he/en). The previous React+Vite frontend was replaced; it's in `../app.backup-20261021-1743/web`.
