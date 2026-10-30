// Repro of /<lang>/login magic-link form against a local server with Cloudflare test keys.
import { chromium } from "playwright";
const BASE = process.env.BASE, TAG = process.env.TAG || "run", OUT = process.env.OUT || "/workspace/business/screenshots/ranky";
const b = await chromium.launch();
for (const [w, h, n] of [[1280, 900, "desktop"], [390, 844, "390"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: "he-IL" }); const p = await ctx.newPage(); const log = [];
  p.on("console", m => log.push(`console ${m.type()}: ${m.text().slice(0, 200)}`)); p.on("response", r => { if (r.url().includes("/api/")) log.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  p.on("request", r => { if (r.url().includes("/api/login")) log.push("BODY " + (r.postData() || "").replace(/"cf-turnstile-response":"[^"]{12}[^"]*"/, '"cf-turnstile-response":"<tok>"')); });
  await p.goto(`${BASE}/he/login`, { waitUntil: "load" }); await p.waitForTimeout(1500);
  const info = await p.evaluate(() => [...document.querySelectorAll("form")].map(f => ({ inputs: [...f.querySelectorAll("input")].map(i => i.name || i.type), ts: !!f.querySelector("[data-testid=turnstile]") })));
  console.log(n, "forms:", JSON.stringify(info));
  const tok = await p.waitForFunction(() => [...document.querySelectorAll('input[name="cf-turnstile-response"]')].map(i => i.value.length + "@" + (i.closest("form")?.querySelector("input[type=password]") ? "pwform" : "other")).join(","), null, { timeout: 20000 }).then(h => h.jsonValue()).catch(() => "none");
  console.log(n, "token inputs:", tok);
  await p.locator("details.rk-magic summary").click(); await p.waitForFunction(() => document.querySelector("form[data-magic-form] input[name=\"cf-turnstile-response\"]")?.value, null, { timeout: 15000 }).then(() => console.log(n, "magic form token: present")).catch(() => console.log(n, "magic form token: MISSING"));
  await p.locator("form[data-magic-form] input[name=email], details.rk-magic input[name=email]").first().fill("owner-test@example.com");
  await p.screenshot({ path: `${OUT}/owner1-${TAG}-${n}-before.png`, fullPage: true });
  // click the submit of the form that holds the magic-link (no password)
  const forms = p.locator("form"); const cnt = await forms.count(); let mf = p.locator("details.rk-magic form");
  
  await mf.locator("button").last().click(); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/owner1-${TAG}-${n}-after.png`, fullPage: true });
  console.log(n, "page alert/status:", (await p.locator("[role=alert],[role=status]").allInnerTexts()).join(" | ").slice(0, 200)); console.log(n, "after:", (await mf.innerText().catch(() => "(form gone)")).replace(/\s+/g, " ").slice(0, 300));
  console.log(log.join("\n")); await ctx.close();
}
await b.close();
