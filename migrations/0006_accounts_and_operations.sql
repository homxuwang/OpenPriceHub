-- Additive: never infer ownership from contact_email or a matching product/model name.
CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL,iterations INTEGER NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','reviewer','developer')),disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN(0,1)),created_at TEXT NOT NULL);
CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE auth_limits(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE domain_claims(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),hostname TEXT NOT NULL,token TEXT NOT NULL,expires_at TEXT NOT NULL,verified_at TEXT,UNIQUE(user_id,hostname));
CREATE INDEX idx_domain_claims_host ON domain_claims(hostname,verified_at);
ALTER TABLE website_submissions ADD COLUMN owner_user_id TEXT REFERENCES users(id);
CREATE INDEX idx_website_submission_owner ON website_submissions(owner_user_id,updated_at);
CREATE TABLE source_monitors(id TEXT PRIMARY KEY,url TEXT NOT NULL,adapter TEXT NOT NULL CHECK(adapter IN('page-watch','website-json-v1')),submission_id TEXT REFERENCES website_submissions(id),interval_hours INTEGER NOT NULL CHECK(interval_hours IN(12,24)),enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),last_attempt_at TEXT,last_success_at TEXT,last_hash TEXT,etag TEXT,last_modified TEXT,lease_until TEXT,last_error TEXT);
CREATE TABLE source_checks(id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES source_monitors(id),status TEXT NOT NULL,content_hash TEXT,error TEXT,created_at TEXT NOT NULL);
CREATE INDEX idx_source_checks_time ON source_checks(source_id,created_at);
CREATE TABLE source_candidates(id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES source_monitors(id),submission_id TEXT NOT NULL REFERENCES website_submissions(id),base_version INTEGER NOT NULL,payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','applied','rejected')),created_at TEXT NOT NULL,UNIQUE(source_id,base_version,payload_json));
CREATE TABLE fx_snapshots(id TEXT PRIMARY KEY,base_currency TEXT NOT NULL,rate_date TEXT NOT NULL,rates_json TEXT NOT NULL CHECK(json_valid(rates_json)),source_url TEXT NOT NULL,checked_at TEXT NOT NULL);
CREATE INDEX idx_fx_snapshot_time ON fx_snapshots(checked_at);
CREATE TABLE operations_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created_at TEXT NOT NULL);
