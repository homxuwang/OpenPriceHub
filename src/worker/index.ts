import { handleWebsites } from "./routes/websites";
import { handlePlatforms } from "./routes/platforms";
import { handleModels } from "./routes/models";
import { handlePrices } from "./routes/prices";
import { handleSubmit } from "./routes/submit";
import { handleAdmin } from "./routes/admin";
import { handleCatalog } from "./routes/catalog";
import type { Env } from "../shared/types";
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleAPI(request, env);
    if (url.pathname === "/")
      return Response.redirect(url.origin + "/zh" + url.search, 302);
    const origin = env.SITE_URL || url.origin;
    if (url.pathname === "/robots.txt")
      return new Response(
        `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /zh/admin\nSitemap: ${origin}/sitemap.xml\n`,
        { headers: { "Content-Type": "text/plain;charset=UTF-8" } },
      );
    if (url.pathname === "/sitemap.xml") {
      const paths = ["/zh", "/en", "/zh/tools", "/en/tools", "/zh/calculator", "/en/calculator", "/zh/submit", "/en/submit"];
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${new URL(path, origin).href.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</loc></url>`).join("")}</urlset>`, { headers: { "Content-Type": "application/xml;charset=UTF-8" } });
    }
    return env.ASSETS.fetch(request);
  },
};
async function handleAPI(request: Request, env: Env) {
  const url = new URL(request.url);
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
  };
  if (request.method === "OPTIONS") return new Response(null, { headers });
  try {
    if (url.pathname === "/api/websites" || url.pathname.startsWith("/api/websites/"))
      return await handleWebsites(request, env, headers);
    if (url.pathname.startsWith("/api/catalog"))
      return await handleCatalog(request, env, headers);
    if (url.pathname.startsWith("/api/platforms"))
      return await handlePlatforms(request, env, headers);
    if (url.pathname.startsWith("/api/models"))
      return await handleModels(request, env, headers);
    if (url.pathname.startsWith("/api/prices"))
      return await handlePrices(request, env, headers);
    if (url.pathname === "/api/submit")
      return await handleSubmit(request, env, headers);
    if (url.pathname.startsWith("/api/admin"))
      return await handleAdmin(request, env, headers);
    return Response.json(
      { success: false, error: "Not found" },
      { status: 404, headers },
    );
  } catch (error) {
    console.error("API error", error);
    return Response.json(
      {
        success: false,
        error: "The service is temporarily unavailable. Please try again.",
      },
      { status: 500, headers },
    );
  }
}
