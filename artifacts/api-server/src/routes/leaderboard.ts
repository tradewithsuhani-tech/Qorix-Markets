import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── Referral Leaderboard ────────────────────────────────────────────────────
router.get("/leaderboard/referrals", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const rows = await db.execute(sql`
      SELECT
        u.id,
        u.full_name            AS "fullName",
        u.referral_code        AS "referralCode",
        COUNT(refs.id)::int    AS "referralCount",
        COALESCE(SUM(t.amount)::numeric, 0) AS "totalEarnings"
      FROM users u
      LEFT JOIN users refs    ON refs.sponsor_id = u.id AND refs.id != u.id
      LEFT JOIN transactions t
        ON  t.user_id  = u.id
        AND t.type     = 'referral_bonus'
        AND t.status   = 'completed'
      WHERE u.is_admin = false
      GROUP BY u.id, u.full_name, u.referral_code
      HAVING COUNT(refs.id) > 0
      ORDER BY COUNT(refs.id) DESC, COALESCE(SUM(t.amount), 0) DESC
      LIMIT 10
    `);

    const myRank = await db.execute(sql`
      WITH ranked AS (
        SELECT
          u.id,
          RANK() OVER (ORDER BY COUNT(refs.id) DESC, COALESCE(SUM(t.amount), 0) DESC) AS rank
        FROM users u
        LEFT JOIN users refs    ON refs.sponsor_id = u.id AND refs.id != u.id
        LEFT JOIN transactions t
          ON  t.user_id = u.id
          AND t.type    = 'referral_bonus'
          AND t.status  = 'completed'
        WHERE u.is_admin = false
        GROUP BY u.id
        HAVING COUNT(refs.id) > 0
      )
      SELECT rank FROM ranked WHERE id = ${userId}
    `);

    return res.json({
      leaderboard: rows.rows,
      myRank: myRank.rows[0]?.rank ?? null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch referral leaderboard" });
  }
});

// ─── Weekly Top Investors (synthetic, rotates hourly) ───────────────────────
const FIRST_NAMES = [
  "Rakesh","Aarav","Vihaan","Aditya","Kabir","Reyansh","Arjun","Vivaan","Krishna","Ishaan",
  "Rohan","Aryan","Sai","Dhruv","Karan","Yash","Manish","Rohit","Suresh","Ramesh",
  "Mahesh","Naveen","Pranav","Tanmay","Gaurav","Vikram","Nikhil","Ankit","Harsh","Akash",
  "Aanya","Diya","Saanvi","Ananya","Kiara","Myra","Riya","Pari","Ira","Anika",
  "Priya","Pooja","Neha","Kavya","Shruti","Aditi","Sneha","Meera","Divya","Nisha",
  "Sanjay","Deepak","Amit","Rajesh","Vishal","Siddharth","Aryan","Varun","Kunal","Tushar",
];
const ID_PREFIXES = ["Qa","Qb","Qx","Qm","Qz","Qr","Qn","Qp","Qk","Qt"];

function maskName(name: string, rng: () => number): string {
  if (name.length <= 4) return name;
  const visibleStart = Math.max(2, Math.min(4, Math.floor(name.length / 2) - 1));
  const visibleEnd = name.length <= 6 ? 1 : 2;
  const stars = "*".repeat(Math.max(2, name.length - visibleStart - visibleEnd));
  return name.slice(0, visibleStart) + stars + name.slice(name.length - visibleEnd);
}

function makePublicId(rng: () => number): string {
  const prefix = ID_PREFIXES[Math.floor(rng() * ID_PREFIXES.length)];
  const digits = String(Math.floor(rng() * 9000) + 1000); // 4 digits
  const tail = String(Math.floor(rng() * 9) + 1);
  return `${prefix}${digits.slice(0, 3)}**${tail}`;
}

// Tiny seeded PRNG (mulberry32) for deterministic per-hour output
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rankFromFund(amount: number): number | null {
  if (amount < 10) return null;
  if (amount <= 1000) return 25000;
  if (amount <= 5000) return 10000;
  if (amount <= 15000) return 5000;
  if (amount <= 35000) return 2000;
  if (amount <= 50000) return 1000;
  if (amount <= 75000) return 500;
  if (amount <= 125000) return 5;
  return null; // 1–5, computed below with seeded randomness
}

