import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "vite";
const buildEnv = loadEnv("production", process.cwd(), "");
import { bundledCatalog } from "../src/shared/catalog/logic";
import {
  indexablePaths,
  pageMeta,
  renderDocument,
  sitemapXML,
} from "../src/shared/catalog/seo";
const origin =
  process.env.SITE_URL ||
  process.env.VITE_SITE_URL ||
  buildEnv.SITE_URL ||
  buildEnv.VITE_SITE_URL ||
  "https://ai-price-compare.pages.dev";
const template = readFileSync("dist/index.html", "utf8");
const paths = indexablePaths(bundledCatalog).flatMap((p) => [
  p === "/" ? "/en" : p,
  p === "/" ? "/zh" : "/zh" + p,
]);
for (const path of paths) {
  const dir = resolve("dist", "." + path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, "index.html"),
    renderDocument(
      template,
      bundledCatalog,
      pageMeta(bundledCatalog, path, "", origin),
    ),
  );
}
writeFileSync(
  "dist/404.html",
  renderDocument(
    template,
    bundledCatalog,
    pageMeta(bundledCatalog, "/not-found", "", origin),
  ),
);
writeFileSync("dist/sitemap.xml", sitemapXML(bundledCatalog, origin));
writeFileSync(
  "dist/robots.txt",
  `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /zh/admin\nSitemap: ${origin}/sitemap.xml\n`,
);
console.log(
  `Prerendered ${paths.length} useful pages with hashed assets, metadata and official sources.`,
);
