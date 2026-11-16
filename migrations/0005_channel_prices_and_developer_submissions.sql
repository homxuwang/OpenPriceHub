-- Additive D1 schema. No legacy price data is inferred, replaced or deleted.
PRAGMA foreign_keys = ON;
CREATE TABLE channels (
 id TEXT PRIMARY KEY, provider_id TEXT REFERENCES providers(id), name TEXT NOT NULL,
 website TEXT NOT NULL, relationship TEXT NOT NULL CHECK(relationship IN ('official','third_party','independent')),
 created_at TEXT NOT NULL
);
CREATE TABLE channel_listings (
 id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES channels(id),
 product_id TEXT REFERENCES products(id), model_id TEXT REFERENCES models(id),
 product_model_id TEXT REFERENCES product_models(id), offer_id TEXT REFERENCES offers(id),
 category TEXT NOT NULL CHECK(category IN ('image','video','voice','music','llm-api')),
 active_version_id TEXT REFERENCES listing_price_versions(id), created_at TEXT NOT NULL
);
CREATE TABLE website_submissions (
 id TEXT PRIMARY KEY, original_json TEXT NOT NULL CHECK(json_valid(original_json)),
 draft_json TEXT NOT NULL CHECK(json_valid(draft_json)), contact_email TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','changes_requested','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), listing_id TEXT UNIQUE REFERENCES channel_listings(id),
 admin_notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE listing_price_versions (
 id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES channel_listings(id),
 submission_id TEXT NOT NULL REFERENCES website_submissions(id),
 revision INTEGER NOT NULL CHECK(revision>0), public_json TEXT NOT NULL CHECK(json_valid(public_json)),
 verified_at TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(listing_id,revision)
);
CREATE TABLE listing_pricing_plans (
 id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES listing_price_versions(id), name TEXT NOT NULL,
 currency TEXT NOT NULL, amount_decimal TEXT, billing_cycle TEXT NOT NULL,
 pricing_models TEXT NOT NULL CHECK(json_valid(pricing_models)), source_url TEXT NOT NULL,
 free_allowance TEXT NOT NULL, restrictions TEXT NOT NULL, credit_pool TEXT NOT NULL,
 credit_amount_decimal TEXT, stackable INTEGER CHECK(stackable IN (0,1) OR stackable IS NULL)
);
CREATE TABLE listing_price_components (
 id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES listing_pricing_plans(id),
 unit TEXT NOT NULL, rate_decimal TEXT, included_decimal TEXT, overage_decimal TEXT,
 credits_per_unit_decimal TEXT, model_name TEXT NOT NULL,
 resolution TEXT NOT NULL, quality TEXT NOT NULL, duration_seconds_decimal TEXT
);
CREATE TABLE website_review_logs (
 id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES website_submissions(id),
 base_version INTEGER NOT NULL, action TEXT NOT NULL CHECK(action IN ('save','request_changes','reject','publish')),
 actor TEXT NOT NULL, notes TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), created_at TEXT NOT NULL,
 UNIQUE(submission_id,base_version)
);
CREATE TRIGGER website_review_version_guard BEFORE INSERT ON website_review_logs
WHEN NOT EXISTS(SELECT 1 FROM website_submissions WHERE id=NEW.submission_id AND version=NEW.base_version)
BEGIN SELECT RAISE(ABORT,'stale_review'); END;
CREATE TRIGGER website_submission_original_immutable BEFORE UPDATE OF original_json,contact_email,created_at ON website_submissions
BEGIN SELECT RAISE(ABORT,'immutable_submission'); END;
CREATE TRIGGER listing_price_version_immutable BEFORE UPDATE ON listing_price_versions
BEGIN SELECT RAISE(ABORT,'immutable_price_history'); END;
CREATE TRIGGER listing_plan_immutable BEFORE UPDATE ON listing_pricing_plans
BEGIN SELECT RAISE(ABORT,'immutable_price_history'); END;
CREATE TRIGGER listing_component_immutable BEFORE UPDATE ON listing_price_components
BEGIN SELECT RAISE(ABORT,'immutable_price_history'); END;
CREATE TRIGGER listing_price_version_no_delete BEFORE DELETE ON listing_price_versions
BEGIN SELECT RAISE(ABORT,'immutable_price_history'); END;
CREATE TRIGGER listing_plan_no_delete BEFORE DELETE ON listing_pricing_plans
BEGIN SELECT RAISE(ABORT,'immutable_price_history'); END;
CREATE TRIGGER listing_component_no_delete BEFORE DELETE ON listing_price_components
BEGIN SELECT RAISE(ABORT,'immutable_price_history'); END;
CREATE TABLE website_submission_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL CHECK(count BETWEEN 1 AND 5), expires_at TEXT NOT NULL);
CREATE INDEX idx_website_submissions_queue ON website_submissions(status,updated_at);
CREATE INDEX idx_channel_listing_category ON channel_listings(category,active_version_id);
CREATE INDEX idx_channel_listing_model ON channel_listings(model_id,channel_id);
CREATE INDEX idx_channel_listing_product ON channel_listings(product_id,channel_id);
CREATE INDEX idx_listing_price_versions ON listing_price_versions(listing_id,created_at);
CREATE INDEX idx_listing_plans_version ON listing_pricing_plans(version_id);
CREATE INDEX idx_listing_components_plan ON listing_price_components(plan_id);
CREATE INDEX idx_website_limits_expiry ON website_submission_limits(expires_at);