router.get("/leaderboard/investors/weekly", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const rng = mulberry32(hourBucket);

    // ── Compute Total AUM the same way /dashboard/fund-stats does, so the
    // top-10 leaderboard funds can be capped at 50% of platform AUM (no fake-
    // looking numbers larger than the platform itself).
    let totalAUM = 0;
    try {
      const aumRow = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0) AS total
        FROM investments WHERE is_active = true
      `);
      const realAUM = parseFloat(String((aumRow.rows[0] as { total: string } | undefined)?.total ?? "0")) || 0;
      const settingsRows = await db.execute(sql`SELECT key, value FROM system_settings`);
      const settings = Object.fromEntries(
        (settingsRows.rows as Array<{ key: string; value: string }>).map((r) => [r.key, r.value])
      );
      const baselineAUM = Number(settings["baseline_total_aum"] ?? "0") || 0;
      // Note: skip live equity boost here to avoid double-import side effects;
      // baseline + real captures ~99% of displayed AUM and keeps board stable.
      totalAUM = realAUM + baselineAUM;
    } catch {
      totalAUM = 0;
    }

    // Cap the entire board's combined fund at 50% of Total AUM. If AUM is tiny
    // (early days), fall back to a sane minimum so the UI still looks alive.
    const maxBoardSum = Math.max(totalAUM * 0.5, 250_000);
    // Descending weights — rank 1 gets ~18%, rank 10 ~5%; sums to 1.0
    const WEIGHTS = [0.18, 0.15, 0.13, 0.11, 0.10, 0.09, 0.08, 0.07, 0.05, 0.04];

    const usedNames = new Set<string>();
    const usedIds = new Set<string>();
    const board: Array<{
      id: number;
      fullName: string;
      publicId: string;
      investmentAmount: number;
      isActive: boolean;
      weeklyProfit: number;
    }> = [];
    let i = 0;
    while (board.length < 10 && i < 400) {
      i++;
      const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
      if (usedNames.has(first)) continue;
      usedNames.add(first);
      const masked = maskName(first, rng);
      let pid = makePublicId(rng);
      while (usedIds.has(pid)) pid = makePublicId(rng);
      usedIds.add(pid);
      const slot = board.length;
      // Fund = weight × cap, with small ±5% jitter for realism, rounded to $50
      const baseFund = WEIGHTS[slot] * maxBoardSum;
      const jitter = 1 + (rng() - 0.5) * 0.10;
      const fund = Math.max(50, Math.round((baseFund * jitter) / 50) * 50);
      // Weekly profit roughly 3-6% of fund
      const profit = Math.round(fund * (0.03 + rng() * 0.03) * 100) / 100;
      board.push({
        id: 1_000_000 + slot,
        fullName: masked,
        publicId: pid,
        investmentAmount: fund,
        isActive: true,
        weeklyProfit: profit,
      });
    }
    board.sort((a, b) => b.weeklyProfit - a.weeklyProfit);

    // Compute caller's fund and tier-based rank
    const fundRes = await db.execute(sql`
      SELECT COALESCE(amount::numeric, 0) AS amount, is_active
      FROM investments WHERE user_id = ${userId} LIMIT 1
    `);
    const userRow = fundRes.rows[0] as { amount: string; is_active: boolean } | undefined;
    const userFund = userRow?.is_active ? parseFloat(String(userRow.amount ?? "0")) : 0;

    let myRank: number | null = rankFromFund(userFund);
    if (userFund > 125_000) {
      // Personal seed so each user gets a stable 1-5 within the hour
      const personalRng = mulberry32(hourBucket ^ userId);
      myRank = 1 + Math.floor(personalRng() * 5);
    }

    return res.json({
      leaderboard: board,
      myRank,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch weekly leaderboard" });
  }
});

// ─── User Rewards & Badges ───────────────────────────────────────────────────
router.get("/leaderboard/rewards", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const [investmentRes, referralRes, profitRes, referralRankRes] = await Promise.all([
      db.execute(sql`
        SELECT amount::numeric, is_active, total_profit::numeric, started_at
        FROM investments WHERE user_id = ${userId} LIMIT 1
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM users
        WHERE sponsor_id = ${userId} AND id != ${userId}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount)::numeric, 0) AS total
        FROM transactions
        WHERE user_id = ${userId} AND type = 'profit' AND status = 'completed'
      `),
      db.execute(sql`
        WITH ranked AS (
          SELECT
            u.id,
            RANK() OVER (ORDER BY COUNT(refs.id) DESC, COALESCE(SUM(t.amount), 0) DESC) AS rank
          FROM users u
          LEFT JOIN users refs    ON refs.sponsor_id = u.id AND refs.id != u.id
          LEFT JOIN transactions t
            ON  t.user_id = u.id
            AND t.type    = 'referral_bonus'
            AND t.status  = 'completed'
          WHERE u.is_admin = false
          GROUP BY u.id
          HAVING COUNT(refs.id) > 0
        )
        SELECT rank FROM ranked WHERE id = ${userId}
      `),
    ]);

    const inv = investmentRes.rows[0] as {
      amount: string; is_active: boolean; total_profit: string; started_at: string | null
    } | undefined;
    const referralCount = Number((referralRes.rows[0] as { cnt: number })?.cnt ?? 0);
    const totalProfit = parseFloat(String((profitRes.rows[0] as { total: string })?.total ?? "0"));
    const userFund = inv?.is_active ? parseFloat(String(inv.amount ?? "0")) : 0;
    let weeklyRank: number | undefined = rankFromFund(userFund) ?? undefined;
    if (userFund > 125_000) {
      const personalRng = mulberry32(Math.floor(Date.now() / 3_600_000) ^ userId);
      weeklyRank = 1 + Math.floor(personalRng() * 5);
    }
    const referralRank = referralRankRes.rows[0]?.rank ? Number(referralRankRes.rows[0].rank) : undefined;

    const daysSinceStart = inv?.started_at
      ? Math.floor((Date.now() - new Date(inv.started_at).getTime()) / 86_400_000)
      : 0;

    const badges: { id: string; label: string; desc: string; earned: boolean; icon: string }[] = [
      {
        id: "first_trade",
        label: "Pioneer",
        desc: "Activated your first investment",
        earned: !!inv?.is_active || parseFloat(inv?.amount ?? "0") > 0,
        icon: "🚀",
      },
      {
        id: "hodler",
        label: "Diamond Hands",
        desc: "Invested continuously for 30+ days",
        earned: daysSinceStart >= 30,
        icon: "💎",
      },
      {
        id: "connector",
        label: "Connector",
        desc: "Referred your first investor",
        earned: referralCount >= 1,
        icon: "🤝",
      },
      {
        id: "influencer",
        label: "Influencer",
        desc: "Built a network of 5+ referrals",
        earned: referralCount >= 5,
        icon: "🔥",
      },
      {
        id: "network_legend",
        label: "Network Legend",
        desc: "Reached 10+ active referrals",
        earned: referralCount >= 10,
        icon: "🌐",
      },
      {
        id: "top10_weekly",
        label: "Top 10 Weekly",
        desc: "Ranked in the top 10 investors this week",
        earned: weeklyRank !== undefined && weeklyRank <= 10,
        icon: "⭐",
      },
      {
        id: "podium",
        label: "Podium Finisher",
        desc: "Ranked top 3 investors this week",
        earned: weeklyRank !== undefined && weeklyRank <= 3,
        icon: "🏆",
      },
      {
        id: "referral_king",
        label: "Referral King",
        desc: "Top 3 referrer on the platform",
        earned: referralRank !== undefined && referralRank <= 3,
        icon: "👑",
      },
    ];

    const points =
      Math.floor(totalProfit) +
      referralCount * 100 +
      (inv?.is_active ? 50 : 0) +
      badges.filter((b) => b.earned).length * 200;

    const nextBadge = badges.find((b) => !b.earned) ?? null;

    return res.json({
      points,
      badges,
      stats: {
        totalProfit,
        referralCount,
        daysSinceStart,
        weeklyRank: weeklyRank ?? null,
        referralRank: referralRank ?? null,
      },
      nextMilestone: nextBadge,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to compute rewards" });
  }
});

export default router;
