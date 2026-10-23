# Ranky go-live checklist (Render)

Nothing here has been flipped yet. Production currently runs **mock scans + mock payments + mock email**, so pre-launch
mode is on automatically (waitlist instead of checkout, everything labelled demo). Each step needs Shai's approval.
Check config at any time with `npm run config:check` (prints variable **names** only, never values). The server prints
the same report on startup; set `CONFIG_STRICT=1` to refuse to start on errors.

## 0. Already safe to set now (no behaviour change for customers)
| Var | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | enables Postgres store + auto pre-launch |
| `BASE_URL` | `https://askranky.com` | magic links, report links |
| `SITE_URL` | `https://askranky.com` | robots/sitemap (default already) |
| `TRUST_PROXY` | `1` | real client IP behind Render's proxy (rate limits) |
| `DATABASE_URL` | Neon URL (already set) | Postgres store; driver auto = `@neondatabase/serverless` for `*.neon.tech` |
| `PG_AUTO_MIGRATE` | `1` (default) | first boot creates the tables (idempotent). `0` = never touch schema |
| `DAILY_SPEND_CAP_USD` | `10` | live-API spend guard per UTC day (default 10) |
| `ENABLE_USD_BILLING` | `false` | ILS-only billing (enforced in code for SUMIT unless `SUMIT_USD_VERIFIED=1`) |
| `PRELAUNCH` | unset (auto) or `1` | force coming-soon mode; `0` only at launch |

After the first deploy with `DATABASE_URL`: optionally import old JSON data once with `npm run db:import -- data/db.json`
(from a Render shell; refuses a non-empty DB without `--force`). `npm run db:check` is a read-only SELECT 1 / version check.

## 1. Live scans
- `SCAN_MODE=live`, `LIVE_ENGINES=chatgpt,gemini` (add `perplexity` once its key is approved)
- `OPENAI_API_KEY`, `GEMINI_API_KEY` (top up Google AI Studio credit first: last test returned HTTP 402), `PERPLEXITY_API_KEY`
- `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`: CAPTCHA on scan, login, waitlist and checkout (widget in each form, HE/EN).
  **Both are required in live mode** (production with pre-launch off): the server refuses to start (exit 1) without them. In pre-launch it only warns; setting just one also warns.
  Errors come back as `{error:'captcha_required'|'captcha_failed'|'captcha_unavailable'}` and the UI shows the localized text. siteverify has a 5s timeout and fails closed.
- `TURNSTILE_HOSTNAMES` (optional, comma-separated, default `askranky.com,www.askranky.com`): hostnames a token may be issued for. Checked in production; add a staging host here if needed.
  Make sure the Turnstile widget in Cloudflare lists the same domains.
- `TRUST_PROXY=1` **must be set on Render** (behind its proxy): otherwise rate limits and the CAPTCHA `remoteip` see the proxy IP.
- Optional: `OPENAI_MODEL`, `GEMINI_MODEL`, `PERPLEXITY_MODEL`, `SCAN_RATE_MAX`, `SCAN_RATE_WINDOW_MS`

## 2. Email
- `EMAIL_MODE=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Ranky <hello@askranky.com>`, domain verified in Resend; default `Ranky <reports@askranky.com>`)
- `EMAIL_REPLY_TO` (default `SUPPORT_EMAIL`, i.e. support@askranky.com)
- `UNSUBSCRIBE_SECRET`: long random string (e.g. `openssl rand -base64 32`). Signs the unsubscribe links in weekly/report emails.
  **Required** for live email (config error otherwise). Changing it invalidates links in emails already sent.
- Weekly/report emails carry a signed `/unsubscribe` link + `List-Unsubscribe` / one-click headers. Opt-outs are stored
  per account (`emailPrefs`, `consentHistory` with timestamps) and the weekly job skips them. Receipts, failed-payment and
  cancellation emails are transactional and always sent (templates: ops/email-templates §4–6, HE/EN).

## 3. Payments (SUMIT, ILS only)
- `PAYMENTS_PROVIDER=sumit`, `SUMIT_COMPANY_ID` (numeric), `SUMIT_API_KEY` (PRIVATE, server only), `SUMIT_PUBLIC_API_KEY` (the browser-safe public key; legacy alias `SUMIT_API_PUBLIC_KEY`), `SUMIT_WEBHOOK_SECRET`
- **Embedded card form (SUMIT Payments JS), no hosted redirect page.** The card form is on our own pages (`/{lang}/checkout`, hidden `/admin/test-checkout`).
  SUMIT's `https://app.sumit.co.il/scripts/payments.js` (needs jQuery, self-hosted at `/vendor/jquery-3.7.1.min.js`) tokenizes the card in the browser
  straight against `https://api.sumit.co.il/creditguy/vault/tokenizesingleuse/` with the PUBLIC key; our server only receives `{identifier, token, lang}`
  (`POST /api/checkout/charge`, admin: `POST /api/admin/test-checkout/charge`) and calls `/billing/recurring/charge/` with `SingleUseToken`.
  Card numbers never reach our server (requests with card-like fields or values are rejected 400 and nothing is logged). The browser gets `companyId` + the
  public key only in the response of `POST /api/checkout` (after CAPTCHA and the PRELAUNCH gate) / the token-gated admin start, never the private key
  (startup config check refuses `SUMIT_PUBLIC_API_KEY` equal to `SUMIT_API_KEY`).
