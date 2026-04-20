import {
  db,
  usersTable,
  tasksTable,
  userTaskCompletionsTable,
  taskProofsTable,
  pointsTransactionsTable,
} from "@workspace/db";
import { eq, and, gte, sql, count, sum } from "drizzle-orm";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Task definitions — seeded once at startup
// ---------------------------------------------------------------------------
export const TASK_DEFINITIONS = [
  // Daily
  {
    slug: "daily_login",
    title: "Daily Login",
    description: "Log in to your account today",
    category: "daily",
    pointReward: 10,
    requiresProof: false,
    requiresKyc: false,
    requiresDeposit: false,
    iconName: "LogIn",
    sortOrder: 1,
  },
  {
    slug: "daily_dashboard",
    title: "Visit Dashboard",
    description: "Open your dashboard today",
    category: "daily",
    pointReward: 5,
    requiresProof: false,
    requiresKyc: false,
    requiresDeposit: false,
    iconName: "LayoutDashboard",
    sortOrder: 2,
  },
  // Social
  {
    slug: "social_twitter_follow",
    title: "Follow on X (Twitter)",
    description: "Follow our official X account and submit proof",
    category: "social",
    pointReward: 50,
    requiresProof: true,
    requiresKyc: false,
    requiresDeposit: false,
    iconName: "Twitter",
    sortOrder: 10,
  },
  {
    slug: "social_telegram_join",
    title: "Join Telegram Group",
    description: "Join our Telegram community and submit proof",
    category: "social",
    pointReward: 40,
    requiresProof: true,
    requiresKyc: false,
    requiresDeposit: false,
    iconName: "MessageCircle",
    sortOrder: 11,
  },
  {
    slug: "social_instagram_follow",
    title: "Follow on Instagram",
    description: "Follow our Instagram page and submit proof",
    category: "social",
    pointReward: 30,
    requiresProof: true,
    requiresKyc: false,
    requiresDeposit: false,
    iconName: "Instagram",
    sortOrder: 12,
  },
  {
    slug: "social_share_platform",
    title: "Share Platform",
    description: "Share Qorix Markets on any social media and submit the link",
    category: "social",
    pointReward: 60,
    requiresProof: true,
    requiresKyc: false,
    requiresDeposit: false,
    iconName: "Share2",
    sortOrder: 13,
  },
  // Weekly / Referral
  {
    slug: "weekly_referral_signup",
    title: "Referral Signs Up",
    description: "One of your referrals creates an account this week",
    category: "weekly",
    pointReward: 100,
    requiresProof: false,
    requiresKyc: false,
    requiresDeposit: false,
    iconName: "UserPlus",
    sortOrder: 20,
  },
  {
    slug: "weekly_referral_kyc",
    title: "Referral Completes KYC",
    description: "One of your referrals completes KYC this week",
    category: "weekly",
    pointReward: 200,
    requiresProof: false,
    requiresKyc: true,
    requiresDeposit: false,
    iconName: "BadgeCheck",
    sortOrder: 21,
  },
  {
    slug: "weekly_referral_deposit",
    title: "Referral Makes First Deposit",
    description: "One of your referrals makes their first deposit this week",
    category: "weekly",
    pointReward: 300,
    requiresProof: false,
    requiresKyc: true,
    requiresDeposit: true,
    iconName: "DollarSign",
    sortOrder: 22,
  },
  // One-time
  {
    slug: "onetime_kyc",
    title: "Complete KYC",
    description: "Submit and pass identity verification",
    category: "one_time",
    pointReward: 500,
    requiresProof: false,
    requiresKyc: false,
    requiresDeposit: false,
    iconName: "ShieldCheck",
    sortOrder: 30,
  },
  {
    slug: "onetime_first_deposit",
    title: "Make Your First Deposit",
    description: "Fund your account for the first time",
    category: "one_time",
    pointReward: 300,
    requiresProof: false,
    requiresKyc: false,
    requiresDeposit: false,
    iconName: "Wallet",
    sortOrder: 31,
  },
] as const;

