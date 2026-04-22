import { db } from "@workspace/db";
import { depositAddressesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateTronAddress } from "./tron-address";
import { encryptPrivateKey, decryptPrivateKey } from "./wallet-crypto";
import { logger } from "./logger";

export interface DepositAddressRecord {
  userId: number;
  address: string;
  privateKeyEnc: string;
}

export async function getOrCreateDepositAddress(userId: number): Promise<string> {
  const existing = await db
    .select()
    .from(depositAddressesTable)
    .where(eq(depositAddressesTable.userId, userId))
    .limit(1);

  if (existing[0]) return existing[0].trc20Address;

  const { address, privateKey } = generateTronAddress();
  const privateKeyEnc = encryptPrivateKey(privateKey);

  try {
    await db.insert(depositAddressesTable).values({
      userId,
      trc20Address: address,
      privateKeyEnc,
    });
    logger.info({ userId, address }, "Generated unique deposit address for user");
    return address;
  } catch (err) {
    // Race condition: another request created it concurrently.
    const again = await db
      .select()
      .from(depositAddressesTable)
      .where(eq(depositAddressesTable.userId, userId))
      .limit(1);
    if (again[0]) return again[0].trc20Address;
    throw err;
  }
}

export async function getAllDepositAddresses(): Promise<DepositAddressRecord[]> {
  const rows = await db
    .select({
      userId: depositAddressesTable.userId,
      address: depositAddressesTable.trc20Address,
      privateKeyEnc: depositAddressesTable.privateKeyEnc,
    })
    .from(depositAddressesTable);
  return rows;
}

export function decryptDepositPrivateKey(enc: string): string {
  return decryptPrivateKey(enc);
}