- **No SUMIT-side redirect setting is needed any more**: the "redirect URL" / `/billing/return` setting and the catalog/payment-page success URL are unused
  (the hosted page `/creditguy/external/tokenize` and its "no success navigation URL defined" error are gone). `GET /billing/return` only serves the mock provider.
- CSP (`src/security/csp.js`) is sent ONLY on `/{lang}/checkout` and `/admin/test-checkout` (not site-wide): `script-src 'self' <inline-script hashes | nonce> https://app.sumit.co.il https://challenges.cloudflare.com`,
  `connect-src 'self' https://api.sumit.co.il https://challenges.cloudflare.com`, `frame-src https://challenges.cloudflare.com`, `form-action 'self'`, `frame-ancestors 'none'`. The SUMIT origins appear only while `PAYMENTS_PROVIDER=sumit`.
  The payments.js script is third-party code that sees the card fields: it is pinned only by origin (SUMIT sends no CORS header, so SRI is not possible).
- Optional: `CHARGE_RATE_MAX` (default 15 charge attempts per IP per 15 min).
- Keep `ENABLE_USD_BILLING=false`. USD stays display-only; customers are charged the ILS list price.
- `SUMIT_WEBHOOK_SECRET` (≥16 chars) is now **mandatory**: without it every `/webhooks/payments` call is rejected (401).
  Configure the SUMIT trigger URL as `https://askranky.com/webhooks/payments?secret=<SUMIT_WEBHOOK_SECRET>` (or send header `x-webhook-secret`).
- **Daily billing sync** (SUMIT sends no IPN for renewals). Pick ONE:
  - Render Cron Job (preferred): command `npm run billing:sync`, schedule `0 4 * * *` (UTC), same env vars as the web service
    (needs `DATABASE_URL` + `NODE_ENV=production` so it reads the same Postgres DB).
  - or in-process: `BILLING_SYNC_CRON=1` on the web service (single instance only; first run 1 min after boot, then every 24h).
  The job renews `paidThrough` + sends a receipt email, marks failed payments `past_due` + sends one failed-payment email,
  downgrades to free after 7 days unpaid, and ends cancelled plans at `paidThrough`.
  - **Free Render plan (no cron):** use the external trigger below instead.
- Self-serve cancel: dashboard → "Cancel subscription" → confirm → `POST /api/dashboard/:id/cancel` → SUMIT
  `/billing/recurring/cancel/`, access kept until `paidThrough`, written confirmation email (s.13D).
- In SUMIT: company set as עוסק פטור, default document קבלה, no VAT; renewals also produce קבלה. First real charge only with Shai's approval.

### External cron on the free Render plan (cron-job.org)
The free plan has no cron jobs and the service sleeps after ~15 min idle, so the daily billing sync is triggered from outside:

- **Endpoint:** `POST https://askranky.com/api/internal/cron/sync` with header `X-Cron-Secret: <CRON_SECRET>`. No body.
  - `CRON_SECRET` is a **new, separate** env var (NOT `ADMIN_TEST_TOKEN`). Generate it with `openssl rand -hex 32` and set it on Render (min 16 chars).
  - `CRON_SECRET` unset (or shorter than 16) → the endpoint is **disabled** (404). Wrong/missing header → 401 (compared timing-safe); more than 10 wrong attempts per 15 min per IP → 429 (`CRON_FAIL_MAX`). It is not behind the CAPTCHA.
  - Success → `200 {"ok":true,"ranAt":"<ISO time>"}`. Failure → `500 {"ok":false}`. If a run is already in progress → `202 {"ok":true,"running":true}`. Responses and logs never contain SUMIT data or the secret.
- **Keep-warm:** `GET /healthz` → `{"ok":true}` (no DB or provider calls).
- **cron-job.org setup (free account, two jobs):**
  1. **Daily sync:** URL `https://askranky.com/api/internal/cron/sync`, request method **POST**, under *Advanced* add the header `X-Cron-Secret` with the value of `CRON_SECRET`. Schedule: once a day (e.g. 04:07 UTC). **Request timeout: 60 s or more** (a cold start takes ~60 s; use the maximum the plan allows). Turn **on** "Retry on failure"/execution retries and **on** failure notifications (email on failed or timed-out runs). Success = HTTP 200 (a 202 means a run was already in progress, also fine).
  2. **Keep-warm:** URL `https://askranky.com/healthz`, method **GET**, every 10 minutes, timeout 60 s, failure notification optional.
  3. Use "Test run" on the sync job once after setting `CRON_SECRET` on Render; expect `{"ok":true,...}`.
