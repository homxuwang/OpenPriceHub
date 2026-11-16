import { CATEGORIES, type Catalog } from "./types";
export interface Statement {
  sql: string;
  values: (string | number | null)[];
}
// Snapshot and normalized indexes are published atomically. Old rows are retained for history;
// the latest revision defines the active catalog, so removed offers never leak into public results.
export function catalogStatements(c: Catalog, revision: string): Statement[] {
  const statements: Statement[] = [];
  const upsert = (
    table: string,
    row: Record<string, string | number | null>,
    keys = ["id"],
  ) => {
    const cols = Object.keys(row);
    statements.push({
      sql: `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")}) ON CONFLICT(${keys.join(",")}) DO UPDATE SET ${cols
        .filter((k) => !keys.includes(k))
        .map((k) => `${k}=excluded.${k}`)
        .join(",")}`,
      values: Object.values(row),
    });
  };
  for (const cat of CATEGORIES)
    upsert("categories", { id: cat.id, slug: cat.slug, name: cat.en });
  for (const s of c.sources)
    upsert("data_sources", {
      id: s.id,
      url: s.url,
      title: s.title,
      checked_at: s.checkedAt,
      notes: s.notes,
    });
  for (const p of c.products) {
    upsert("providers", { id: p.provider, name: p.provider });
    upsert("products", {
      id: p.id,
      slug: p.slug,
      provider_id: p.provider,
      category_id: p.category,
      name: p.name,
      website: p.website,
      verification_status: p.status,
      last_verified_at: p.verifiedAt,
      metadata_json: JSON.stringify(p),
    });
    p.models.forEach((name, i) =>
      upsert("product_models", {
        id: `${p.id}-model-${i}`,
        product_id: p.id,
        name,
      }),
    );
    upsert("offers", {
      id: p.id + "-offer",
      product_id: p.id,
      name: p.name,
      official_url: p.website,
    });
    p.features.forEach((feature) =>
      upsert(
        "product_feature_attributes",
        {
          product_id: p.id,
          feature_key: feature,
          value: "documented",
          source_ids: JSON.stringify(p.sourceIds),
        },
        ["product_id", "feature_key"],
      ),
    );
    for (const plan of p.plans) {
      upsert("pricing_plans", {
        id: plan.id,
        offer_id: p.id + "-offer",
        name: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        billing_cycle: plan.billing,
        pricing_models: JSON.stringify(plan.pricingModels),
        source_id: plan.sourceIds[0] || null,
        verification_status: plan.status,
        last_verified_at: plan.verifiedAt,
        metadata_json: JSON.stringify(plan),
      });
      for (const x of plan.components)
        upsert("pricing_components", {
          id: x.id,
          plan_id: plan.id,
          unit: x.unit,
          unit_size: x.unitSize,
          rate: x.rate,
          rule_json: JSON.stringify(x),
        });
    }
  }
  for (const link of c.affiliateLinks || [])
    upsert("affiliate_links", {
      id: link.id,
      product_id: link.productId,
      url: link.url,
      disclosure: link.disclosure,
      active: link.active ? 1 : 0,
    });
  for (const a of c.alternatives)
    upsert("alternatives", {
      id: a.id,
      original_product_id: a.original,
      alternative_product_id: a.alternative,
      similarity_type: a.similarityType,
      feature_match: JSON.stringify(a.featureMatch),
      price_advantage: a.priceAdvantage,
      usage_scenario: a.scenario,
      recommendation_reason: a.reason,
      functional_difference: a.difference,
      verification_status: a.status,
      last_verified_at: a.verifiedAt,
      source_ids: JSON.stringify(a.sourceIds),
    });
  statements.push({
    sql: "INSERT INTO data_sync_logs (id,status,message) VALUES (?,?,?)",
    values: [
      revision,
      "published",
      `${c.products.length} products; ${c.alternatives.length} directional alternatives`,
    ],
  });
  statements.push({
    sql: "INSERT INTO catalog_revisions (id,sync_log_id,catalog_json) VALUES (?,?,?)",
    values: [revision, revision, JSON.stringify(c)],
  });
  for (const p of c.products)
    for (const plan of p.plans)
      statements.push({
        sql: "INSERT INTO price_history (id,plan_id,revision_id,amount,currency,billing_cycle,components_json) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM price_history WHERE plan_id=? AND amount IS ? AND currency=? AND billing_cycle=? AND components_json=? AND rowid=(SELECT MAX(rowid) FROM price_history WHERE plan_id=?))",
        values: [
          `${revision}:${plan.id}`,
          plan.id,
          revision,
          plan.amount,
          plan.currency,
          plan.billing,
          JSON.stringify(plan.components),
          plan.id,
          plan.amount,
          plan.currency,
          plan.billing,
          JSON.stringify(plan.components),
          plan.id,
        ],
      });
  return statements;
}
