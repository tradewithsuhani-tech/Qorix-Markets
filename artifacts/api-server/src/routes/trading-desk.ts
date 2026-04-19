import { Router } from "express";
import { db, tradersTable } from "@workspace/db";
import { eq, count, sum, avg } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authMiddleware);

const STRATEGY_LABELS: Record<string, string> = {
  scalping: "Scalping",
  swing: "Swing Trading",
  hybrid: "Hybrid / Arbitrage",
};

const SEED_TRADERS = [
  // Scalping – 18 traders
  { name: "Marcus Chen",       strategyType: "scalping", experienceYears: 8,  winRatePercent: "73.00" },
  { name: "Elena Vasquez",     strategyType: "scalping", experienceYears: 6,  winRatePercent: "71.00" },
  { name: "Dmitri Volkov",     strategyType: "scalping", experienceYears: 9,  winRatePercent: "70.00" },
  { name: "Priya Sharma",      strategyType: "scalping", experienceYears: 5,  winRatePercent: "72.00" },
  { name: "Lucas Berg",        strategyType: "scalping", experienceYears: 7,  winRatePercent: "74.00" },
  { name: "Aiko Tanaka",       strategyType: "scalping", experienceYears: 11, winRatePercent: "76.00" },
  { name: "Carlos Reyes",      strategyType: "scalping", experienceYears: 4,  winRatePercent: "68.00" },
  { name: "Sophie Müller",     strategyType: "scalping", experienceYears: 8,  winRatePercent: "71.00" },
  { name: "Ahmed Hassan",      strategyType: "scalping", experienceYears: 6,  winRatePercent: "70.00" },
  { name: "Nina Petrov",       strategyType: "scalping", experienceYears: 10, winRatePercent: "73.00" },
  { name: "James Walsh",       strategyType: "scalping", experienceYears: 7,  winRatePercent: "69.00" },
  { name: "Yuki Nakamura",     strategyType: "scalping", experienceYears: 5,  winRatePercent: "72.00" },
  { name: "Stefan Koch",       strategyType: "scalping", experienceYears: 9,  winRatePercent: "71.00" },
  { name: "Leila Kazemi",      strategyType: "scalping", experienceYears: 6,  winRatePercent: "74.00" },
  { name: "Blake Morrison",    strategyType: "scalping", experienceYears: 7,  winRatePercent: "70.00" },
  { name: "Ravi Patel",        strategyType: "scalping", experienceYears: 8,  winRatePercent: "73.00" },
  { name: "Mia Larsen",        strategyType: "scalping", experienceYears: 4,  winRatePercent: "68.00" },
  { name: "Omar Farouk",       strategyType: "scalping", experienceYears: 11, winRatePercent: "75.00" },
  // Swing – 14 traders
  { name: "David Konishi",     strategyType: "swing", experienceYears: 12, winRatePercent: "67.00" },
  { name: "Isabelle Fontaine", strategyType: "swing", experienceYears: 9,  winRatePercent: "64.00" },
  { name: "Viktor Romanov",    strategyType: "swing", experienceYears: 14, winRatePercent: "66.00" },
  { name: "Ana Lima",          strategyType: "swing", experienceYears: 7,  winRatePercent: "63.00" },
  { name: "Sebastian Holt",    strategyType: "swing", experienceYears: 11, winRatePercent: "65.00" },
  { name: "Zara Ahmed",        strategyType: "swing", experienceYears: 8,  winRatePercent: "64.00" },
  { name: "Patrick O'Brien",   strategyType: "swing", experienceYears: 10, winRatePercent: "66.00" },
  { name: "Mei Lin",           strategyType: "swing", experienceYears: 6,  winRatePercent: "63.00" },
  { name: "Lars Hansen",       strategyType: "swing", experienceYears: 13, winRatePercent: "67.00" },
  { name: "Fatima Malik",      strategyType: "swing", experienceYears: 5,  winRatePercent: "62.00" },
  { name: "Evan Carver",       strategyType: "swing", experienceYears: 9,  winRatePercent: "65.00" },
  { name: "Natasha Ivanova",   strategyType: "swing", experienceYears: 15, winRatePercent: "68.00" },
  { name: "Diego Herrera",     strategyType: "swing", experienceYears: 8,  winRatePercent: "64.00" },
  { name: "Amara Diallo",      strategyType: "swing", experienceYears: 7,  winRatePercent: "65.00" },
  // Hybrid – 11 traders
  { name: "Ryan Thornton",     strategyType: "hybrid", experienceYears: 10, winRatePercent: "69.00" },
  { name: "Kenji Watanabe",    strategyType: "hybrid", experienceYears: 8,  winRatePercent: "68.00" },
  { name: "Sarah Kowalski",    strategyType: "hybrid", experienceYears: 12, winRatePercent: "70.00" },
  { name: "Ali Reza",          strategyType: "hybrid", experienceYears: 6,  winRatePercent: "66.00" },
  { name: "Monica Reinholt",   strategyType: "hybrid", experienceYears: 9,  winRatePercent: "68.00" },
  { name: "Kai Zhang",         strategyType: "hybrid", experienceYears: 11, winRatePercent: "70.00" },
  { name: "Ingrid Sorenson",   strategyType: "hybrid", experienceYears: 7,  winRatePercent: "67.00" },
  { name: "Tariq Mansoor",     strategyType: "hybrid", experienceYears: 8,  winRatePercent: "69.00" },
  { name: "Clara von Buren",   strategyType: "hybrid", experienceYears: 14, winRatePercent: "71.00" },
  { name: "Olga Stravinsky",   strategyType: "hybrid", experienceYears: 6,  winRatePercent: "67.00" },
  { name: "Jack Madden",       strategyType: "hybrid", experienceYears: 9,  winRatePercent: "68.00" },
];

