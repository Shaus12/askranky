import type { Dict } from "./i18n";
// Which demo/pre-launch notice to show is decided by three independent server flags from /api/config:
//   mock       = scans are sample data (SCAN_MODE != live)             -> "demo data / no questions sent to AI engines"
//   emailMock  = emails are not delivered (EMAIL_MODE != resend/live)  -> "no email is sent, report on screen only"
//   prelaunch  = payments are not open yet                              -> "coming soon" banner (never claims scans are demo by itself)
export type Flags = { mock?: boolean; prelaunch?: boolean; emailMock?: boolean };
export function demoNotices(c: Flags | null | undefined, t: Dict) {
  const d = t.demo; const mock = !!c?.mock, pre = !!c?.prelaunch, noEmail = !!c?.emailMock;
  return {
    banner: pre ? (mock ? d.bannerMock : d.banner) : null,
    formNote: mock && noEmail ? d.scanNote : mock ? d.sampleNote : noEmail ? d.emailNote : null,
    privacy: mock ? (noEmail ? d.privacy : d.privacyMock) : noEmail ? d.privacyNoEmail : t.form.privacy,
    emailLabel: noEmail ? d.email : null,
    progressMock: mock ? t.scan.mock : null,
    runNote: noEmail ? d.runNoEmail : null,
    reportNote: noEmail ? d.reportNote : null,
    loginSent: noEmail ? d.loginSent : t.login.sent,
  };
}
