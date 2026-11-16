const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let checks = 0;
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/zh",
      "/zh/tools",
      "/zh/compare/tts",
      "/zh/compare/music",
      "/en/compare/tts",
      "/zh/calculator",
    ]) {
      await page.goto(base + route);
      await page.locator("h1").waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        route,
      );
      checks++;
    }
  }
  await page.goto(base + "/en/compare/tts");
  const a = page.getByRole("region", { name: "Plan 1", exact: true }),
    b = page.getByRole("region", { name: "Plan 2", exact: true });
  await a.getByLabel("Unit price", { exact: true }).fill("0.02");
  await b.getByLabel("Unit price", { exact: true }).fill("10");
  await b
    .getByLabel("Units per unit-price charge", { exact: true })
    .selectOption("1000000");
  assert.match(await page.locator("article").nth(0).innerText(), /\$2/);
  assert.match(await page.locator("article").nth(1).innerText(), /50\.0%/);
  checks++;
  await b.getByLabel("Billing currency", { exact: true }).selectOption("CNY");
  assert.match(
    await page.locator("article").nth(1).innerText(),
    /currency differ/,
  );
  checks++;
  await page.goto(base + "/en/compare/music");
  const m = page.getByRole("region", { name: "Plan 1", exact: true });
  await m.getByLabel("Pricing model", { exact: true }).selectOption("package");
  await m.getByLabel("Price per package", { exact: true }).fill("5");
  await m.getByLabel("Included units per package", { exact: true }).fill("3");
  assert.match(await page.locator("article").first().innerText(), /\$20/);
  checks++;
  await page.getByRole("button", { name: /Add comparison plan/ }).click();
  assert.equal(await page.locator("article").count(), 3);
  checks++;
  await m.getByLabel("Pricing model", { exact: true }).selectOption("monthly");
  await m.getByLabel("Included units per month", { exact: true }).fill("3");
  assert.match(
    await page.locator("article").first().innerText(),
    /overage terms are required/,
  );
  checks++;
  await page.goto(base + "/zh/tools");
  await page.getByRole("button", { name: "TTS 语音", exact: true }).click();
  assert.match(await page.locator("h1").innerText(), /TTS/);
  checks++;
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors }));
} finally {
  await browser.close();
}
