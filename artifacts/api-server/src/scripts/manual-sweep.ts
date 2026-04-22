import { db } from "@workspace/db";
import { depositAddressesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { decryptDepositPrivateKey } from "../lib/deposit-address-service";
import { runSweepPipeline } from "../lib/crypto-deposit/sweep";

const ADDRESS = process.argv[2];
const AMOUNT = parseFloat(process.argv[3] ?? "0");

if (!ADDRESS || !AMOUNT) {
  console.error("Usage: tsx manual-sweep.ts <address> <amount>");
  process.exit(1);
}

(async () => {
  const rows = await db
    .select({ privateKeyEnc: depositAddressesTable.privateKeyEnc })
    .from(depositAddressesTable)
    .where(eq(depositAddressesTable.trc20Address, ADDRESS))
    .limit(1);

  if (!rows[0]) {
    console.error(`No deposit address found for ${ADDRESS}`);
    process.exit(1);
  }

  const privateKey = decryptDepositPrivateKey(rows[0].privateKeyEnc);
  console.log(`Triggering sweep for ${AMOUNT} USDT from ${ADDRESS}...`);
  await runSweepPipeline(ADDRESS, privateKey, AMOUNT);
  console.log("Sweep pipeline complete (check logs for txids).");
  process.exit(0);
})().catch((err) => {
  console.error("Sweep failed:", err);
  process.exit(1);
});
