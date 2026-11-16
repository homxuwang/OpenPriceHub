import { describe, it, expect } from "vitest";
import {
  alternativeRelations,
  bundledCatalog as catalog,
  estimate,
  filterCatalog,
  metric,
  savings,
  validateCatalog,
  startingPlan,
  supportsPlanFeature,
  type Usage,
} from "../src/shared/catalog/logic";
import {
  indexablePaths,
  pageMeta,
  renderDocument,
  sitemapXML,
} from "../src/shared/catalog/seo";
import { catalogStatements } from "../src/shared/catalog/persistence";
const product = (id: string) => catalog.products.find((p) => p.id === id)!;
const plan = (id: string) =>
  catalog.products.flatMap((p) => p.plans).find((p) => p.id === id)!;
const usage: Usage = {
  category: "voice",
  quantity: 10,
  seconds: 5,
  characters: 20000,
  minutes: 10,
  voiceUnit: "characters",
  resolution: "",
  quality: "",
};
const calc = (id: string, patch: Partial<Usage> = {}) => {
  const p = plan(id);
  return estimate(p, p.components[0], { ...usage, ...patch });
};
describe("verified catalog", () => {
  it("has consistent evidence and unique IDs", () =>
    expect(validateCatalog(catalog)).toEqual([]));
  it("rejects a verified record without a source", () => {
    const c = structuredClone(catalog);
    c.products[0].sourceIds = [];
    expect(validateCatalog(c).join()).toMatch(/evidence/);
  });
  it("rejects a negative price", () => {
    const c = structuredClone(catalog);
    c.products[0].plans[0].amount = -1;
    expect(validateCatalog(c).join()).toMatch(/price/);
  });
  it("rejects unsafe official links", () => {
    const c = structuredClone(catalog);
    c.products[0].website = "javascript:alert(1)";
    expect(validateCatalog(c).join()).toMatch(/product/);
  });
  it("does not publish pending prices", () =>
    expect(
      filterCatalog(catalog, { basis: "monthly" }).map((p) => p.id),
    ).not.toContain("kling-ai"));
  it("does not create reverse recommendations implicitly", () => {
    expect(alternativeRelations(catalog, "flux-schnell")).toHaveLength(0);
    expect(
      alternativeRelations(catalog, "flux-schnell", "incoming")[0].original,
    ).toBe("midjourney");
  });
  it("rejects unsupported claimed feature matches", () => {
    const c = structuredClone(catalog);
    c.alternatives[0].featureMatch = ["voice-cloning"];
    expect(validateCatalog(c).join()).toMatch(/relationship/);
  });
});
describe("search and pricing filters", () => {
  it("matches one-character typo", () =>
    expect(
      filterCatalog(catalog, { q: "Elevenlab" }).some(
        (p) => p.id === "elevenlabs",
      ),
    ).toBe(true));
  it("searches model and provider names", () =>
    expect(
      filterCatalog(catalog, { q: "Black Forest" }).map((p) => p.id),
    ).toContain("flux-schnell"));
  it("searches alternative origin names", () =>
    expect(
      filterCatalog(catalog, { q: "Midjourney" }).map((p) => p.id),
    ).toContain("flux-schnell"));
  it("keeps categories separate from pricing models", () =>
    expect(
      filterCatalog(catalog, { category: "voice", pricing: ["monthly"] }).map(
        (p) => p.id,
      ),
    ).toEqual(["cartesia", "elevenlabs"]));
  it("supports multiple pricing models on one plan", () =>
    expect(plan("eleven-starter").pricingModels).toEqual([
      "monthly",
      "credit-based",
    ]));
  it("monthly prices do not include free, annual or payg amounts", () => {
    expect(metric(plan("flux-payg"), "monthly")).toBeNull();
    expect(metric(plan("mj-basic-year"), "monthly")).toBeNull();
    expect(metric(plan("eleven-free"), "monthly")).toBeNull();
  });
  it("never sorts vendor credits as a universal unit", () =>
    expect(metric(plan("eleven-starter"), "credit")).toBeNull());
  it("normalizes character price to the stated million-character basis", () =>
    expect(metric(plan("google-standard"), "characters")).toBe(4));
  it("requires a price basis for price range filtering", () =>
    expect(filterCatalog(catalog, { range: "under-10" })).toEqual([]));
  it("sorts only matching monthly offers", () =>
    expect(
      filterCatalog(catalog, { basis: "monthly", sort: "price" }).map(
        (p) => p.id,
      ),
    ).toEqual([
      "cartesia",
      "elevenlabs",
      "midjourney",
      "stable-audio",
      "runway",
    ]));
  it("honors exact price band boundaries", () => {
    const ids = filterCatalog(catalog, {
      basis: "monthly",
      range: "under-10",
    }).map((p) => p.id);
    expect(ids).toContain("cartesia");
    expect(ids).not.toContain("midjourney");
  });
  it("free-allowance filter includes metered free allowance", () =>
    expect(filterCatalog(catalog, { free: true }).map((p) => p.id)).toContain(
      "google-cloud-tts",
    ));
  it("ignores affiliate commission in ordering", () => {
    const before = filterCatalog(catalog, {
      basis: "monthly",
      sort: "price",
    }).map((p) => p.id);
    const c = structuredClone(catalog);
    (c.products[0] as any).affiliateCommission = 1000000;
    expect(
      filterCatalog(c, { basis: "monthly", sort: "price" }).map((p) => p.id),
    ).toEqual(before);
  });
});
describe("cost calculation and savings", () => {
  it("computes per-image API cost", () =>
    expect(
      calc("flux-payg", { category: "image", quantity: 100 }).monthly,
    ).toBeCloseTo(0.3));
  it("does not convert GPU minutes to image counts", () =>
    expect(calc("mj-basic", { category: "image" }).valid).toBe(false));
  it("computes published video rate and duration", () =>
    expect(
      calc("kling-standard", {
        category: "video",
        quantity: 10,
        seconds: 5,
        resolution: "720p",
      }).monthly,
    ).toBe(2.5));
  it("rejects unsupported video duration", () =>
    expect(
      calc("kling-standard", { category: "video", seconds: 7 }).valid,
    ).toBe(false));
  it("rejects unsupported resolution instead of silently choosing a cheaper one", () =>
    expect(
      calc("kling-standard", { category: "video", resolution: "1080p" }).valid,
    ).toBe(false));
  it("deducts character allowance before payg charges", () =>
    expect(calc("google-standard", { characters: 5000000 }).monthly).toBe(4));
  it("supports zero usage while retaining subscription commitment", () =>
    expect(calc("eleven-starter", { characters: 0 }).monthly).toBe(6));
  it("does not invent overage price", () =>
    expect(calc("eleven-starter", { characters: 30001 }).valid).toBe(false));
  it("cannot convert speech minutes to characters", () =>
    expect(calc("google-standard", { voiceUnit: "minute" }).valid).toBe(false));
  it("reports annual upfront and monthly average separately", () => {
    const r = calc("eleven-year");
    expect(r.monthly).toBe(5);
    expect(r.upfront).toBe(60);
  });
  it("computes savings only with valid comparable results", () => {
    const r = savings(calc("eleven-starter"), calc("cartesia-pro"));
    expect(r?.amount).toBe(1);
    expect(r?.percent).toBeCloseTo(16.6667, 3);
  });
  it("does not divide by zero for a free baseline", () =>
    expect(
      savings(calc("google-standard"), calc("cartesia-pro"))?.percent,
    ).toBeNull());
  it("rejects different currencies", () => {
    const a = calc("eleven-starter");
    expect(savings(a, { ...a, currency: "EUR" })).toBeNull();
  });
  it("rounds Suno songs to complete pairs", () => {
    const p = plan("suno-pro-annual");
    const c = { ...p.components[0], creditAllowance: 10 };
    expect(
      estimate(p, c, { ...usage, category: "music", quantity: 3, seconds: 0 })
        .valid,
    ).toBe(false);
  });
  it("cannot compare songs with generation requests", () => {
    const a = calc("suno-pro-annual", {
      category: "music",
      quantity: 10,
      seconds: 0,
    });
    const b = calc("stable-entry", {
      category: "music",
      quantity: 10,
      seconds: 0,
      creditsPerOutput: 4,
    });
    expect(a.valid).toBe(true);
    expect(b.valid).toBe(true);
    expect(savings(a, b)).toBeNull();
  });
  it("marks user-provided consumption as conditional", () =>
    expect(
      calc("stable-entry", {
        category: "music",
        seconds: 120,
        creditsPerOutput: 4,
      }).assumptions.join(),
    ).toMatch(/your actual/));
  it("rejects unspecified vendor duration limits when duration is required", () =>
    expect(
      calc("suno-pro-annual", { category: "music", seconds: 120 }).valid,
    ).toBe(false));
  it("rejects negative, infinite and fractional output quantities", () => {
    for (const quantity of [-1, Infinity, 1.5])
      expect(calc("flux-payg", { category: "image", quantity }).valid).toBe(
        false,
      );
  });
  it("does not aggregate a daily quota into a monthly pool", () => {
    const p = plan("cartesia-free");
    expect(
      estimate(p, { ...p.components[0], allowancePeriod: "day" }, usage).valid,
    ).toBe(false);
  });
});
describe("SEO and publication", () => {
  it("excludes pending and empty alternative pages from sitemap", () => {
    const paths = indexablePaths(catalog);
    expect(paths).not.toContain("/tools/kling-ai");
    expect(paths).not.toContain("/alternatives/stable-audio");
    expect(paths).toContain("/alternatives/elevenlabs");
  });
  it("uses canonical and noindex for filtered combinations", () => {
    const m = pageMeta(
      catalog,
      "/category/ai-voice",
      "?pricing=monthly",
      "https://example.com",
    );
    expect(m.noindex).toBe(true);
    expect(m.canonical).toBe("https://example.com/category/ai-voice");
  });
  it("canonicalizes TTS alias and English prefix", () =>
    expect(
      pageMeta(catalog, "/en/category/ai-tts", "", "https://example.com")
        .canonical,
    ).toBe("https://example.com/category/ai-voice"));
  it("returns real missing-page status", () =>
    expect(pageMeta(catalog, "/tools/does-not-exist").status).toBe(404));
  it("rejects arbitrary pair indexing without editorial evidence", () =>
    expect(pageMeta(catalog, "/compare/midjourney-vs-elevenlabs").noindex).toBe(
      true,
    ));
  it("renders content and metadata for humans and crawlers without changing asset names", () => {
    const html = renderDocument(
      '<html><head><!--oph-head--><!--/oph-head--></head><body><!--oph-content--><div id="root"></div><!--/oph-content--><script src="/assets/index-abc123.js"></script></body></html>',
      catalog,
      pageMeta(catalog, "/alternatives/elevenlabs"),
    );
    expect(html).toContain("Cartesia");
    expect(html).toContain("BreadcrumbList");
    expect(html).toContain("/assets/index-abc123.js");
    expect(html).not.toContain("/assets/index.js");
  });
  it("includes bilingual sitemap locations and excludes queries", () => {
    const xml = sitemapXML(catalog, "https://example.com");
    expect(xml).toContain("https://example.com/zh/category/ai-music");
    expect(
      [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].every((m) => !m[1].includes("?")),
    ).toBe(true);
  });
  it("builds parameterized writes without modifying legacy tables", () => {
    const statements = catalogStatements(catalog, "test-revision");
    expect(
      statements.some((s) => s.sql.startsWith("INSERT INTO alternatives")),
    ).toBe(true);
    expect(
      statements.some((s) =>
        /^(DELETE|DROP|UPDATE) (platforms|plans|models|rules)\b/.test(s.sql),
      ),
    ).toBe(false);
    expect(
      statements.every(
        (s) => (s.sql.match(/\?/g) || []).length === s.values.length,
      ),
    ).toBe(true);
  });
});