// ---------------------------------------------------------------------------
// Seed task definitions into the database (idempotent)
// ---------------------------------------------------------------------------
export async function seedTasks(): Promise<void> {
  for (const def of TASK_DEFINITIONS) {
    await db
      .insert(tasksTable)
      .values({
        slug: def.slug,
        title: def.title,
        description: def.description,
        category: def.category,
        pointReward: def.pointReward,
        requiresProof: def.requiresProof,
        requiresKyc: def.requiresKyc,
        requiresDeposit: def.requiresDeposit,
        iconName: def.iconName,
        sortOrder: def.sortOrder,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: tasksTable.slug,
        set: {
          title: def.title,
          description: def.description,
          pointReward: def.pointReward,
          iconName: def.iconName,
          isActive: true,
        },
      });
  }
  logger.info("[task-service] Task definitions seeded");
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const DAILY_POINTS_CAP = 200;
export const WEEKLY_REFERRAL_POINTS_CAP = 1000;

// ---------------------------------------------------------------------------
// Get today's start timestamp
// ---------------------------------------------------------------------------
function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekStart(): Date {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Check how many points a user earned today
// ---------------------------------------------------------------------------
async function dailyPointsEarned(userId: number): Promise<number> {
  const since = todayStart();
  const [row] = await db
    .select({ total: sum(pointsTransactionsTable.amount) })
    .from(pointsTransactionsTable)
    .where(
      and(
        eq(pointsTransactionsTable.userId, userId),
        gte(pointsTransactionsTable.createdAt, since),
        sql`${pointsTransactionsTable.amount} > 0`,
      ),
    );
  return Number(row?.total ?? 0);
}

// ---------------------------------------------------------------------------
// Check if user already completed a task today (for daily tasks)
// ---------------------------------------------------------------------------
export async function hasCompletedTaskToday(userId: number, taskId: number): Promise<boolean> {
  const since = todayStart();
  const rows = await db
    .select({ id: userTaskCompletionsTable.id })
    .from(userTaskCompletionsTable)
    .where(
      and(
        eq(userTaskCompletionsTable.userId, userId),
        eq(userTaskCompletionsTable.taskId, taskId),
        gte(userTaskCompletionsTable.completedAt, since),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Check if user already completed a task this week
// ---------------------------------------------------------------------------
export async function hasCompletedTaskThisWeek(userId: number, taskId: number): Promise<boolean> {
  const since = weekStart();
  const rows = await db
    .select({ id: userTaskCompletionsTable.id })
    .from(userTaskCompletionsTable)
    .where(
      and(
        eq(userTaskCompletionsTable.userId, userId),
        eq(userTaskCompletionsTable.taskId, taskId),
        gte(userTaskCompletionsTable.completedAt, since),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Check if user already completed a task ever (for one-time tasks)
// ---------------------------------------------------------------------------
export async function hasCompletedTaskEver(userId: number, taskId: number): Promise<boolean> {
  const rows = await db
    .select({ id: userTaskCompletionsTable.id })
    .from(userTaskCompletionsTable)
    .where(
      and(
        eq(userTaskCompletionsTable.userId, userId),
        eq(userTaskCompletionsTable.taskId, taskId),
        sql`${userTaskCompletionsTable.status} != 'rejected'`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Award points to a user, respecting the daily cap
// ---------------------------------------------------------------------------
export async function awardPoints(
  userId: number,
  amount: number,
  type: string,
  description: string,
  referenceId?: number,
): Promise<{ awarded: number; capped: boolean }> {
  if (amount <= 0) return { awarded: 0, capped: false };

  const earned = await dailyPointsEarned(userId);
  const remaining = Math.max(0, DAILY_POINTS_CAP - earned);
  const toAward = Math.min(amount, remaining);

  if (toAward <= 0) {
    return { awarded: 0, capped: true };
  }

  await db.transaction(async (tx) => {
    await tx.insert(pointsTransactionsTable).values({
      userId,
      amount: toAward,
      type,
      description,
      referenceId: referenceId ?? null,
    });
    await tx
      .update(usersTable)
      .set({ points: sql`${usersTable.points} + ${toAward}` })
      .where(eq(usersTable.id, userId));
  });

  logger.info({ userId, toAward, type }, "[task-service] Points awarded");
  return { awarded: toAward, capped: toAward < amount };
}

// ---------------------------------------------------------------------------
// Complete a no-proof task immediately
// ---------------------------------------------------------------------------
export async function completeTask(
  userId: number,
  taskSlug: string,
): Promise<{ success: boolean; error?: string; pointsAwarded?: number }> {
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.slug, taskSlug), eq(tasksTable.isActive, true)))
    .limit(1);

  if (tasks.length === 0) return { success: false, error: "Task not found" };
  const task = tasks[0]!;

  if (task.requiresProof) return { success: false, error: "This task requires proof submission" };

  // Check repetition rules
  if (task.category === "daily") {
    if (await hasCompletedTaskToday(userId, task.id)) {
      return { success: false, error: "Already completed today" };
    }
  } else if (task.category === "weekly") {
    if (await hasCompletedTaskThisWeek(userId, task.id)) {
      return { success: false, error: "Already completed this week" };
    }
  } else if (task.category === "one_time") {
    if (await hasCompletedTaskEver(userId, task.id)) {
      return { success: false, error: "Already completed" };
    }
  }

  const [completion] = await db
    .insert(userTaskCompletionsTable)
    .values({
      userId,
      taskId: task.id,
      status: "completed",
      pointsAwarded: task.pointReward,
    })
    .returning();

  const { awarded, capped } = await awardPoints(
    userId,
    task.pointReward,
    "task_reward",
    `${task.title} reward`,
    completion!.id,
  );

  return { success: true, pointsAwarded: awarded };
}

// ---------------------------------------------------------------------------
// Get user's task status list (for the tasks page)
// ---------------------------------------------------------------------------
export async function getUserTasksWithStatus(userId: number) {
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.isActive, true))
    .orderBy(tasksTable.sortOrder);

  const now = new Date();
  const today = todayStart();
  const week = weekStart();

  const results = await Promise.all(
    tasks.map(async (task) => {
      let completed = false;
      let pendingProof = false;

      if (task.category === "daily") {
        completed = await hasCompletedTaskToday(userId, task.id);
      } else if (task.category === "weekly") {
        completed = await hasCompletedTaskThisWeek(userId, task.id);
      } else {
        completed = await hasCompletedTaskEver(userId, task.id);
      }

      if (!completed && task.requiresProof) {
        const proofRows = await db
          .select({ status: taskProofsTable.status })
          .from(taskProofsTable)
          .where(
            and(
              eq(taskProofsTable.userId, userId),
              eq(taskProofsTable.taskId, task.id),
              eq(taskProofsTable.status, "pending"),
            ),
          )
          .limit(1);
        pendingProof = proofRows.length > 0;
      }

      return { ...task, completed, pendingProof };
    }),
  );

  return results;
}