async function ensureSeeded() {
  const [row] = await db.select({ n: count() }).from(tradersTable);
  if ((row?.n ?? 0) === 0) {
    await db.insert(tradersTable).values(SEED_TRADERS);
  }
}

router.get("/trading-desk/stats", async (_req: AuthRequest, res) => {
  await ensureSeeded();

  const allTraders = await db.select().from(tradersTable).where(eq(tradersTable.isActive, true));

  const totalTraders = allTraders.length;
  const combinedExperience = allTraders.reduce((s, t) => s + t.experienceYears, 0);
  const avgExperience = totalTraders > 0 ? +(combinedExperience / totalTraders).toFixed(1) : 0;

  const strategyMap: Record<string, { count: number; totalWinRate: number }> = {};
  for (const t of allTraders) {
    if (!strategyMap[t.strategyType]) strategyMap[t.strategyType] = { count: 0, totalWinRate: 0 };
    strategyMap[t.strategyType]!.count += 1;
    strategyMap[t.strategyType]!.totalWinRate += parseFloat(String(t.winRatePercent));
  }

  const strategies = Object.entries(strategyMap).map(([type, data]) => ({
    type,
    label: STRATEGY_LABELS[type] ?? type,
    count: data.count,
    avgWinRate: +(data.totalWinRate / data.count).toFixed(1),
    percentage: totalTraders > 0 ? +((data.count / totalTraders) * 100).toFixed(1) : 0,
  }));

  const overallAvgWinRate = totalTraders > 0
    ? +(allTraders.reduce((s, t) => s + parseFloat(String(t.winRatePercent)), 0) / totalTraders).toFixed(1)
    : 0;

  res.json({
    totalTraders,
    combinedExperience,
    avgExperience,
    overallAvgWinRate,
    strategies,
  });
});

router.get("/trading-desk/traders", async (_req: AuthRequest, res) => {
  await ensureSeeded();
  const traders = await db
    .select()
    .from(tradersTable)
    .where(eq(tradersTable.isActive, true));

  res.json({ data: traders.map((t) => ({
    id: t.id,
    name: t.name,
    strategyType: t.strategyType,
    strategyLabel: STRATEGY_LABELS[t.strategyType] ?? t.strategyType,
    experienceYears: t.experienceYears,
    winRatePercent: parseFloat(String(t.winRatePercent)),
  })) });
});

export default router;
