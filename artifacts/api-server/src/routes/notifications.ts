import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authMiddleware);

function fmt(n: typeof notificationsTable.$inferSelect) {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

router.get("/notifications", async (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query["limit"] as string) || 20, 50);
  const unreadOnly = req.query["unread"] === "true";

  const condition = unreadOnly
    ? and(eq(notificationsTable.userId, req.userId!), eq(notificationsTable.isRead, false))
    : eq(notificationsTable.userId, req.userId!);

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(condition)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);

  const unreadCount = (
    await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, req.userId!), eq(notificationsTable.isRead, false)))
  ).length;

  res.json({ notifications: rows.map(fmt), unreadCount });
});

router.patch("/notifications/:id/read", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [updated] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId!)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(fmt(updated));
});

router.patch("/notifications/read-all", async (req: AuthRequest, res) => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, req.userId!));

  res.json({ success: true });
});

router.delete("/notifications/:id", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db
    .delete(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId!)));

  res.json({ success: true });
});

export default router;
