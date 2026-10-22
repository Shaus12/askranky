# Ranky go-live checklist (Render)

Nothing here has been flipped yet. Production currently runs **mock scans + mock payments + mock email**, so pre-launch
mode is on automatically (waitlist instead of checkout, everything labelled demo). Each step needs Shai's approval.
Check config at any time with `npm run config:check` (prints variable **names** only, never values). The server prints
the same report on startup; set `CONFIG_STRICT=1` to refuse to start on errors.

## 0. Already safe to set now (no behaviour change for customers)
| Var | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | enables Postgres store + auto pre-launch |
| `BASE_URL` | `https://askranky.com` | magic links, report links, SUMIT return URL |
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
- `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (the widget is already in the scan form)
- Optional: `OPENAI_MODEL`, `GEMINI_MODEL`, `PERPLEXITY_MODEL`, `SCAN_RATE_MAX`, `SCAN_RATE_WINDOW_MS`

## 2. Email
- `EMAIL_MODE=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Ranky <hello@askranky.com>`, domain verified in Resend)

## 3. Payments (SUMIT, ILS only)
- `PAYMENTS_PROVIDER=sumit`, `SUMIT_COMPANY_ID`, `SUMIT_API_KEY`, `SUMIT_PUBLIC_API_KEY`, `SUMIT_WEBHOOK_SECRET`
- Keep `ENABLE_USD_BILLING=false`. USD stays display-only; customers are charged the ILS list price.
- In SUMIT: company set as עוסק פטור, default document קבלה, no VAT; renewals also produce קבלה. First real charge only with Shai's approval.

## 4. Launch
- `npm run config:check` shows no errors → set `PRELAUNCH=0` (or leave unset: auto-off once scans and payments are both live).
- Verify: `/health` shows `prelaunch:false, store:"postgres"`, `/robots.txt`, `/sitemap.xml`, a test scan, a 404 page.
