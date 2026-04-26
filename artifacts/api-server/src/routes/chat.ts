import { Router } from "express";
import { db } from "@workspace/db";
import { chatSessionsTable, chatMessagesTable, usersTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware, adminMiddleware, getParam, type AuthRequest } from "../middlewares/auth";
import type { Response } from "express";

const router = Router();

// Get or create active session for current user
router.post("/chat/session", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const existing = await db
      .select()
      .from(chatSessionsTable)
      .where(and(eq(chatSessionsTable.userId, userId), eq(chatSessionsTable.status, "active")))
      .orderBy(desc(chatSessionsTable.createdAt))
      .limit(1);

    if (existing.length > 0) {
      res.json({ session: existing[0] });
      return;
    }

    const [session] = await db.insert(chatSessionsTable).values({ userId }).returning();
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: "Failed to create session" });
  }
});

// Get messages for a session
router.get("/chat/session/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = parseInt(getParam(req, "id"));
    const session = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId)).limit(1);

    if (!session.length || session[0].userId !== req.userId!) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.sessionId, sessionId))
      .orderBy(chatMessagesTable.createdAt);

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send a user message (and bot auto-reply handled by frontend flows)
router.post("/chat/message", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { sessionId, content } = req.body;

    const session = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId)).limit(1);
    if (!session.length || session[0].userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [message] = await db
      .insert(chatMessagesTable)
      .values({ sessionId, senderType: "user", senderId: userId, content })
      .returning();

    await db.update(chatSessionsTable).set({ lastMessageAt: new Date() }).where(eq(chatSessionsTable.id, sessionId));

    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Save bot message
router.post("/chat/bot-message", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { sessionId, content } = req.body;

    const session = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId)).limit(1);
    if (!session.length || session[0].userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [message] = await db
      .insert(chatMessagesTable)
      .values({ sessionId, senderType: "bot", content })
      .returning();

    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: "Failed to save bot message" });
  }
});

// End chat (user-initiated)
router.post("/chat/session/:id/end", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = parseInt(getParam(req, "id"));
    const session = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId)).limit(1);

    if (!session.length || session[0].userId !== req.userId!) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.update(chatSessionsTable).set({ status: "resolved" }).where(eq(chatSessionsTable.id, sessionId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to end session" });
  }
});

// Request expert
router.post("/chat/expert", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.body;

    const session = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId)).limit(1);
    if (!session.length || session[0].userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db
      .update(chatSessionsTable)
      .set({ expertRequested: true, status: "expert_requested", lastMessageAt: new Date() })
      .where(eq(chatSessionsTable.id, sessionId));

    // Save system message
    await db.insert(chatMessagesTable).values({
      sessionId,
      senderType: "bot",
      content: "You have been connected to our expert team. An advisor will respond shortly. Our support hours are 9 AM – 6 PM (Mon–Sat).",
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to request expert" });
  }
});

// ─── ADMIN ROUTES ───────────────────────────────────────────

// List all chat sessions (admin only)
router.get("/admin/chats", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await db
      .select({
        id: chatSessionsTable.id,
        userId: chatSessionsTable.userId,
        status: chatSessionsTable.status,
        expertRequested: chatSessionsTable.expertRequested,
        lastMessageAt: chatSessionsTable.lastMessageAt,
        createdAt: chatSessionsTable.createdAt,
        userName: usersTable.fullName,
        userEmail: usersTable.email,
      })
      .from(chatSessionsTable)
      .leftJoin(usersTable, eq(chatSessionsTable.userId, usersTable.id))
      .orderBy(desc(chatSessionsTable.lastMessageAt));

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// Get messages for a session (admin only)
router.get("/admin/chats/:id/messages", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = parseInt(getParam(req, "id"));
    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.sessionId, sessionId))
      .orderBy(chatMessagesTable.createdAt);

    const session = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId)).limit(1);
    res.json({ messages, session: session[0] || null });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Admin reply to a session
router.post("/admin/chats/:id/reply", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = parseInt(getParam(req, "id"));
    const adminId = req.userId!;
    const { content } = req.body;

    if (!content?.trim()) {
      res.status(400).json({ error: "Content required" });
      return;
    }

    const [message] = await db
      .insert(chatMessagesTable)
      .values({ sessionId, senderType: "admin", senderId: adminId, content: content.trim() })
      .returning();

    await db.update(chatSessionsTable).set({ lastMessageAt: new Date() }).where(eq(chatSessionsTable.id, sessionId));

    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: "Failed to send reply" });
  }
});

// Mark session as resolved (admin only)
router.post("/admin/chats/:id/resolve", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = parseInt(getParam(req, "id"));
    await db.update(chatSessionsTable).set({ status: "resolved" }).where(eq(chatSessionsTable.id, sessionId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve session" });
  }
});

export default router;
