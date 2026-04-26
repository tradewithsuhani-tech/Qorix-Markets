import { Router } from "express";
import { db, tasksTable, taskProofsTable, userTaskCompletionsTable, usersTable, pointsTransactionsTable } from "@workspace/db";
import { eq, and, desc, sum } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import {
  completeTask,
  getUserTasksWithStatus,
  awardPoints,
  hasCompletedTaskEver,
  DAILY_POINTS_CAP,
} from "../lib/task-service";
import { createNotification } from "../lib/notifications";

const router = Router();
router.use(authMiddleware);

// ---------------------------------------------------------------------------
// GET /tasks — list all tasks with user completion status
// ---------------------------------------------------------------------------
router.get("/tasks", async (req: AuthRequest, res) => {
  const tasks = await getUserTasksWithStatus(req.userId!);
  res.json(tasks);
});

// ---------------------------------------------------------------------------
// POST /tasks/:slug/complete — complete a no-proof task
// ---------------------------------------------------------------------------
router.post("/tasks/:slug/complete", async (req: AuthRequest, res) => {
  const slug = req.params.slug as string;
  const result = await completeTask(req.userId!, slug);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  if (result.pointsAwarded && result.pointsAwarded > 0) {
    await createNotification(
      req.userId!,
      "system",
      "Task Completed",
      `You earned ${result.pointsAwarded} points for completing a task!`,
    );
  }

  res.json({ success: true, pointsAwarded: result.pointsAwarded ?? 0 });
});

// ---------------------------------------------------------------------------
// POST /tasks/:slug/proof — submit proof for a social task
// ---------------------------------------------------------------------------
router.post("/tasks/:slug/proof", async (req: AuthRequest, res) => {
  const slug = req.params.slug as string;
  const { proofType, proofContent } = req.body;

  if (!proofContent || typeof proofContent !== "string" || proofContent.trim().length < 3) {
    res.status(400).json({ error: "Proof content is required" });
    return;
  }

  const validProofTypes = ["text", "url", "image_base64"];
  const type = validProofTypes.includes(proofType) ? proofType : "text";

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.slug, slug), eq(tasksTable.isActive, true)))
    .limit(1);

  if (tasks.length === 0) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const task = tasks[0]!;

  if (!task.requiresProof) {
    res.status(400).json({ error: "This task does not require proof" });
    return;
  }

  // Check if user already has a pending or approved proof
  const existingProof = await db
    .select({ id: taskProofsTable.id, status: taskProofsTable.status })
    .from(taskProofsTable)
    .where(
      and(
        eq(taskProofsTable.userId, req.userId!),
        eq(taskProofsTable.taskId, task.id),
      ),
    )
    .orderBy(desc(taskProofsTable.createdAt))
    .limit(1);

  if (existingProof.length > 0) {
    const st = existingProof[0]!.status;
    if (st === "pending") {
      res.status(409).json({ error: "Proof already submitted and pending review" });
      return;
    }
    if (st === "approved") {
      res.status(409).json({ error: "Task already approved" });
      return;
    }
  }

  const [proof] = await db
    .insert(taskProofsTable)
    .values({
      userId: req.userId!,
      taskId: task.id,
      proofType: type,
      proofContent: proofContent.trim(),
      status: "pending",
    })
    .returning();

  res.status(201).json({ success: true, proofId: proof!.id, status: "pending" });
});

// ---------------------------------------------------------------------------
// GET /points — get user point balance and recent history
// ---------------------------------------------------------------------------
router.get("/points", async (req: AuthRequest, res) => {
  const user = await db
    .select({ points: usersTable.points })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  const balance = user[0]?.points ?? 0;

  const history = await db
    .select()
    .from(pointsTransactionsTable)
    .where(eq(pointsTransactionsTable.userId, req.userId!))
    .orderBy(desc(pointsTransactionsTable.createdAt))
    .limit(50);

  res.json({
    balance,
    dailyCap: DAILY_POINTS_CAP,
    history: history.map((h) => ({
      id: h.id,
      amount: h.amount,
      type: h.type,
      description: h.description,
      createdAt: h.createdAt.toISOString(),
    })),
  });
});

export default router;
