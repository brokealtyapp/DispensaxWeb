import { db } from "../server/db";
import { establishmentViewers, establishments } from "../shared/schema";
import { and, eq, ne, sql } from "drizzle-orm";

interface ReconciledRow {
  id: string;
  tenantId: string;
  establishmentName: string;
}

async function main() {
  const updated: ReconciledRow[] = await db
    .update(establishmentViewers)
    .set({ establishmentName: establishments.name })
    .from(establishments)
    .where(
      and(
        eq(establishmentViewers.establishmentId, establishments.id),
        eq(establishmentViewers.tenantId, establishments.tenantId),
        ne(establishmentViewers.establishmentName, establishments.name),
      ),
    )
    .returning({
      id: establishmentViewers.id,
      tenantId: establishmentViewers.tenantId,
      establishmentName: establishmentViewers.establishmentName,
    });

  console.log(`Reconciled ${updated.length} viewer rows`);
  for (const row of updated) {
    console.log(`  - viewer ${row.id} (tenant ${row.tenantId}) -> "${row.establishmentName}"`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Reconciliation failed:", err);
  process.exit(1);
});
