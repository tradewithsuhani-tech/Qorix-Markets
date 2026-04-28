import { db, merchantsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

(async () => {
  try {
    const rows = await db
      .select({
        id: merchantsTable.id,
        email: merchantsTable.email,
        fullName: merchantsTable.fullName,
        inrBalance: merchantsTable.inrBalance,
        methodCount: sql<number>`(
          select count(*)::int from payment_methods pm where pm.merchant_id = merchants.id
        )`,
        pendingHold: sql<string>`coalesce((
          select sum(d.amount_inr)::text
          from inr_deposits d
          join payment_methods pm on pm.id = d.payment_method_id
          where pm.merchant_id = merchants.id and d.status = 'pending'
        ), '0')`,
      })
      .from(merchantsTable)
      .orderBy(merchantsTable.createdAt);
    console.log("OK rows:", rows.length);
    for (const r of rows) console.log(JSON.stringify(r));
  } catch (e: any) {
    console.log("DRIZZLE ERROR:", e.message);
    if (e.cause) console.log("CAUSE:", e.cause.message ?? e.cause);
    console.log(e.stack?.split("\n").slice(0, 8).join("\n"));
  }
  process.exit(0);
})();
