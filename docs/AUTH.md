# Accounts and sign-in (v2-auth)

- Email + password: scrypt (N=2^15, r=8, p=1, 64-byte key, 16-byte salt per user; params stored with the hash). Policy: 10..256 characters, small common-password list, no composition rules.
- Sign-up stores the hash as `pendingPassword` and emails a 24h single-use link (`/{lang}/verify`, confirmed by POST). Existing email: same generic answer, the owner gets an "already registered" email with a reset link.
- Reset: `/api/auth/reset-request` (generic answer) emails a 30-minute single-use link (`/{lang}/reset`). A new password wipes every session of the account.
- Magic links still work and now also start a session; the legacy `x-dashboard-key` keeps working for the dashboard API and the paid-account `/scan` guard (transition period).
- Sessions: cookie `__Host-ranky_sid` (HttpOnly, Secure, SameSite=Lax, Path=/) when BASE_URL is https (`ranky_sid` locally). Server store: `sessions` (sha256(id) -> accountId, csrf, exp; 30 days, env SESSION_TTL_DAYS). Postgres table from an appended migration (PG_AUTO_MIGRATE).
- CSRF: cookie-authenticated writes need `X-CSRF-Token` (from `/api/auth/me`) and a matching Origin/Referer when present.
- Rate limits (env, per 15 min unless noted): AUTH_LOGIN_MAX 10/IP, AUTH_LOGIN_EMAIL_MAX 8/email, AUTH_SIGNUP_MAX 5/IP/h, AUTH_RESET_MAX 5/IP/h, AUTH_RESET_EMAIL_MAX 3/email/h, AUTH_TOKEN_MAX 20/IP, AUTH_PASSWORD_MAX 10/IP, AUTH_GOOGLE_MAX 30/IP. Turnstile on signup, login and reset-request when configured.

## Google sign-in
Off (button hidden, `/auth/google*` 404) unless both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
1. Google Cloud console → new project "Ranky" → APIs & Services → OAuth consent screen: External, app name Ranky, support email, authorized domain `askranky.com`, privacy/terms URLs (`https://askranky.com/he/legal/privacy`, `/he/legal/terms`), scopes `openid`, `email`, `profile` (non-sensitive, no verification review needed), publish to Production.
2. Credentials → Create OAuth client ID → Web application. Authorized redirect URI: `https://askranky.com/auth/google/callback` (exactly; derived from BASE_URL). No JavaScript origins needed.
3. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Render env (BASE_URL must be `https://askranky.com`). No CSP change: the flow is a full-page redirect.
