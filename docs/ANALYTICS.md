# Conversion funnel (first-party, aggregate)
`GET /api/internal/status` (header `X-Status-Token`) now has a `funnel` block: `today`, `last7Days`, `last30Days`, `total`, each with
`visit, scanStarted, scanDone, signup, checkoutStarted, paid`, plus `conversionLast30DaysPct` between consecutive steps. Days are UTC.

| Step | Source |
|---|---|
| visit | Server-side counter of `200` GET responses for public HTML pages (`/he`, `/en`, `/{lang}/pricing|scan|report|blog…|legal…`). Bots (user-agent pattern), empty/`node` user agents and prefetches are skipped. Kept in memory per day and written as aggregate `funnel.visits` events `{day, n}` every `FUNNEL_FLUSH_MS` (default 600000 = 10 min); a restart can lose up to that window. |
| scanStarted | `funnel.scan_started` event when a free/public scan really starts (`POST /scan`, `POST /api/scan`, after CAPTCHA, validation and the one-free-scan rule); `scanStarted − scanDone` ≈ scans that failed (no engine, cap). |
| scanDone | Stored scans, excluding automatic re-scans (`auto`) and Fix-up scans. |
| signup | Accounts created (free scan email, checkout or password signup). |
| checkoutStarted | `checkout.started` event when `POST /api/checkout` opens a checkout (plans and the Fix-up). |
| paid | `subscription.activated` + `order.paid` events. |

Admin/test accounts are excluded. Privacy: no cookies, no localStorage, no third-party scripts, and nothing about the visitor (IP, user
agent, path, id) is stored, only per-day totals; so it does not depend on the consent banner. No DB migration (uses the existing events table).
Not counted: visitors with JavaScript-only navigations inside the static site after the first page (Next.js client routing does not hit the server), so `visit` is a lower bound of page views.
