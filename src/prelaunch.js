// Pre-launch ("coming soon") mode. While on: no checkout is started (no payment collected), the mock payment page and
// /billing/return refuse, the UI offers a waitlist instead, and scans/reports are labelled as demo.
// PRELAUNCH=1|true forces it on, PRELAUNCH=0|false forces it off. Unset: on automatically when NODE_ENV=production and
// either scans or payments are still mock (safe default for a public deploy that isn't wired to real providers yet).
import { isMockMode } from './providers/index.js';
import { getPayments } from './payments/index.js';
export function isPrelaunch() {
  const v = String(process.env.PRELAUNCH ?? '').toLowerCase();
  if (v === '1' || v === 'true') return true; if (v === '0' || v === 'false') return false;
  return process.env.NODE_ENV === 'production' && (isMockMode() || getPayments().id === 'mock');
}
