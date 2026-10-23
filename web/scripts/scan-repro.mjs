// Repro of /<lang>/scan end to end. MODE=live: stops at the form (dummy email; Turnstile cannot be solved headless).
// MODE=local: full flow against a local server. Logs what the user sees at each step.
import { chromium } from "playwright"; import fs from "node:fs"; import path from "node:path";
const BASE = process.env.BASE; const OUT = path.resolve(process.env.OUT || "../../screenshots/ranky/scan-repro"); const TAG = process.env.TAG || "run"; fs.mkdirSync(OUT, { recursive: true });
const EMAIL = process.env.EMAIL || "test+repro@example.com"; const SOLVE = process.env.SOLVE === "1";
const browser = await chromium.launch(); const log = (...a) => console.log(...a);
for (const lang of (process.env.LANGS || "he,en").split(",")) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: lang === "he" ? "he-IL" : "en-US" }); const p = await ctx.newPage(); const net = [];
  p.on("response", r => { if (r.url().includes("/api/")) net.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  const shot = async n => { const f = path.join(OUT, `${TAG}-${lang}-${n}.png`); try { await p.screenshot({ path: f, fullPage: true, timeout: 60000, animations: "disabled" }); log("  shot", f); } catch (e) { log("  shot failed", n, String(e.message).split("\n")[0]); } };
  const body = async () => (await p.innerText("body")).replace(/\s+/g, " ").slice(0, 700);
  log(`== ${lang} ${BASE}`); await p.goto(`${BASE}/${lang}/scan`, { waitUntil: "load" }); await p.waitForTimeout(4000); await shot("1-form");
  log("  turnstile widget:", await p.locator('[data-testid=turnstile]').count(), "iframe:", await p.locator('iframe[src*="challenges.cloudflare"]').count());
  log("  form text:", await body());
  const biz = lang === "he" ? { name: "אינסטלציה בדיקה", website: "", category: "אינסטלטור", city: "תל אביב-יפו" } : { name: "Repro Plumbing", website: "", category: "Plumber", city: "Austin, TX" };
  for (const [k, v] of Object.entries({ ...biz, email: EMAIL })) { const el = p.locator(`form input[name=${k}], form select[name=${k}]`).first(); if (await el.count()) await el.fill(v); }
  if (SOLVE) { await p.waitForFunction(() => document.querySelector('input[name="cf-turnstile-response"]')?.value, null, { timeout: 20000 }).catch(() => log("  (turnstile token never appeared)")); }
  await p.locator("form button").last().click(); await p.waitForTimeout(2500); await shot("2-after-submit"); log("  url:", p.url()); log("  after submit:", await body());
  if (process.env.FULL === "1") { await p.waitForURL(/\/r\//, { timeout: 90000 }).catch(() => log("  (no redirect to report)")); await p.waitForTimeout(2500); await shot("3-report"); log("  url:", p.url()); log("  report text:", await body()); }
  log("  api calls:", net.join(" | ")); await ctx.close();
}
await browser.close();
