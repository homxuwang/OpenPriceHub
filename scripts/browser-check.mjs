// Usage: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/browser-check.mjs
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.TEST_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
let checks = 0;
try {
  const routes = [
    "/",
    "/tools",
    "/category/ai-image",
    "/category/ai-video",
    "/category/ai-voice",
    "/category/ai-tts",
    "/category/ai-music",
    "/pricing/monthly",
    "/pricing/annual",
    "/pricing/pay-as-you-go",
    "/pricing/credit-based",
    "/tools/elevenlabs",
    "/tools/kling-ai",
    "/alternatives",
    "/alternatives/elevenlabs",
    "/alternatives/suno",
    "/compare/elevenlabs-vs-cartesia",
    "/calculator/image",
    "/calculator/video",
    "/calculator/voice",
    "/calculator/music",
    "/manual-compare",
    "/submit",
    "/about",
    "/admin",
    "/zh",
    "/zh/category/ai-voice",
  ];
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on("pageerror", (e) =>
      errors.push({ url: page.url(), error: e.message }),
    );
    page.on("console", (m) => {
      if (m.type() === "error")
        errors.push({ url: page.url(), error: m.text() });
    });
    for (const route of routes) {
      await page.goto(base + route, { waitUntil: "networkidle" });
      assert.ok(
        (await page.locator("h1").first().innerText()).length > 0,
        route,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "Overflow " + width + " " + route,
      );
      assert.equal(await page.locator('head link[rel="canonical"]').count(), 1);
      assert.equal(
        await page.locator('head meta[name="description"]').count(),
        1,
      );
      checks++;
    }
    console.log(`Route checks passed at ${width}px: ${routes.length}`);
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.on("pageerror", (e) =>
    errors.push({ url: page.url(), error: e.message }),
  );
  await page.goto(base + "/en", { waitUntil: "networkidle" });
  await page
    .getByRole("searchbox")
    .count()
    .then(async (n) => {
      if (n) await page.getByRole("searchbox").fill("Elevenlab");
      else
        await page
          .getByRole("textbox", { name: "Search products, models or features" })
          .fill("Elevenlab");
    });
  await page
    .getByRole("link")
    .filter({ hasText: "ElevenLabs" })
    .first()
    .click();
  await page.waitForURL("**/tools/elevenlabs");
  assert.match(await page.locator("h1").innerText(), /ElevenLabs/);
  checks++;
  await page.goto(base + "/category/ai-voice", { waitUntil: "networkidle" });
  await page
    .getByLabel("Price basis · USD", { exact: true })
    .selectOption("monthly");
  await page.getByLabel("Sort", { exact: true }).selectOption("price");
  const names = await page
    .locator("tbody tr td:first-child a")
    .allTextContents();
  assert.deepEqual(names, ["Cartesia", "ElevenLabs"]);
  assert.match(await page.locator("tbody").innerText(), /\$5\.00/);
  assert.doesNotMatch(await page.locator("tbody").innerText(), /\$0\.00/);
  checks++;
  await page
    .getByRole("button", { name: "+ Compare", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "+ Compare", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "Compare →", exact: true }).click();
  await page.waitForURL("**/compare?tools=*");
  assert.equal(await page.locator("main article h2").count(), 2);
  checks++;
  await page.goto(base + "/calculator/voice", { waitUntil: "networkidle" });
  assert.match(await page.locator("main").innerText(), /\$6\.00/);
  assert.match(await page.locator("main").innerText(), /16\.7%/);
  await page
    .getByLabel("Required capability", { exact: true })
    .selectOption("voice-cloning");
  assert.match(
    await page.locator("main").innerText(),
    /Required capability is not verified/,
  );
  checks++;
  await page.goto(base + "/tools?pricing=annual", { waitUntil: "networkidle" });
  assert.doesNotMatch(await page.locator("tbody").innerText(), /\$0\.00/);
  assert.equal(
    await page.locator('meta[name="robots"]').getAttribute("content"),
    "noindex, follow",
  );
  checks++;
  await page.goto(base + "/manual-compare", { waitUntil: "networkidle" });
  const before = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("oph.")),
  );
  assert.ok(
    await page
      .getByRole("button", { name: /Quick comparison|简单快速比价/ })
      .count(),
  );
  checks++;
  await page.goto(base + "/zh/category/ai-music", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.waitForURL("**/category/ai-music");
  checks++;
  await page.goto(base + "/does-not-exist", { waitUntil: "networkidle" });
  assert.match(await page.locator("h1").innerText(), /Page not found/);
  assert.equal(
    await page.locator('meta[name="robots"]').getAttribute("content"),
    "noindex, follow",
  );
  checks++;
  console.log(JSON.stringify({ checks, errors, manualStorageKeys: before }));
  assert.deepEqual(errors, []);
  await page.close();
} finally {
  await browser.close();
}