- **Optional, later:** a GitHub Actions version of the same schedule is stored as `docs/cron.yml.example`. The token we deploy with has no `workflow` scope, so the file is **not** in `.github/workflows/`. To use it, add it through the GitHub web UI (Add file → Create new file → `.github/workflows/cron.yml`, paste the YAML) and create the repo secret `CRON_SECRET` (Settings → Secrets and variables → Actions → New repository secret). GitHub scheduled workflows can be delayed or skipped and are disabled after 60 days without repo activity.
- **Caveats:**
  - A keep-warm ping every 10 min keeps the service awake around the clock, which uses roughly 720-744 of Render's 750 free instance-hours per month. Fine for one free service, not for two. Drop the keep-warm job (or ping less often) if that matters; the sync still works from a cold start.
  - **What the sync does when the service is cold:** the first request wakes the service (~60 s), so the job needs a timeout of 60 s or more and retries on. The sync runs inside that request and is idempotent: renewals only move `paidThrough` forward when it has passed, the failed-payment email is sent once per failure (`failedNoticeAt`), and downgraded accounts are skipped on later runs. A late, duplicated or retried run is therefore safe, and overlapping runs are collapsed by the in-process lock.
  - **If a day is missed:** nothing is lost, the next run catches up. Renewals/downgrades are decided from stored dates (`paidThrough`, `pastDueSince`), but the sync advances `paidThrough` by one month per run, and the 7-day unpaid grace starts when the sync first sees the failure, so a missed day delays receipts/failed-payment emails/downgrades by about a day (a multi-week outage would need several runs to catch up).

## 3b. Pre-launch admin test checkout
- `ADMIN_TEST_TOKEN` (≥16 random chars). While pre-launch, `POST /api/checkout` with header `x-admin-test-token: <token>`
  starts a **mock** checkout (never with `PAYMENTS_PROVIDER=sumit`); the account is flagged `adminTest: true`. Compared
  timing-safe. Leave unset to disable. Remove at launch.

## 3d. Hidden admin-only REAL 1 ILS test checkout (SUMIT)
- Only exists when `PAYMENTS_PROVIDER=sumit` **and** `ADMIN_TEST_TOKEN` (>= 16 chars) is set; otherwise 404. Page `GET /admin/test-checkout` (noindex, not linked, not in sitemap/robots), API `POST /api/admin/test-checkout {email}` -> `{embedded: {companyId, publicKey, identifier}}`, `POST /api/admin/test-checkout/charge {identifier, token}` (the only way to complete a test checkout) and `POST /api/admin/test-checkout/login-link {email}` (test accounts only). Token only in the `x-admin-test-token` header, timing-safe, wrong tokens rate limited (`ADMIN_FAIL_MAX`, default 10 per 15 min).
- Uses the internal plan in `src/payments/test-plan.js` (1 ILS, ILS only, `Recurrence: 1` = one payment), which is NOT in `PLANS`: public prices and `/api/checkout` are unchanged. Same real path as production (embedded Payments JS card form on the admin page, token POST, `recurring/charge`, DocumentType 2 receipt, NoVAT true). Works while PRELAUNCH is on; a start expires after 30 min; a real customer's active subscription is never touched.
- The account gets `testSubscription: true`, plan `starter` for 24h. The daily sync never renews it or sends billing emails; 24h after the charge it confirms the standing order is inactive (cancels it if not) and ends access. Cancel works through the normal dashboard flow.
- Logs: only `[admin-test] checkout started|charge ok doc=<id>|charge failed`. Procedure and refund notes: `TEST-CHECKOUT.he.md`. Tests: `test/admintest.js`, `test/sumitjs.js`; manual browser check (fake keys, SUMIT stubbed): `CHROME=/usr/bin/google-chrome node scripts/sumit-browser-check.mjs`.

## 3c. SEO
- JSON-LD (Organization, WebSite, SoftwareApplication, FAQPage) is in the static build. Paid `Offer`s are published only
  when the web build runs with `NEXT_PUBLIC_CHECKOUT_LIVE=1` (set it in the Render build env at launch, then rebuild).
- `/llms.txt`, per-page meta/OG (`public/og-he.png`, `og-en.png`, `logo.png`; regenerate with `cd web && node scripts/og-images.mjs`),
  `X-Robots-Tag: noindex` on dashboard/login/checkout/billing/auth/unsubscribe.

## 4. Launch
- `npm run config:check` shows no errors → set `PRELAUNCH=0` (or leave unset: auto-off once scans and payments are both live).
- Verify: `/health` shows `prelaunch:false, store:"postgres"`, `/robots.txt`, `/sitemap.xml`, a test scan, a 404 page.