describe("publication and offer edge cases", () => {
  it("finds the lowest monthly entry even if plans are reordered", () => {
    const p = structuredClone(product("midjourney"));
    p.plans.unshift({ ...p.plans[0], id: "higher-tier", amount: 50 });
    expect(startingPlan(p)?.amount).toBe(10);
  });
  it("rejects incomplete nested records without throwing", () => {
    for (const value of [
      null,
      { products: [null], sources: [], alternatives: [] },
      { ...catalog, products: [{ ...catalog.products[0], plans: [null] }] },
    ]) {
      expect(() => validateCatalog(value)).not.toThrow();
      expect(validateCatalog(value).length).toBeGreaterThan(0);
    }
  });
  it("rejects misleading paid/free labels", () => {
    const c = structuredClone(catalog);
    c.products[0].plans[0].pricingModels.push("free");
    expect(validateCatalog(c).join()).toMatch(/mislabeled as free/);
  });
  it("rejects unsafe or undisclosed affiliate links", () => {
    expect(
      validateCatalog({
        ...catalog,
        affiliateLinks: [
          {
            id: "ad-1",
            productId: "midjourney",
            url: "javascript:alert(1)",
            disclosure: "",
            active: true,
          },
        ],
      }).join(),
    ).toMatch(/affiliate/);
  });
  it("charges a verified credit overage rate instead of inventing one", () => {
    const p = plan("eleven-starter");
    const component = { ...p.components[0], overagePerCredit: 0.001 };
    const r = estimate(p, component, { ...usage, characters: 31000 });
    expect(r.valid).toBe(true);
    expect(r.monthly).toBe(7);
  });
  it("rejects fractional character counts", () => {
    expect(calc("google-standard", { characters: 1.5 }).valid).toBe(false);
  });
});

