-- Adopt databases initialized by the old scripts without replaying their demo INSERTs.
-- Only Wrangler's migration journal is modified; all business tables/rows are preserved.
CREATE TABLE IF NOT EXISTS d1_migrations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT UNIQUE,
 applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT OR IGNORE INTO d1_migrations (name)
SELECT '0001_init.sql'
WHERE (SELECT COUNT(*) FROM sqlite_master WHERE type='table'
 AND name IN ('platforms','plans','models','rules','submissions')) = 5;
INSERT OR IGNORE INTO d1_migrations (name)
SELECT '0002_seed.sql'
WHERE EXISTS (SELECT 1 FROM d1_migrations WHERE name='0001_init.sql');
