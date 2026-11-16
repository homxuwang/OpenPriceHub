import { execFileSync } from "node:child_process";
import { it, expect } from "vitest";
it("applies additive migrations while preserving all legacy rows and foreign keys", () => {
  const result = execFileSync(
    "python3",
    [
      "-c",
      `
import sqlite3,json,pathlib
c=sqlite3.connect(':memory:')
c.execute('PRAGMA foreign_keys=ON')
for f in ['0001_init.sql','0002_seed.sql']:c.executescript(pathlib.Path('migrations',f).read_text())
legacy={name:c.execute('SELECT * FROM '+name).fetchall() for name in ['platforms','plans','models','rules','submissions']}
for f in ['0003_product_catalog.sql','0004_verified_catalog_seed.sql']:c.executescript(pathlib.Path('migrations',f).read_text())
assert all(c.execute('SELECT * FROM '+name).fetchall()==rows for name,rows in legacy.items())
assert not c.execute('PRAGMA foreign_key_check').fetchall()
assert c.execute('SELECT count(*) FROM products').fetchone()[0]==10
assert c.execute('SELECT count(*) FROM alternatives WHERE original_product_id="flux-schnell"').fetchone()[0]==0
assert c.execute('SELECT count(*) FROM alternatives WHERE alternative_product_id="flux-schnell"').fetchone()[0]==1
snapshot=json.loads(c.execute('SELECT catalog_json FROM catalog_revisions').fetchone()[0])
assert len(snapshot['products'])==10
print('migration compatibility and directional indexes passed')
`,
    ],
    { encoding: "utf8" },
  );
  expect(result).toContain("passed");
});

it("adopts a manually initialized legacy database without replaying seed inserts", () => {
  const result = execFileSync(
    "python3",
    [
      "-c",
      `
import sqlite3,pathlib
c=sqlite3.connect(':memory:')
for f in ['0001_init.sql','0002_seed.sql']: c.executescript(pathlib.Path('migrations',f).read_text())
c.execute("UPDATE plans SET price=123 WHERE id='plan-anthropic'")
legacy={name:c.execute('SELECT * FROM '+name).fetchall() for name in ['platforms','plans','models','rules','submissions']}
c.executescript(pathlib.Path('migrations/bootstrap/adopt_legacy.sql').read_text())
for p in sorted(pathlib.Path('migrations').glob('*.sql')):
 if not c.execute('SELECT 1 FROM d1_migrations WHERE name=?',(p.name,)).fetchone():
  c.executescript(p.read_text())
  c.execute('INSERT INTO d1_migrations(name) VALUES (?)',(p.name,))
assert all(c.execute('SELECT * FROM '+name).fetchall()==rows for name,rows in legacy.items())
assert c.execute('SELECT count(*) FROM products').fetchone()[0]==10
assert c.execute('SELECT count(*) FROM d1_migrations').fetchone()[0]==len(list(pathlib.Path('migrations').glob('*.sql')))
print('legacy adoption passed')
`,
    ],
    { encoding: "utf8" },
  );
  expect(result).toContain("passed");
});
