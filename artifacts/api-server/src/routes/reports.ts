import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { monthlyPerformanceTable, reportVerificationsTable } from "@workspace/db/schema";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();

function canonicalJson(data: Record<string, unknown>): string {
  const ordered: Record<string, unknown> = {};
  Object.keys(data).sort().forEach((k) => { ordered[k] = data[k]; });
  return JSON.stringify(ordered);
}

function computeContentHash(fields: {
  userId: number;
  yearMonth: string;
  monthlyReturn: string;
  maxDrawdown: string;
  winRate: string;
  totalProfit: string;
  tradingDays: number;
  winningDays: number;
  startEquity: string;
  peakEquity: string;
}): string {
  const canonical = canonicalJson(fields as unknown as Record<string, unknown>);
  return createHash("sha256").update(canonical).digest("hex");
}

router.post("/reports/generate", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { yearMonth } = req.body as { yearMonth: string };

    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      return res.status(400).json({ error: "yearMonth must be in YYYY-MM format" });
    }

    const [record] = await db
      .select()
      .from(monthlyPerformanceTable)
      .where(
        and(
          eq(monthlyPerformanceTable.userId, userId),
          eq(monthlyPerformanceTable.yearMonth, yearMonth),
        ),
      )
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: "No monthly performance record found for this period" });
    }

    const existing = await db
      .select()
      .from(reportVerificationsTable)
      .where(
        and(
          eq(reportVerificationsTable.userId, userId),
          eq(reportVerificationsTable.yearMonth, yearMonth),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return res.json({
        hashId: existing[0].hashId,
        yearMonth: existing[0].yearMonth,
        alreadyExisted: true,
      });
    }

    const hashId = randomBytes(16).toString("hex");

    const hashFields = {
      userId: record.userId,
      yearMonth: record.yearMonth,
      monthlyReturn: record.monthlyReturn,
      maxDrawdown: record.maxDrawdown,
      winRate: record.winRate,
      totalProfit: record.totalProfit,
      tradingDays: record.tradingDays,
      winningDays: record.winningDays,
      startEquity: record.startEquity,
      peakEquity: record.peakEquity,
    };

    const contentHash = computeContentHash(hashFields);

    await db.insert(reportVerificationsTable).values({
      hashId,
      userId: record.userId,
      yearMonth: record.yearMonth,
      monthlyReturn: record.monthlyReturn,
      maxDrawdown: record.maxDrawdown,
      winRate: record.winRate,
      totalProfit: record.totalProfit,
      tradingDays: record.tradingDays,
      winningDays: record.winningDays,
      startEquity: record.startEquity,
      peakEquity: record.peakEquity,
      contentHash,
    });

    return res.json({ hashId, yearMonth, alreadyExisted: false });
  } catch (err) {
    console.error("generate report error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/verify/:hashId", async (req, res) => {
  try {
    const { hashId } = req.params;

    const [record] = await db
      .select()
      .from(reportVerificationsTable)
      .where(eq(reportVerificationsTable.hashId, hashId))
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: "Report not found" });
    }

    const hashFields = {
      userId: record.userId,
      yearMonth: record.yearMonth,
      monthlyReturn: record.monthlyReturn,
      maxDrawdown: record.maxDrawdown,
      winRate: record.winRate,
      totalProfit: record.totalProfit,
      tradingDays: record.tradingDays,
      winningDays: record.winningDays,
      startEquity: record.startEquity,
      peakEquity: record.peakEquity,
    };

    const recomputedHash = computeContentHash(hashFields);
    const isAuthentic = recomputedHash === record.contentHash;

    return res.json({
      hashId: record.hashId,
      yearMonth: record.yearMonth,
      monthlyReturn: parseFloat(record.monthlyReturn),
      maxDrawdown: parseFloat(record.maxDrawdown),
      winRate: parseFloat(record.winRate),
      totalProfit: parseFloat(record.totalProfit),
      tradingDays: record.tradingDays,
      winningDays: record.winningDays,
      startEquity: parseFloat(record.startEquity),
      peakEquity: parseFloat(record.peakEquity),
      contentHash: record.contentHash,
      generatedAt: record.generatedAt.toISOString(),
      isAuthentic,
    });
  } catch (err) {
    console.error("verify report error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
