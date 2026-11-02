// dropoff1: privacy-safe drop-off counter. Sends only an allowlisted event name and a coarse 0/1 in-app-browser flag to our own
// /api/funnel/e (no cookies, no ids, no user agent, no page data). Fire-and-forget; never throws, never blocks the UI.
export type DropEvent = "form_submit_attempted" | "turnstile_missing" | "turnstile_error" | "turnstile_expired" | "turnstile_unsupported" | "turnstile_load_failed" | "city_confirm_shown" | "scan_request_sent" | "scan_progress_left" | "scan_error_shown" | "scan_report_ready" | "report_viewed" | "locked_report_viewed";
export const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|LinkedInApp|musical_ly|Bytedance|Snapchat|Twitter|Line\/|Pinterest|GSA\//i;
export function track(e: DropEvent) {
  try {
    const body = JSON.stringify({ e, iab: IN_APP.test(navigator.userAgent || "") ? 1 : 0 });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/funnel/e", new Blob([body], { type: "text/plain" }))) return;
    fetch("/api/funnel/e", { method: "POST", body, headers: { "Content-Type": "text/plain" }, credentials: "same-origin", keepalive: true }).catch(() => {});
  } catch { /* ignore */ }
}