it("applies no-subscription and commercial filters to the same offer", () => {
  expect(
    filterCatalog(catalog, {
      category: "voice",
      pricing: ["monthly"],
      noSubscription: true,
    }),
  ).toEqual([]);
  expect(
    filterCatalog(catalog, {
      category: "voice",
      commercial: true,
      noSubscription: true,
    }),
  ).toEqual([]);
});

it("does not assume product-level cloning exists on a free plan", () => {
  expect(product("elevenlabs").features).toContain("voice-cloning");
  expect(supportsPlanFeature(plan("eleven-free"), "voice-cloning")).toBe(false);
  expect(supportsPlanFeature(plan("eleven-starter"), "voice-cloning")).toBe(
    true,
  );
});

it("does not index extra path segments as valid product pages", () => {
  expect(pageMeta(catalog, "/tools/elevenlabs/unrecognized").status).toBe(404);
});

describe("incremental UI routing metadata", () => {
  it("indexes the English home without pointing at the Chinese root redirect", () => {
    expect(pageMeta(catalog, "/en", "", "https://example.com").canonical).toBe(
      "https://example.com/en",
    );
    const xml = sitemapXML(catalog, "https://example.com");
    expect(xml).toContain("<loc>https://example.com/en</loc>");
    expect(xml).not.toContain("<loc>https://example.com/</loc>");
  });
  it("never attaches verified catalog products to the preserved demo directory", () => {
    for (const search of ["?dataset=legacy", "?category=llm-api"]) {
      const meta = pageMeta(catalog, "/en/tools", search);
      expect(meta.status).toBe(200);
      expect(meta.noindex).toBe(true);
      expect(meta.products).toEqual([]);
      expect(meta.title).toContain("Demo");
    }
  });
});
