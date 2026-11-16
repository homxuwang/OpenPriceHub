import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const base = process.env.API_TEST_URL || "http://127.0.0.1:8787";
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname),
  "This write-enabled QA script only targets a local database.",
);
const key =
  process.env.TEST_ADMIN_KEY ||
  readFileSync(".dev.vars", "utf8").match(/^ADMIN_KEY=(.+)$/m)?.[1];
assert.ok(key, "Local admin key required");
let checks = 0;
async function api(path, method = "GET", body, auth = false) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { "X-Admin-Key": key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, body: await r.json() };
}
let r = await api("/api/catalog");
assert.equal(r.status, 200);
assert.equal(r.body.data.storage, "database");
const catalog = r.body.data.catalog;
checks++;
r = await api("/api/catalog/admin");
assert.equal(r.status, 401);
checks++;
r = await api("/api/catalog/products/flux-schnell/alternatives");
assert.equal(r.body.data.relationships.length, 0);
r = await api(
  "/api/catalog/products/flux-schnell/alternatives?direction=incoming",
);
assert.equal(r.body.data.relationships[0].original, "midjourney");
checks++;
for (const p of ["/api/platforms", "/api/models", "/api/prices"]) {
  r = await api(p);
  assert.equal(r.status, 200, p);
  assert.equal(r.body.success, true, p);
  checks++;
}
r = await api("/api/catalog/admin", "GET", undefined, true);
assert.equal(r.status, 200);
const before = r.body.data.history.length;
checks++;
r = await api("/api/catalog/admin/validate", "POST", catalog, true);
assert.equal(r.status, 200);
checks++;
const bad = structuredClone(catalog);
bad.products[0].plans[0].amount = -1;
r = await api("/api/catalog/admin/publish", "POST", bad, true);
assert.equal(r.status, 400);
checks++;
r = await api("/api/catalog/admin/publish", "POST", catalog, true);
assert.equal(r.status, 200, JSON.stringify(r.body));
checks++;
r = await api("/api/catalog/admin", "GET", undefined, true);
assert.equal(
  r.body.data.history.length,
  before,
  "Identical prices must not create fake price changes",
);
assert.equal(r.body.data.logs[0].status, "published");
checks++;
r = await api("/api/catalog/submissions", "POST", {
  productName: "[QA] Workflow verification — not a real price",
  sourceUrl: "https://example.com/qa",
  notes: "Automated local workflow test. Reject this record; never publish.",
});
assert.equal(r.status, 200);
const id = r.body.data.id;
checks++;
r = await api(
  "/api/catalog/admin/review",
  "POST",
  { id, status: "rejected", notes: "Automated local verification." },
  true,
);
assert.equal(r.status, 200);
checks++;
r = await api(
  "/api/catalog/admin/review",
  "POST",
  { id, status: "reviewed" },
  true,
);
assert.equal(r.status, 409);
checks++;
r = await api("/api/catalog/submissions", "POST", {
  productName: "Invalid",
  sourceUrl: "javascript:alert(1)",
});
assert.equal(r.status, 400);
checks++;
for (const path of [
  "/alternatives/elevenlabs",
  "/compare/elevenlabs-vs-cartesia",
  "/category/ai-music",
]) {
  const resp = await fetch(base + path);
  const html = await resp.text();
  assert.equal(resp.status, 200);
  assert.match(html, /BreadcrumbList/);
  assert.match(html, /id="root"><main>/);
  assert.match(html, /\/assets\/index-[^" ]+\.js/);
  checks++;
}
const missing = await fetch(base + "/tools/missing");
assert.equal(missing.status, 404);
assert.equal(missing.headers.get("X-Robots-Tag"), "noindex, follow");
checks++;
const bot = await fetch(base + "/alternatives/elevenlabs", {
  headers: { "User-Agent": "Googlebot" },
});
const human = await fetch(base + "/alternatives/elevenlabs");
assert.equal(await bot.text(), await human.text());
checks++;
console.log(
  JSON.stringify({
    checks,
    status: "passed",
    note: "Published identical local catalog; QA submission rejected. No production DB touched.",
  }),
);
