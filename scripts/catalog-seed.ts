import { writeFileSync } from "node:fs";
import { bundledCatalog, validateCatalog } from "../src/shared/catalog/logic";
import { catalogStatements } from "../src/shared/catalog/persistence";
const errors = validateCatalog(bundledCatalog);
if (errors.length) throw new Error(errors.join("\n"));
const quote = (v: string | number | null) =>
  v === null
    ? "NULL"
    : typeof v === "number"
      ? String(v)
      : "'" + v.replaceAll("'", "''") + "'";
const sql = catalogStatements(bundledCatalog, "initial-2026-10-30")
  .map((s) => {
    let i = 0;
    return s.sql.replace(/\?/g, () => quote(s.values[i++])) + ";";
  })
  .join("\n");
writeFileSync(
  "migrations/0004_verified_catalog_seed.sql",
  "-- Verified catalog snapshot. Original legacy tables are not changed.\n" +
    sql +
    "\n",
);
console.log("Verified seed migration generated.");
