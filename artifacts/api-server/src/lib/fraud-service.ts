import { db, usersTable, loginEventsTable, fraudFlagsTable, transactionsTable, investmentsTable } from "@workspace/db";
import { eq, and, ne, inArray, gte, count, sql, desc } from "drizzle-orm";
import { logger } from "./logger";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveFingerprint(userAgent: string | undefined): string {
  if (!userAgent) return "unknown";
  return crypto.createHash("sha256").update(userAgent).digest("hex").slice(0, 16);
}

function normalizeIp(ip: string): string {
  // Strip IPv6 loopback / ::ffff: prefix from IPv4-mapped addresses
  return ip.replace(/^::ffff:/, "").trim();
}

// ---------------------------------------------------------------------------
// Track a login or registration event
// ---------------------------------------------------------------------------
export async function trackLoginEvent(
  userId: number,
  rawIp: string,
  userAgent: string | undefined,
  eventType: "login" | "register" = "login",
): Promise<void> {
  try {
    const ip = normalizeIp(rawIp);
    const fingerprint = deriveFingerprint(userAgent);
    await db.insert(loginEventsTable).values({
      userId,
      ipAddress: ip,
      userAgent: userAgent ?? null,
      deviceFingerprint: fingerprint,
      eventType,
    });
  } catch (err) {
    logger.warn({ err, userId }, "fraud-service: failed to track login event");
  }
}

// ---------------------------------------------------------------------------
// Internal: upsert a fraud flag (avoid exact duplicates within 24h)
// ---------------------------------------------------------------------------
async function raiseFraudFlag(
  userId: number,
  flagType: string,
  severity: "low" | "medium" | "high",
  details: Record<string, unknown>,
): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await db
    .select({ id: fraudFlagsTable.id })
    .from(fraudFlagsTable)
    .where(
      and(
        eq(fraudFlagsTable.userId, userId),
        eq(fraudFlagsTable.flagType, flagType),
        eq(fraudFlagsTable.isResolved, false),
        gte(fraudFlagsTable.createdAt, since),
      ),
    )
    .limit(1);

  if (existing.length > 0) return; // already flagged recently

  // Atomic insert; partial unique index (user_id, flag_type) WHERE is_resolved=false
  // prevents concurrent duplicate inserts.
  const inserted = await db
    .insert(fraudFlagsTable)
    .values({
      userId,
      flagType,
      severity,
      details: JSON.stringify(details),
    })
    .onConflictDoNothing()
    .returning({ id: fraudFlagsTable.id });

  if (inserted.length === 0) return; // race lost — flag already exists

  logger.warn({ userId, flagType, severity, details }, "fraud-service: flag raised");

  // --- Auto-freeze on 3+ unresolved high-severity flags ---
  if (severity === "high") {
    const [highCount] = await db
      .select({ cnt: count() })
      .from(fraudFlagsTable)
      .where(
        and(
          eq(fraudFlagsTable.userId, userId),
          eq(fraudFlagsTable.severity, "high"),
          eq(fraudFlagsTable.isResolved, false),
        ),
      );

    if (Number(highCount?.cnt ?? 0) >= 3) {
      const userRows = await db
        .select({ isFrozen: usersTable.isFrozen, isAdmin: usersTable.isAdmin })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      const u = userRows[0];
      if (u && !u.isAdmin && !u.isFrozen) {
        await db
          .update(usersTable)
          .set({ isFrozen: true })
          .where(eq(usersTable.id, userId));
        logger.error({ userId, highFlagCount: highCount?.cnt }, "fraud-service: AUTO-FROZEN account due to repeated high-severity flags");
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 1: Multiple accounts registered/logged in from the same IP
// ---------------------------------------------------------------------------
async function checkMultipleAccounts(userId: number, rawIp: string): Promise<void> {
  const ip = normalizeIp(rawIp);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7-day window

  const otherUsersFromSameIp = await db
    .selectDistinct({ userId: loginEventsTable.userId })
    .from(loginEventsTable)
    .where(
      and(
        eq(loginEventsTable.ipAddress, ip),
        ne(loginEventsTable.userId, userId),
        gte(loginEventsTable.createdAt, since),
      ),
    )
    .limit(10);

  if (otherUsersFromSameIp.length === 0) return;

  const otherIds = otherUsersFromSameIp.map((r) => r.userId);

  await raiseFraudFlag(userId, "multi_account", otherIds.length >= 3 ? "high" : "medium", {
    ip,
    sharedWithUserIds: otherIds,
    windowDays: 7,
  });

  // Also flag the other accounts
  for (const otherId of otherIds) {
    await raiseFraudFlag(otherId, "multi_account", otherIds.length >= 3 ? "high" : "medium", {
      ip,
      sharedWithUserIds: [userId, ...otherIds.filter((id) => id !== otherId)],
      windowDays: 7,
    });
  }
}

// ---------------------------------------------------------------------------
// Check 2: Referral abuse — sponsor and referee share same IP, or self-referral
// ---------------------------------------------------------------------------
async function checkReferralAbuse(userId: number, rawIp: string, sponsorId: number | null): Promise<void> {
  if (!sponsorId || sponsorId === 0 || sponsorId === userId) return;

  const ip = normalizeIp(rawIp);

  // Check if sponsor ever logged in from this IP
  const sponsorIpMatch = await db
    .select({ id: loginEventsTable.id })
    .from(loginEventsTable)
    .where(
      and(
        eq(loginEventsTable.userId, sponsorId),
        eq(loginEventsTable.ipAddress, ip),
      ),
    )
    .limit(1);

  if (sponsorIpMatch.length > 0) {
    await raiseFraudFlag(userId, "self_referral", "high", {
      sponsorId,
      sharedIp: ip,
      reason: "Sponsor and referee share the same IP address",
    });
    await raiseFraudFlag(sponsorId, "referral_abuse", "high", {
      refereeId: userId,
      sharedIp: ip,
      reason: "Referred a user from the same IP address",
    });
    return;
  }

  // Check for circular referral chain (A refers B who refers A)
  const sponsor = await db
    .select({ sponsorId: usersTable.sponsorId })
    .from(usersTable)
    .where(eq(usersTable.id, sponsorId))
    .limit(1);

  if (sponsor[0]?.sponsorId === userId) {
    await raiseFraudFlag(userId, "referral_abuse", "high", {
      sponsorId,
      reason: "Circular referral chain detected (A → B → A)",
    });
    await raiseFraudFlag(sponsorId, "referral_abuse", "high", {
      refereeId: userId,
      reason: "Circular referral chain detected (A → B → A)",
    });
  }
}

// ---------------------------------------------------------------------------
// Check 3: Device fingerprint cluster (same device, many accounts)
// ---------------------------------------------------------------------------
async function checkDeviceCluster(userId: number, userAgent: string | undefined): Promise<void> {
  const fingerprint = deriveFingerprint(userAgent);
  if (fingerprint === "unknown") return;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const othersWithSameDevice = await db
    .selectDistinct({ userId: loginEventsTable.userId })
    .from(loginEventsTable)
    .where(
      and(
        eq(loginEventsTable.deviceFingerprint, fingerprint),
        ne(loginEventsTable.userId, userId),
        gte(loginEventsTable.createdAt, since),
      ),
    )
    .limit(10);

  if (othersWithSameDevice.length < 2) return; // single shared device is normal (family computer)

  const otherIds = othersWithSameDevice.map((r) => r.userId);
  await raiseFraudFlag(userId, "device_cluster", othersWithSameDevice.length >= 4 ? "high" : "medium", {
    fingerprint,
    sharedWithUserIds: otherIds,
    accountCount: otherIds.length + 1,
  });
}

// ---------------------------------------------------------------------------
// Check 4: Rapid deposit-withdrawal cycling (deposit then immediate withdrawal)
// ---------------------------------------------------------------------------
async function checkRapidCycling(userId: number): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [depResult] = await db
    .select({ cnt: count() })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "deposit"),
        eq(transactionsTable.status, "completed"),
        gte(transactionsTable.createdAt, since),
      ),
    );

  const [wdResult] = await db
    .select({ cnt: count() })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "withdrawal"),
        gte(transactionsTable.createdAt, since),
      ),
    );

  const depCount = Number(depResult?.cnt ?? 0);
  const wdCount = Number(wdResult?.cnt ?? 0);

  if (depCount >= 3 && wdCount >= 3) {
    await raiseFraudFlag(userId, "rapid_cycling", "medium", {
      depositsLast24h: depCount,
      withdrawalsLast24h: wdCount,
      reason: "Unusually high deposit-withdrawal frequency in 24h",
    });
  }
}

