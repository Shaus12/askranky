# Conversion funnel (first-party, aggregate)
`GET /api/internal/status` (header `X-Status-Token`) now has a `funnel` block: `today`, `last7Days`, `last30Days`, `total`, each with
`visit, scanStarted, scanDone, signup, checkoutStarted, paid`, plus `conversionLast30DaysPct` between consecutive steps. Days are UTC.

| Step | Source |
|---|---|
| visit | Server-side counter of `200` GET responses for public HTML pages (`/he`, `/en`, `/{lang}/pricing|scan|report|blog…|legal…`). Bots (user-agent pattern), empty/`node` user agents and prefetches are skipped. Kept in memory per day and written as aggregate `funnel.visits` events `{day, n}` every `FUNNEL_FLUSH_MS` (default 600000 = 10 min); a restart can lose up to that window. |
| scanStarted | `funnel.scan_started` event recorded inside `runScan` (src/scan.js) after the engine and budget checks, so every scan path counts (free form, `/api/scan`, dashboard re-scans, weekly, alerts); automatic re-scans and Fix-up scans are excluded like scanDone. Compare with `scanDoneSinceTracking`; the difference ≈ scans that died mid-run. |
| scanDone | Stored scans, excluding automatic re-scans (`auto`) and Fix-up scans. Backfilled from before `trackingSince`, so it can exceed scanStarted. |
| scanDoneSinceTracking | scanDone restricted to scans after `trackingSince` (comparable to scanStarted; used for `scanStartToDone`). |
| signup | Accounts created (free scan email, checkout or password signup). |
| checkoutStarted | `checkout.started` event when `POST /api/checkout` opens a checkout (plans and the Fix-up). |
| paid | `subscription.activated` + `order.paid` events. |

Admin/test accounts are excluded. Privacy: no cookies, no localStorage, no third-party scripts, and nothing about the visitor (IP, user
agent, path, id) is stored, only per-day totals; so it does not depend on the consent banner. No DB migration (uses the existing events table).
Not counted: visitors with JavaScript-only navigations inside the static site after the first page (Next.js client routing does not hit the server), so `visit` is a lower bound of page views.

## Owner / internal scans (OWNER_EMAILS)

Emails listed in `OWNER_EMAILS` (Render env, comma-separated, e.g. `OWNER_EMAILS=owner@example.com`) can run unlimited scans from the
public scan form (outreach prospects). Those scans are stored with `internal: true` and are **excluded** from `scanStarted`, `scanDone`,
`scanDoneSinceTracking`, `signup` and the conversion percentages. They are counted separately in the funnel as `internalScanStarted` and
`internalScans` (today / last7Days / last30Days / total), and `recentScans` shows `internal: true`. Their API spend still counts in
`spend` and against `DAILY_SPEND_CAP_USD`. The allowlist never signs anyone in or opens a dashboard.

## Email-gated free scan (gate1)

The public scan form asks only for business name and city. `POST /api/scan` without an email runs the scan on a guest account
(`guest: true`, no email) and stores the scan as `locked: true`. While locked, `GET /api/report/:id` returns only `{ locked, business
{name, city, category}, scan {id, at, mock, summary {score, checks, engines.ran/skipped, topCompetitors (max 3 names + counts)}},
hiddenCompetitors }`; answers, fixes, sources, per-engine data, history and alerts never leave the server. `POST /api/report/:id/unlock
{ email, marketingConsent, lang }` (JSON only, rate-limited `UNLOCK_RATE_MAX`/15 min, default 10) attaches the scan to that email's
account (reused if it exists; a paid account needs sign-in -> 401), sends the report email and removes the lock.

| Step | Source |
|---|---|
| emailUnlocked | `funnel.email_unlocked` events. `conversionLast30DaysPct.scanToEmailUnlock` = emailUnlocked / scanDone. |
| internalEmailUnlocked | Unlocks with an `OWNER_EMAILS` address; the scan is then flagged `internal` and its `scan_started` event too. |

Guest accounts are not signups; the signup is counted when the unlock creates the email account. Limits on the guest path: CAPTCHA,
scan rate limiter, per-IP 3 free scans/day, `DAILY_SPEND_CAP_USD`. Owners who want to skip the per-IP limit enter their email up front
(under "more options"), which keeps the previous path. No email verification (dedupe by address; abuse bounded by the limits above).

## Per-source funnel (utm1)

`GET /api/internal/status` → `funnel.sources` shows which post / campaign brought sessions, including those that never started a scan.

- **First touch per browser tab** (`web/lib/utm.ts`): on the first page view of a tab, `utm_source` / `utm_campaign` / `utm_medium` from the URL are saved in `sessionStorage` (`ranky-utm`). If there is no utm, only the referring site's **host name** is saved (`l.facebook.com` → `facebook.com`, no path or query). Later pages and internal links never overwrite it. No cookie, no localStorage, no identifier; it disappears when the tab closes. Same sanitizing as the server (`[A-Za-z0-9_.-]{1,64}`, host names only; anything else dropped).
- **One landing beacon per tab session**: `POST /api/v/land` (same origin, 204, no body). The server counts it in memory per UTC day × source × campaign × medium, plus distinct visitors with the same in-memory daily hash as page views (never stored). Bots, link previews, prefetch, empty user agents and monitors (`X-Ranky-Monitor: 1`) are excluded. Persisted with `flushVisits()` as aggregate `funnel.src_visits` events `{day, s, c, m, n, u}`. Rate limited per IP (`LAND_RATE_MAX`, default 60 / 15 min; over the limit = silently not counted).
- **Carried to conversions**: the same attribution goes with `POST /api/scan` (scan.utm, account.utm first touch), so `funnel.scan_started` and `funnel.email_unlocked` events carry `src`; signup and paid use the account's first touch.
- **Shape**: `{ trackingSince, top: 20, last7Days: [row], sinceTracking: [row], note }`, row = `{ source, campaign, medium, visits, visitors, scanStarted, scanDone, emailUnlocked, signup, paid }`. `source` = utm_source (lower-case) or `ref:<host>` or `direct`; `campaign` / `medium` or `-`. Top 20 rows by visits; the rest summed into one `other` row (`groupedRows`). Max 300 new keys per day in memory, later ones fold into `other`. Owner (OWNER_EMAILS), test, bot and monitor traffic excluded.
- **Facebook in-app browser**: works with `sessionStorage`; language / legacy redirects (`/`, `/pricing`, `/blog`, …) keep the query string, so the landing page still sees the utm.
