// Site v2 screenshots: same as screenshots.mjs plus sample report, pricing, checkout, legal, scan form.
// Real-flow screenshots against the Express server (mock mode). The login limiter allows 5 sign-in requests / 15 min per IP,
// so run one viewport per server start (VIEWS=desktop, then restart, VIEWS=mobile). Usage:
//   DATA_DIR=$(mktemp -d) DISABLE_IP_LIMIT=1 SCAN_RATE_MAX=100 PORT=3055 node server.js &
//   BASE=http://localhost:3055 DATA_DIR=<same dir> OUT=../screenshots node web/scripts/screenshots.mjs
import { chromium } from "playwright"; import fs from "node:fs"; import path from "node:path";
const BASE = process.env.BASE || "http://localhost:3000"; const OUT = path.resolve(process.env.OUT || "screenshots"); const OUTBOX = path.join(process.env.DATA_DIR, "outbox");
fs.mkdirSync(OUT, { recursive: true });
const views = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 } };
const BIZ = { he: { name: "אינסטלציה אקמה", website: "https://acme.co.il", category: "אינסטלטור", city: "תל אביב-יפו" }, en: { name: "Acme Plumbing", website: "https://acmeplumbing.com", category: "Plumber", city: "Austin, TX" } };
const post = (p, body) => fetch(BASE + p, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function magicLinkFor(email) {
  const before = new Set(fs.existsSync(OUTBOX) ? fs.readdirSync(OUTBOX) : []);
  await post("/api/login", { email }); await new Promise((r) => setTimeout(r, 200));
  const f = fs.readdirSync(OUTBOX).filter((x) => !before.has(x)).find((x) => fs.readFileSync(path.join(OUTBOX, x), "utf8").includes("/auth/magic"));
  return fs.readFileSync(path.join(OUTBOX, f), "utf8").match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&").replace(/^https?:\/\/[^/]+/, BASE);
}
async function settle(p) {
  const h = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 400) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(120); }
  await p.waitForTimeout(1000); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(2200);
}
const shot = async (p, name) => { const f = path.join(OUT, `${name}.png`); await p.screenshot({ path: f, fullPage: true }); console.log(f); };
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {}); let n = 0;
for (const [vname, vp] of Object.entries(views).filter(([v]) => !process.env.VIEWS || process.env.VIEWS.split(",").includes(v))) for (const lang of ["he", "en"]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, deviceScaleFactor: vp.deviceScaleFactor || 1, locale: lang === "he" ? "he-IL" : "en-US" });
  const p = await ctx.newPage(); const tag = `${lang}-${vname}`; const email = `shots-${tag}-${n++}@example.test`;
  await p.goto(`${BASE}/${lang}`, { waitUntil: "networkidle" }); await settle(p); await shot(p, `landing-${tag}`);
  // Real scan through the landing form → progress → report.
  for (const [k, v] of Object.entries({ ...BIZ[lang], email })) await p.fill(`form input[name=${k}]`, v);
  // Mock scans return in ~100ms; hold the real response 5s so the progress screen can be captured mid-scan.
  await p.route("**/api/scan", async (r) => { await new Promise((ok) => setTimeout(ok, 5000)); await r.continue(); });
  await p.click("form button"); await p.waitForURL(/\/scan$/); await p.waitForTimeout(2400); await shot(p, `scan-${tag}`);
  await p.waitForURL(/\/r\//, { timeout: 30000 }); await p.waitForLoadState("networkidle"); await settle(p); await shot(p, `report-${tag}`);
  for (const [n2, u] of [["report-sample", "/report"], ["checkout-pro", "/checkout?plan=pro"], ["legal-terms", "/legal/terms"], ["scan-form", "/scan"]]) { await p.goto(`${BASE}/${lang}${u}`, { waitUntil: "networkidle" }); await settle(p); await shot(p, `${n2}-${tag}`); }
  await p.goto(`${BASE}/${lang}#pricing`, { waitUntil: "networkidle" }); await settle(p); { const el = p.locator("#pricing"); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500); const f = path.join(OUT, `pricing-${tag}.png`); await el.screenshot({ path: f }); console.log(f); }
  await p.goto(`${BASE}/${lang}/login`, { waitUntil: "networkidle" }); await p.waitForTimeout(800); await shot(p, `login-${tag}`);
  // Upgrade (mock payment) so the dashboard shows re-scan + history, then sign in through a real magic link.
  const co = await (await post("/api/checkout", { plan: "starter", email })).json(); const acct = new URL(BASE + co.redirectUrl).searchParams.get("account");
  await fetch(`${BASE}/billing/return?Valid=1&Token=tok&Identifier=${encodeURIComponent(acct)}`);
  await p.goto(await magicLinkFor(email), { waitUntil: "networkidle" }); await p.waitForSelector("text=" + (lang === "he" ? "הדשבורד שלך" : "Your dashboard"));
  await p.click(lang === "he" ? "text=סרוק מחדש" : "text=Re-scan now"); await p.waitForURL(/\/r\//); await p.goBack(); await p.waitForLoadState("networkidle");
  await settle(p); await shot(p, `dashboard-${tag}`);
  await ctx.close();
}
await browser.close(); console.log("done");