// ---------------------------------------------------------------------------
// Main: run all fraud checks (called from auth routes, fire-and-forget)
// ---------------------------------------------------------------------------
export async function runFraudChecks(
  userId: number,
  rawIp: string,
  userAgent: string | undefined,
  sponsorId: number | null = null,
): Promise<void> {
  try {
    await Promise.all([
      checkMultipleAccounts(userId, rawIp),
      checkReferralAbuse(userId, rawIp, sponsorId),
      checkDeviceCluster(userId, userAgent),
      checkRapidCycling(userId),
    ]);
  } catch (err) {
    logger.warn({ err, userId }, "fraud-service: error during fraud checks");
  }
}

// ---------------------------------------------------------------------------
// Admin helper: get fraud summary stats
// ---------------------------------------------------------------------------
export async function getFraudStats() {
  const [total] = await db.select({ cnt: count() }).from(fraudFlagsTable);
  const [unresolved] = await db.select({ cnt: count() }).from(fraudFlagsTable).where(eq(fraudFlagsTable.isResolved, false));
  const [high] = await db.select({ cnt: count() }).from(fraudFlagsTable).where(and(eq(fraudFlagsTable.severity, "high"), eq(fraudFlagsTable.isResolved, false)));
  const [medium] = await db.select({ cnt: count() }).from(fraudFlagsTable).where(and(eq(fraudFlagsTable.severity, "medium"), eq(fraudFlagsTable.isResolved, false)));
  const [flaggedUsers] = await db
    .select({ cnt: sql<number>`COUNT(DISTINCT user_id)` })
    .from(fraudFlagsTable)
    .where(eq(fraudFlagsTable.isResolved, false));

  return {
    total: Number(total?.cnt ?? 0),
    unresolved: Number(unresolved?.cnt ?? 0),
    highSeverity: Number(high?.cnt ?? 0),
    mediumSeverity: Number(medium?.cnt ?? 0),
    flaggedUsers: Number(flaggedUsers?.cnt ?? 0),
  };
}
