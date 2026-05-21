import { db } from "@workspace/db";
import { p2pOrdersTable, p2pAdsTable, p2pEscrowTransactionsTable } from "@workspace/db";
import { and, eq, lt, sql } from "drizzle-orm";
import { logger, errorLogger } from "./logger";
import { createNotification } from "./notifications";
import { publishOrderEvent } from "./p2p-realtime";

function parseNum(v: string | number): number {
  return typeof v === "number" ? v : parseFloat(v as string);
}

/**
 * Auto-expire P2P orders whose payment deadline has passed without the
 * buyer marking the payment as sent.
 *
 * For each stale "pending" order we:
 *   - restore the ad's filled quantity (so the USDT is available again)
 *   - mark the escrow row as "returned"
 *   - set the order status to "cancelled" with reason "auto_expired"
 *   - notify both buyer and seller
 *
 * Idempotent: only acts on rows where status='pending' AND deadline < now.
 */
export async function expireStaleP2POrders(): Promise<{ expired: number }> {
  const now = new Date();
  let expiredCount = 0;

  try {
    const stale = await db
      .select({
        id: p2pOrdersTable.id,
        adId: p2pOrdersTable.adId,
        buyerId: p2pOrdersTable.buyerId,
        sellerId: p2pOrdersTable.sellerId,
        usdtAmount: p2pOrdersTable.usdtAmount,
        fiatAmount: p2pOrdersTable.fiatAmount,
      })
      .from(p2pOrdersTable)
      .where(
        and(
          eq(p2pOrdersTable.status, "pending"),
          lt(p2pOrdersTable.paymentDeadline, now),
        ),
      )
      .limit(100);

    if (stale.length === 0) return { expired: 0 };

    for (const order of stale) {
      try {
        const didExpire = await db.transaction(async (tx) => {
          // Re-check status inside the txn to avoid double-processing if
          // another instance grabbed it first.
          const [fresh] = await tx
            .select({ status: p2pOrdersTable.status })
            .from(p2pOrdersTable)
            .where(eq(p2pOrdersTable.id, order.id))
            .limit(1);
          if (!fresh || fresh.status !== "pending") return false;

          const usdtAmount = parseNum(order.usdtAmount as string);

          // Restore filled quantity on the ad (frees USDT for new orders)
          await tx
            .update(p2pAdsTable)
            .set({
              filledQuantity: sql`${p2pAdsTable.filledQuantity} - ${usdtAmount}`,
              updatedAt: new Date(),
            })
            .where(eq(p2pAdsTable.id, order.adId));

          // Mark escrow as returned
          await tx
            .update(p2pEscrowTransactionsTable)
            .set({ status: "returned" })
            .where(eq(p2pEscrowTransactionsTable.orderId, order.id));

          // Mark order as cancelled (we reuse "cancelled" since "expired"
          // is not in the current status enum; cancelReason distinguishes).
          await tx
            .update(p2pOrdersTable)
            .set({
              status: "cancelled",
              cancelledAt: new Date(),
              updatedAt: new Date(),
              cancelReason: "auto_expired",
            })
            .where(eq(p2pOrdersTable.id, order.id));
          return true;
        });

        // Skip counting + notifying + emitting realtime if another instance
        // already processed this order between our SELECT and our txn.
        if (!didExpire) continue;

        expiredCount += 1;
        publishOrderEvent({ type: "order.expired", orderId: order.id });

        // Notifications (fire-and-forget — outside the txn)
        const fiat = parseNum(order.fiatAmount as string).toFixed(2);
        await createNotification(
          order.buyerId,
          "p2p_order",
          "P2P order expired",
          `Order #${order.id} (₹${fiat}) was auto-cancelled because payment was not made within the time limit.`,
        ).catch(() => {});
        await createNotification(
          order.sellerId,
          "p2p_order",
          "P2P order expired",
          `Order #${order.id} (₹${fiat}) was auto-cancelled. Your USDT has been released back to the ad.`,
        ).catch(() => {});
      } catch (innerErr) {
        errorLogger.error(
          { err: innerErr, orderId: order.id },
          "[p2p-expiry] failed to expire single order",
        );
      }
    }

    if (expiredCount > 0) {
      logger.info({ expired: expiredCount }, "[p2p-expiry] expired stale orders");
    }
    return { expired: expiredCount };
  } catch (err) {
    errorLogger.error({ err }, "[p2p-expiry] sweep failed");
    return { expired: expiredCount };
  }
}
