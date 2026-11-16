import type { Catalog, Product } from "./types";
import { CATEGORIES, PRICING_MODELS } from "./types";
import {
  alternativeRelations,
  categoryOf,
  filterCatalog,
  matchingPlans,
  planPrice,
} from "./logic";
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  noindex: boolean;
  status: number;
  lang: string;
  path: string;
  products: Product[];
  schema: Record<string, unknown>[];
}
export function pageMeta(
  c: Catalog,
  pathname: string,
  search = "",
  origin = "https://ai-price-compare.pages.dev",
): PageMeta {
  const zh = pathname === "/zh" || pathname.startsWith("/zh/");
  const path =
    pathname.replace(/^\/(zh|en)(?=\/|$)/, "").replace(/\/$/, "") || "/";
  const normalized = path === "/category/ai-tts" ? "/category/ai-voice" : path;
  const canonical =
    origin.replace(/\/$/, "") +
    (zh ? "/zh" : "") +
    (normalized === "/" ? (zh ? "" : "/en") : normalized);
  let title = "Find Better AI Tools. Spend Less. | OpenPriceHub",
    description =
      "Compare AI tools, discover cheaper alternatives and calculate your real creation costs.",
    noindex = !!search,
    status = normalized.split("/").filter(Boolean).length > 2 ? 404 : 200,
    products = c.products.filter((p) => p.status === "verified");
  const [section, slug] = normalized.slice(1).split("/");
  if (section === "tools" && slug) {
    const p = c.products.find((p) => p.slug === slug);
    if (p) {
      products = [p];
      title = `${p.name} Pricing, Plans & Alternatives | OpenPriceHub`;
      description = `${p.summary} Review verified offers, billing conditions and official sources. Find alternatives to ${p.name}.`;
      noindex ||= p.status !== "verified";
    } else status = 404;
  } else if (section === "category") {
    const cat = categoryOf(slug);
    if (cat) {
      title = `${cat.en} Prices & Affordable Alternatives | OpenPriceHub`;
      description = `Compare ${cat.en.toLowerCase()} tools by published pricing model, free allowance and compatible unit costs.`;
      products = products.filter((p) => p.category === cat.id);
    } else status = 404;
  } else if (section === "pricing") {
    if (Object.hasOwn(PRICING_MODELS, slug || "")) {
      const label = PRICING_MODELS[slug as keyof typeof PRICING_MODELS];
      title = `${label} AI Tools & Pricing | OpenPriceHub`;
      description = `Explore AI creation plans offering ${label.toLowerCase()} billing. Check allowances, limitations and official price sources.`;
      products = filterCatalog(c, { pricing: [slug] }).map((p) => ({
        ...p,
        plans: matchingPlans(p, { pricing: [slug] }),
      }));
      noindex ||= !products.length;
    } else status = 404;
  } else if (section === "alternatives" && slug) {
    const p = c.products.find((p) => p.slug === slug);
    if (p) {
      const rel = alternativeRelations(c, p.id);
      products = [
        p,
        ...rel.map((a) => c.products.find((x) => x.id === a.alternative)!),
      ];
      title = `Cheaper Alternatives to ${p.name} | OpenPriceHub`;
      description = `Compare alternatives to ${p.name}, including ${
        products
          .slice(1)
          .map((p) => p.name)
          .join(", ") || "options awaiting verification"
      }. See functional differences, official sources and workload-based savings.`;
      noindex ||= !rel.length || p.status !== "verified";
    } else status = 404;
  } else if (section === "compare" && slug) {
    const pair = slug.split("-vs-");
    products = pair
      .map((id) => c.products.find((p) => p.slug === id))
      .filter((p): p is Product => !!p);
    if (products.length !== 2 || pair.length !== 2) status = 404;
    else {
      title = `${products[0].name} vs ${products[1].name}: Pricing & Costs | OpenPriceHub`;
      description = `Compare ${products[0].name} and ${products[1].name}: plans, billing units, free allowances and functional limits. Estimate costs for your own workload.`;
      noindex ||= !c.alternatives.some(
        (a) =>
          a.original === pair[0] &&
          a.alternative === pair[1] &&
          a.status === "verified",
      );
    }
  } else if (section === "calculator" && slug) {
    const cat = categoryOf(slug);
    if (cat) {
      title = `${cat.en} Cost Calculator | OpenPriceHub`;
      description = `Estimate ${cat.en.toLowerCase()} costs across verified offers. Select models, plans and monthly usage; see incompatible conditions before comparing savings.`;
      products = products.filter((p) => p.category === cat.id);
    } else status = 404;
  } else if (normalized === "/tools") {
    title = "AI Tools Pricing Directory | OpenPriceHub";
    const query = new URLSearchParams(search);
    if (
      query.get("dataset") === "legacy" ||
      query.get("category") === "llm-api"
    ) {
      title = "Original Tool Directory (Demo) | OpenPriceHub";
      products = [];
      noindex = true;
    }
    description =
      "Search image, video, voice and music tools by provider, model, capability and verified pricing.";
  } else if (normalized === "/alternatives") {
    title = "Affordable AI Alternatives | OpenPriceHub";
    description =
      "Find cheaper alternatives to the AI tools you use, with documented feature differences and official pricing sources.";
  } else if (["/about", "/guides"].includes(normalized)) {
    products = [];
    title = "Price Verification & Comparison Methodology | OpenPriceHub";
    description =
      "How OpenPriceHub verifies sources, separates billing units and explains alternatives without invented quality or popularity scores.";
  } else if (
    [
      "/calculator",
      "/manual-compare",
      "/submit",
      "/admin",
      "/compare",
    ].includes(normalized)
  ) {
    title = `${({ "/calculator": "Manual Cost Workspace", "/manual-compare": "Manual Cost Workspace", "/submit": "Submit a Price Source", "/admin": "Data Management", "/compare": "Compare AI Tools" } as Record<string, string>)[normalized]} | OpenPriceHub`;
    noindex = true;
    products = [];
  } else if (normalized !== "/") status = 404;
  if (status === 404) {
    title = "Page Not Found | OpenPriceHub";
    description = "This page is not in the OpenPriceHub catalog.";
    products = [];
    noindex = true;
  }
  if (zh) {
    title = title
      .replace("Pricing, Plans & Alternatives", "价格、套餐与平替")
      .replace("Prices & Affordable Alternatives", "价格与低价平替")
      .replace("Cost Calculator", "成本计算器");
    description = "AI 工具价格决策平台。" + description;
  }
  const schema: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "OpenPriceHub",
          item: origin + (zh ? "/zh" : "/"),
        },
        ...(normalized === "/"
          ? []
          : [
              {
                "@type": "ListItem",
                position: 2,
                name: title.split(" | ")[0],
                item: canonical,
              },
            ]),
      ],
    },
  ];
  if (section === "tools" && slug && products.length === 1 && status === 200) {
    const p = products[0];
    schema.push({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: p.name,
      description: p.summary,
      url: canonical,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      publisher: { "@type": "Organization", name: p.provider },
    });
  } else if (products.length)
    schema.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.name,
        url: origin + (zh ? "/zh" : "") + "/tools/" + p.slug,
      })),
    });
  return {
    title,
    description,
    canonical,
    noindex,
    status,
    lang: zh ? "zh-CN" : "en",
    path: normalized,
    products,
    schema,
  };
}
export function indexablePaths(c: Catalog) {
  const paths = [
    "/",
    "/tools",
    "/alternatives",
    "/about",
    ...CATEGORIES.map((c) => "/category/" + c.slug),
    ...CATEGORIES.map((c) => "/calculator/" + c.id),
    ...Object.keys(PRICING_MODELS).map((p) => "/pricing/" + p),
    ...c.products.map((p) => "/tools/" + p.slug),
    ...c.products.map((p) => "/alternatives/" + p.slug),
    ...c.alternatives.map((a) => `/compare/${a.original}-vs-${a.alternative}`),
  ];
  return [...new Set(paths)].filter(
    (p) => !pageMeta(c, p).noindex && pageMeta(c, p).status === 200,
  );
}
export function sitemapXML(c: Catalog, origin: string) {
  const paths = indexablePaths(c).flatMap((p) => [
    p === "/" ? "/en" : p,
    p === "/" ? "/zh" : "/zh" + p,
  ]);
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${escapeHtml(origin.replace(/\/$/, "") + p)}</loc></url>`).join("")}</urlset>`;
}
export function renderHead(meta: PageMeta) {
  return `<meta name="oph-site-origin" content="${escapeHtml(new URL(meta.canonical).origin)}"><title>${escapeHtml(meta.title)}</title><meta name="description" content="${escapeHtml(meta.description)}"><meta name="robots" content="${meta.noindex ? "noindex, follow" : "index, follow"}"><link rel="canonical" href="${escapeHtml(meta.canonical)}"><meta property="og:title" content="${escapeHtml(meta.title)}"><meta property="og:description" content="${escapeHtml(meta.description)}"><meta property="og:url" content="${escapeHtml(meta.canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="OpenPriceHub"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(meta.title)}"><meta name="twitter:description" content="${escapeHtml(meta.description)}"><script id="oph-schema" type="application/ld+json">${JSON.stringify(meta.schema).replace(/</g, "\\u003c")}</script>`;
}
export function renderContent(c: Catalog, meta: PageMeta) {
  const zh = meta.lang === "zh-CN",
    prefix = zh ? "/zh" : "";
  const a = (path: string, name: string) =>
    `<a href="${escapeHtml(prefix + path)}">${escapeHtml(name)}</a>`;
  const rows = meta.products
    .map(
      (p) =>
        `<article><h2>${a("/tools/" + p.slug, p.name)}</h2><p>${escapeHtml(zh ? p.summaryZh : p.summary)}</p><ul>${p.plans
          .filter((x) => x.status === "verified")
          .map(
            (plan) =>
              `<li>${escapeHtml(plan.name)}: ${escapeHtml(planPrice(plan))}; ${escapeHtml(plan.freeAllowance)} ${escapeHtml(plan.limits.join(" "))}</li>`,
          )
          .join(
            "",
          )}</ul><p>${escapeHtml(p.features.join(", "))}</p><p>Verified: ${escapeHtml(p.verifiedAt || "pending")}</p><a href="${escapeHtml(p.website)}">Official platform</a> ${a("/alternatives/" + p.slug, "Affordable Alternatives")}</article>`,
    )
    .join("");
  const original = meta.path.startsWith("/alternatives/")
    ? meta.products[0]
    : null;
  const relationships = original
    ? alternativeRelations(c, original.id)
        .map(
          (r) =>
            `<section><h2>${escapeHtml(c.products.find((p) => p.id === r.alternative)?.name || "")}</h2><p>${escapeHtml(r.reason)}</p><p>${escapeHtml(r.difference)}</p><p>${escapeHtml(r.scenario)}</p><p>${escapeHtml(r.priceAdvantage)}</p></section>`,
        )
        .join("")
    : "";
  const sourceIds = new Set(meta.products.flatMap((p) => p.sourceIds));
  const sources = c.sources
    .filter((s) => sourceIds.has(s.id))
    .map(
      (s) =>
        `<li><a href="${escapeHtml(s.url)}">${escapeHtml(s.title)}</a> — ${escapeHtml(s.checkedAt)}</li>`,
    )
    .join("");
  return `<main><nav>${a("/", "OpenPriceHub")} · ${a("/tools", "Products")} · ${a("/alternatives", "Affordable Alternatives")}</nav><h1>${escapeHtml(meta.title.split(" | ")[0])}</h1><p>${escapeHtml(meta.description)}</p>${rows}${relationships}${meta.path === "/about" || meta.path === "/guides" ? "<section><h2>Independent comparison methodology</h2><p>Verified prices link to official sources with review dates. Unknown prices are never treated as free. Monthly, annual, per-output and per-character fees stay in separate comparison groups.</p><p>Alternatives are directional assessments of documented capabilities, not quality scores. Affiliate commission cannot affect calculations or rankings. Annual averages show the upfront commitment; unverified overage fees and unsupported unit conversions are not estimated.</p></section>" : ""}${sources ? `<h2>Official sources</h2><ul>${sources}</ul>` : ""}<p>Pricing units and plan conditions must match before savings can be compared. No quality or popularity scores are inferred.</p></main>`;
}
export function renderDocument(template: string, c: Catalog, meta: PageMeta) {
  return template
    .replace(/<html[^>]*>/, `<html lang="${meta.lang}">`)
    .replace(
      /<!--oph-head-->[\s\S]*?<!--\/oph-head-->/,
      `<!--oph-head-->${renderHead(meta)}<!--/oph-head-->`,
    )
    .replace(
      /<!--oph-content-->[\s\S]*?<!--\/oph-content-->/,
      `<!--oph-content--><div id="root">${renderContent(c, meta)}</div><!--/oph-content-->`,
    );
}
