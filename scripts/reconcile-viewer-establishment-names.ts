import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    UPDATE establishment_viewers v
    SET establishment_name = e.name
    FROM establishments e
    WHERE v.establishment_id = e.id
      AND v.tenant_id = e.tenant_id
      AND v.establishment_name IS DISTINCT FROM e.name
    RETURNING v.id, v.tenant_id, v.establishment_name
  `);
  const rows = (result as any).rows ?? result;
  console.log(`Reconciled ${Array.isArray(rows) ? rows.length : 0} viewer rows`);
  if (Array.isArray(rows)) {
    for (const r of rows) {
      console.log(`  - viewer ${r.id} (tenant ${r.tenant_id}) -> "${r.establishment_name}"`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Reconciliation failed:", err);
  process.exit(1);
});
