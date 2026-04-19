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

// ─── Weekly Top Investors ────────────────────────────────────────────────────
router.get("/leaderboard/investors/weekly", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const rows = await db.execute(sql`
      SELECT
        u.id,
        u.full_name                         AS "fullName",
        inv.amount::numeric                 AS "investmentAmount",
        inv.is_active                       AS "isActive",
        COALESCE(SUM(t.amount)::numeric, 0) AS "weeklyProfit"
      FROM users u
      JOIN investments inv ON inv.user_id = u.id AND inv.is_active = true
      JOIN transactions t
        ON  t.user_id    = u.id
        AND t.type       = 'profit'
        AND t.status     = 'completed'
        AND t.created_at >= (NOW() - INTERVAL '7 days')
      WHERE u.is_admin = false
      GROUP BY u.id, u.full_name, inv.amount, inv.is_active
      ORDER BY COALESCE(SUM(t.amount), 0) DESC
      LIMIT 10
    `);

    const myRank = await db.execute(sql`
      WITH ranked AS (
        SELECT
          u.id,
          RANK() OVER (ORDER BY COALESCE(SUM(t.amount), 0) DESC) AS rank
        FROM users u
        JOIN investments inv ON inv.user_id = u.id AND inv.is_active = true
        JOIN transactions t
          ON  t.user_id    = u.id
          AND t.type       = 'profit'
          AND t.status     = 'completed'
          AND t.created_at >= (NOW() - INTERVAL '7 days')
        WHERE u.is_admin = false
        GROUP BY u.id
      )
      SELECT rank FROM ranked WHERE id = ${userId}
    `);

    return res.json({
      leaderboard: rows.rows,
      myRank: myRank.rows[0]?.rank ?? null,
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

    const [investmentRes, referralRes, profitRes, weeklyRankRes, referralRankRes] = await Promise.all([
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
            RANK() OVER (ORDER BY COALESCE(SUM(t.amount), 0) DESC) AS rank
          FROM users u
          JOIN investments inv ON inv.user_id = u.id AND inv.is_active = true
          JOIN transactions t
            ON  t.user_id    = u.id
            AND t.type       = 'profit'
            AND t.status     = 'completed'
            AND t.created_at >= (NOW() - INTERVAL '7 days')
          WHERE u.is_admin = false
          GROUP BY u.id
        )
        SELECT rank FROM ranked WHERE id = ${userId}
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
    const weeklyRank = weeklyRankRes.rows[0]?.rank ? Number(weeklyRankRes.rows[0].rank) : undefined;
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
