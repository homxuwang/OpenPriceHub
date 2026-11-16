-- Additive catalog schema. Legacy platforms/plans/models/rules/submissions remain intact.
PRAGMA foreign_keys = ON;
CREATE TABLE categories (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
CREATE TABLE providers (id TEXT PRIMARY KEY, name TEXT NOT NULL, legacy_platform_id TEXT REFERENCES platforms(id));
CREATE TABLE data_sources (id TEXT PRIMARY KEY, url TEXT NOT NULL, title TEXT NOT NULL, checked_at TEXT NOT NULL, notes TEXT NOT NULL);
CREATE TABLE products (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, provider_id TEXT NOT NULL REFERENCES providers(id),
 category_id TEXT NOT NULL REFERENCES categories(id), name TEXT NOT NULL, website TEXT NOT NULL,
 verification_status TEXT NOT NULL CHECK(verification_status IN ('verified','pending','stale')),
 last_verified_at TEXT, metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json))
);
CREATE TABLE product_models (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), name TEXT NOT NULL, legacy_model_id TEXT REFERENCES models(id));
CREATE TABLE offers (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), name TEXT NOT NULL, official_url TEXT NOT NULL);
CREATE TABLE pricing_plans (
 id TEXT PRIMARY KEY, offer_id TEXT NOT NULL REFERENCES offers(id), name TEXT NOT NULL,
 amount REAL CHECK(amount IS NULL OR amount >= 0), currency TEXT NOT NULL, billing_cycle TEXT NOT NULL,
 pricing_models TEXT NOT NULL CHECK(json_valid(pricing_models)), source_id TEXT REFERENCES data_sources(id),
 verification_status TEXT NOT NULL CHECK(verification_status IN ('verified','pending','stale')),
 last_verified_at TEXT, metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json))
);
CREATE TABLE pricing_components (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES pricing_plans(id), unit TEXT NOT NULL, unit_size REAL NOT NULL CHECK(unit_size > 0), rate REAL CHECK(rate IS NULL OR rate >= 0), rule_json TEXT NOT NULL CHECK(json_valid(rule_json)));
CREATE TABLE data_sync_logs (id TEXT PRIMARY KEY, status TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE catalog_revisions (id TEXT PRIMARY KEY, sync_log_id TEXT NOT NULL REFERENCES data_sync_logs(id), catalog_json TEXT NOT NULL CHECK(json_valid(catalog_json)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE price_history (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES pricing_plans(id), revision_id TEXT NOT NULL REFERENCES catalog_revisions(id), amount REAL, currency TEXT NOT NULL, billing_cycle TEXT NOT NULL, components_json TEXT NOT NULL, recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE affiliate_links (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), url TEXT NOT NULL, disclosure TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)));
CREATE TABLE alternatives (
 id TEXT PRIMARY KEY, original_product_id TEXT NOT NULL REFERENCES products(id), alternative_product_id TEXT NOT NULL REFERENCES products(id),
 similarity_type TEXT NOT NULL, feature_match TEXT NOT NULL CHECK(json_valid(feature_match)), price_advantage TEXT NOT NULL,
 usage_scenario TEXT NOT NULL, recommendation_reason TEXT NOT NULL, functional_difference TEXT NOT NULL,
 verification_status TEXT NOT NULL CHECK(verification_status IN ('verified','pending','stale')), last_verified_at TEXT,
 source_ids TEXT NOT NULL CHECK(json_valid(source_ids)), CHECK(original_product_id <> alternative_product_id), UNIQUE(original_product_id, alternative_product_id)
);
CREATE INDEX idx_alternatives_original ON alternatives(original_product_id,verification_status);
CREATE INDEX idx_alternatives_reverse ON alternatives(alternative_product_id,verification_status);
CREATE TABLE product_feature_attributes (product_id TEXT NOT NULL REFERENCES products(id), feature_key TEXT NOT NULL, value TEXT NOT NULL, source_ids TEXT NOT NULL CHECK(json_valid(source_ids)), PRIMARY KEY(product_id,feature_key));
CREATE TABLE catalog_submissions (id TEXT PRIMARY KEY, product_name TEXT NOT NULL, source_url TEXT NOT NULL, notes TEXT NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','rejected')), admin_notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT);
CREATE INDEX idx_catalog_submissions_status ON catalog_submissions(status);
CREATE INDEX idx_products_category ON products(category_id,verification_status);
CREATE INDEX idx_catalog_price_history ON price_history(plan_id,recorded_at);
