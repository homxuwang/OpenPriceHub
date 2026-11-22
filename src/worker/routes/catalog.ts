import { administrator } from '../services/auth';
import type { Env } from "../../shared/types";
import type { Catalog } from "../../shared/catalog/types";
import {
  alternativeRelations,
  bundledCatalog,
  validateCatalog,
} from "../../shared/catalog/logic";
import { catalogStatements } from "../../shared/catalog/persistence";
import { successResponse, errorResponse } from "../utils/response";
export async function loadCatalog(
  env: Env,
): Promise<{ catalog: Catalog; storage: "database" | "bundled" }> {
  try {
    const row = await env.DB.prepare(
      "SELECT catalog_json FROM catalog_revisions ORDER BY rowid DESC LIMIT 1",
    ).first<{ catalog_json: string }>();
    if (row)
      return { catalog: JSON.parse(row.catalog_json), storage: "database" };
  } catch (error) {
    console.warn(
      "Catalog database unavailable; serving bundled verified snapshot.",
      String(error),
    );
  }
  return { catalog: bundledCatalog, storage: "bundled" };
}
export async function handleCatalog(
  request: Request,
  env: Env,
  headers: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith("/api/catalog/admin")) {
    headers = { ...headers, "Cache-Control": "no-store" };
    if (!await administrator(request, env))
      return errorResponse("Valid administrator key required.", 401, headers);
    if (request.method === "GET") {
      const data = await loadCatalog(env);
      const [logs, submissions, history] = await Promise.all([
        env.DB.prepare(
          "SELECT * FROM data_sync_logs ORDER BY rowid DESC LIMIT 30",
        ).all(),
        env.DB.prepare(
          "SELECT * FROM catalog_submissions ORDER BY rowid DESC LIMIT 100",
        ).all(),
        env.DB.prepare(
          "SELECT * FROM price_history ORDER BY rowid DESC LIMIT 100",
        ).all(),
      ]);
      return successResponse(
        {
          ...data,
          logs: logs.results,
          submissions: submissions.results,
          history: history.results,
        },
        undefined,
        headers,
      );
    }
    if (request.method !== "POST")
      return errorResponse("Method not allowed", 405, headers);
    const raw = await request.text();
    if (raw.length > 1500000)
      return errorResponse("Catalog exceeds 1.5 MB limit", 413, headers);
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return errorResponse("Invalid JSON", 400, headers);
    }
    if (path === "/api/catalog/admin/review") {
      if (!body.id || !["reviewed", "rejected"].includes(body.status))
        return errorResponse("Invalid review", 400, headers);
      const result = await env.DB.prepare(
        "UPDATE catalog_submissions SET status=?,admin_notes=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status=?",
      )
        .bind(
          body.status,
          String(body.notes || "").slice(0, 4000),
          body.id,
          "pending",
        )
        .run();
      if (!result.meta.changes)
        return errorResponse(
          "Submission not pending or not found",
          409,
          headers,
        );
      return successResponse(
        { id: body.id, status: body.status },
        "Review recorded. Publish verified catalog changes separately.",
        headers,
      );
    }
    if (
      !["/api/catalog/admin/validate", "/api/catalog/admin/publish"].includes(
        path,
      )
    )
      return errorResponse("Not found", 404, headers);
    let errors: string[];
    try {
      errors = validateCatalog(body);
    } catch {
      errors = ["Malformed catalog shape."];
    }
    if (errors.length) return errorResponse(errors.join("\n"), 400, headers);
    if (path.endsWith("/validate"))
      return successResponse(
        { valid: true, products: body.products.length },
        "Validation passed; no data changed.",
        headers,
      );
    const revision = crypto.randomUUID();
    try {
      await env.DB.batch(
        catalogStatements(body, revision).map((s) =>
          env.DB.prepare(s.sql).bind(...s.values),
        ),
      );
    } catch (e) {
      await env.DB.prepare(
        "INSERT INTO data_sync_logs (id,status,message) VALUES (?,?,?)",
      )
        .bind(revision, "failed", "Publication transaction failed.")
        .run();
      console.error(e);
      return errorResponse(
        "Publication failed; previous revision remains active.",
        500,
        headers,
      );
    }
    return successResponse(
      { revision },
      "Catalog published atomically.",
      headers,
    );
  }
  if (path === "/api/catalog/submissions" && request.method === "POST") {
    const raw = await request.text();
    if (raw.length > 50000)
      return errorResponse("Submission too large", 413, headers);
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return errorResponse("Invalid JSON", 400, headers);
    }
    const product = String(body.productName || "").trim(),
      source = String(body.sourceUrl || "").trim();
    let validSource = false;
    try {
      const u = new URL(source);
      validSource = u.protocol === "https:" && !u.username && !u.password;
    } catch {}
    if (!product || product.length > 200 || !validSource)
      return errorResponse(
        "Product name and HTTPS source URL are required.",
        400,
        headers,
      );
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO catalog_submissions (id,product_name,source_url,notes,payload_json) VALUES (?,?,?,?,?)",
    )
      .bind(
        id,
        product,
        source,
        String(body.notes || "").slice(0, 4000),
        JSON.stringify(body),
      )
      .run();
    return successResponse(
      { id, status: "pending" },
      "Saved for review; not published.",
      headers,
    );
  }
  if (request.method !== "GET")
    return errorResponse("Method not allowed", 405, headers);
  const data = await loadCatalog(env);
  if (path === "/api/catalog")
    return successResponse(data, undefined, {
      ...headers,
      "Cache-Control": "no-cache",
    });
  const match = path.match(
    /^\/api\/catalog\/products\/([a-z0-9-]+)(?:\/(alternatives|history))?$/,
  );
  if (match) {
    const product = data.catalog.products.find((p) => p.slug === match[1]);
    if (!product) return errorResponse("Product not found", 404, headers);
    if (match[2] === "alternatives")
      return successResponse(
        {
          relationships: alternativeRelations(
            data.catalog,
            product.id,
            url.searchParams.get("direction") === "incoming"
              ? "incoming"
              : "outgoing",
          ),
        },
        undefined,
        headers,
      );
    if (match[2] === "history") {
      const history = await env.DB.prepare(
        "SELECT h.* FROM price_history h JOIN pricing_plans p ON h.plan_id=p.id JOIN offers o ON p.offer_id=o.id WHERE o.product_id=? ORDER BY h.rowid DESC",
      )
        .bind(product.id)
        .all();
      return successResponse({ history: history.results }, undefined, headers);
    }
    return successResponse({ product }, undefined, headers);
  }
  return errorResponse("Not found", 404, headers);
}
