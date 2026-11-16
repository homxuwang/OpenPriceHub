import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.TEST_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];
let checks = 0;
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/en");
  await page.locator("h1").waitFor();
  assert.match(await page.locator("h1").innerText(), /Find Better AI Tools/);
  assert.equal(await page.locator("header a svg").count(), 1, "Original logo");
  assert.equal(
    await page.locator('main a.card[style*="border-top-width"]').count(),
    4,
    "Original scene cards extended to four",
  );
  assert.equal(
    await page.locator("main section.border-primary-100").count(),
    1,
    "Original calculator banner",
  );
  assert.equal(
    await page.locator("main").getByText("Kling AI (web)").count(),
    0,
  );
  await page.screenshot({
    path: "/tmp/oph-incremental-desktop.png",
    fullPage: false,
  });
  checks++;
  await page.getByRole("button", { name: "AI Tools", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "AI Voice & TTS", exact: true })
    .click();
  await page.waitForURL("**/category/ai-voice");
  checks++;
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  assert.ok((await page.locator("main .card").count()) >= 3);
  await page.getByRole("button", { name: "Table", exact: true }).click();
  assert.equal(await page.locator("main table").count(), 1);
  checks++;
  await page.goto(base + "/en/tools?category=llm-api");
  await page.getByRole("button", { name: "Developers", exact: true }).click();
  await page
    .getByRole("button", { name: "Global access", exact: true })
    .click();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  assert.ok((await page.locator("tbody tr").count()) > 0);
  assert.match(
    await page.locator("main").innerText(),
    /Original directory demo/,
  );
  checks++;
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  assert.ok((await page.locator("main .card").count()) > 0);
  checks++;
  await page.goto(base + "/en/calculator");
  await page.getByRole("button", { name: "Load sample", exact: true }).click();
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() =>
    localStorage.getItem("oph.detailed-compare.v1"),
  );
  assert.ok(JSON.parse(saved).platforms.length > 0);
  await page.goto(base + "/en/tools");
  await page.goto(base + "/en/calculator");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("oph.detailed-compare.v1")),
    saved,
  );
  checks++;
  await page.getByRole("button", { name: /^Quick comparison/ }).click();
  await page.getByRole("button", { name: "Load sample", exact: true }).click();
  await page.waitForTimeout(400);
  assert.ok(
    await page.evaluate(() => localStorage.getItem("oph.manual-compare.v1")),
  );
  checks++;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/en/category/ai-voice");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByLabel("Price basis · USD", { exact: true })
    .selectOption("monthly");
  await page
    .getByRole("button", { name: "Apply / close", exact: true })
    .click();
  assert.match(await page.locator("tbody").innerText(), /Cartesia/);
  assert.doesNotMatch(await page.locator("tbody").innerText(), /Google Cloud/);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  checks++;
  await page.goto(base + "/zh");
  await page.screenshot({
    path: "/tmp/oph-incremental-mobile.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "菜单", exact: true }).click();
  assert.ok(
    await page.getByRole("link", { name: "低价平替", exact: true }).isVisible(),
  );
  checks++;
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors }));
} finally {
  await browser.close();
}
