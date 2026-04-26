import { Router } from "express";
import { db, tasksTable, taskProofsTable, userTaskCompletionsTable, usersTable, pointsTransactionsTable } from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { authMiddleware, adminMiddleware, getParam, getQueryString, type AuthRequest } from "../middlewares/auth";
import { awardPoints } from "../lib/task-service";
import { createNotification } from "../lib/notifications";

const router = Router();
router.use("/admin", authMiddleware);
router.use("/admin", adminMiddleware);

// ---------------------------------------------------------------------------
// GET /admin/task-proofs — list all pending proofs
// ---------------------------------------------------------------------------
router.get("/admin/task-proofs", async (req: AuthRequest, res) => {
  const status = getQueryString(req, "status", "pending");

  const proofs = await db
    .select({
      id: taskProofsTable.id,
      userId: taskProofsTable.userId,
      taskId: taskProofsTable.taskId,
      proofType: taskProofsTable.proofType,
      proofContent: taskProofsTable.proofContent,
      status: taskProofsTable.status,
      adminNote: taskProofsTable.adminNote,
      reviewedAt: taskProofsTable.reviewedAt,
      createdAt: taskProofsTable.createdAt,
      taskTitle: tasksTable.title,
      taskSlug: tasksTable.slug,
      taskPoints: tasksTable.pointReward,
      userEmail: usersTable.email,
      userName: usersTable.fullName,
    })
    .from(taskProofsTable)
    .innerJoin(tasksTable, eq(taskProofsTable.taskId, tasksTable.id))
    .innerJoin(usersTable, eq(taskProofsTable.userId, usersTable.id))
    .where(status === "all" ? undefined : eq(taskProofsTable.status, status))
    .orderBy(desc(taskProofsTable.createdAt))
    .limit(100);

  const [pendingCount] = await db
    .select({ cnt: count() })
    .from(taskProofsTable)
    .where(eq(taskProofsTable.status, "pending"));

  res.json({
    proofs: proofs.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
    })),
    pendingCount: Number(pendingCount?.cnt ?? 0),
  });
});

// ---------------------------------------------------------------------------
// POST /admin/task-proofs/:id/approve — approve a proof and award points
// ---------------------------------------------------------------------------
router.post("/admin/task-proofs/:id/approve", async (req: AuthRequest, res) => {
  const proofId = parseInt(getParam(req, "id"), 10);
  const { adminNote } = req.body;

  const proofs = await db
    .select()
    .from(taskProofsTable)
    .where(eq(taskProofsTable.id, proofId))
    .limit(1);

  if (proofs.length === 0) {
    res.status(404).json({ error: "Proof not found" });
    return;
  }

  const proof = proofs[0]!;
  if (proof.status !== "pending") {
    res.status(400).json({ error: "Proof already reviewed" });
    return;
  }

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, proof.taskId))
    .limit(1);

  const task = tasks[0]!;

  await db
    .update(taskProofsTable)
    .set({
      status: "approved",
      adminNote: adminNote ?? null,
      reviewedBy: req.userId!,
      reviewedAt: new Date(),
    })
    .where(eq(taskProofsTable.id, proofId));

  // Create task completion record
  const [completion] = await db
    .insert(userTaskCompletionsTable)
    .values({
      userId: proof.userId,
      taskId: proof.taskId,
      status: "completed",
      pointsAwarded: task.pointReward,
    })
    .returning();

  // Award points
  const { awarded } = await awardPoints(
    proof.userId,
    task.pointReward,
    "task_reward",
    `${task.title} proof approved`,
    completion!.id,
  );

  await createNotification(
    proof.userId,
    "system",
    "Task Approved!",
    `Your proof for "${task.title}" was approved. You earned ${awarded} points!`,
  );

  res.json({ success: true, pointsAwarded: awarded });
});

// ---------------------------------------------------------------------------
// POST /admin/task-proofs/:id/reject — reject a proof
// ---------------------------------------------------------------------------
router.post("/admin/task-proofs/:id/reject", async (req: AuthRequest, res) => {
  const proofId = parseInt(getParam(req, "id"), 10);
  const { adminNote } = req.body;

  const proofs = await db
    .select()
    .from(taskProofsTable)
    .where(eq(taskProofsTable.id, proofId))
    .limit(1);

  if (proofs.length === 0) {
    res.status(404).json({ error: "Proof not found" });
    return;
  }

  const proof = proofs[0]!;
  if (proof.status !== "pending") {
    res.status(400).json({ error: "Proof already reviewed" });
    return;
  }

  await db
    .update(taskProofsTable)
    .set({
      status: "rejected",
      adminNote: adminNote ?? "Proof rejected by admin",
      reviewedBy: req.userId!,
      reviewedAt: new Date(),
    })
    .where(eq(taskProofsTable.id, proofId));

  const tasks = await db.select({ title: tasksTable.title }).from(tasksTable).where(eq(tasksTable.id, proof.taskId)).limit(1);

  await createNotification(
    proof.userId,
    "system",
    "Task Proof Rejected",
    `Your proof for "${tasks[0]?.title ?? "task"}" was rejected. ${adminNote ? `Reason: ${adminNote}` : "Please try again with valid proof."}`,
  );

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /admin/users/:id/points — manually adjust a user's points
// ---------------------------------------------------------------------------
router.post("/admin/users/:id/points", async (req: AuthRequest, res) => {
  const userId = parseInt(getParam(req, "id"), 10);
  const { amount, reason } = req.body;
  if (typeof amount !== "number" || isNaN(amount)) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const type = amount > 0 ? "admin_grant" : "admin_deduct";

  await db.transaction(async (tx) => {
    await tx.insert(pointsTransactionsTable).values({
      userId,
      amount,
      type,
      description: reason || (amount > 0 ? "Admin point grant" : "Admin point deduction"),
    });
    await tx
      .update(usersTable)
      .set({ points: sql`GREATEST(0, ${usersTable.points} + ${amount})` })
      .where(eq(usersTable.id, userId));
  });

  res.json({ success: true });
});

export default router;
