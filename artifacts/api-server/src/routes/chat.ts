import { Router } from "express";
import { db } from "@workspace/db";
import {
  chatSessionsTable,
  chatMessagesTable,
  chatConversionEventsTable,
  usersTable,
  walletsTable,
  investmentsTable,
  transactionsTable,
} from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { authMiddleware, adminMiddleware, getParam, type AuthRequest } from "../middlewares/auth";
import { makeRedisLimiter } from "../middlewares/rate-limit";
import {
  generateAssistantReply,
  computeEngagementBoost,
  type SessionProfile,
  type UserContext,
  type ChatHistoryItem,
} from "../lib/chat-llm";
import { isLLMAvailable } from "../lib/openai-client";
import { logger } from "../lib/logger";
import type { Response } from "express";

const router = Router();

// ─── Constants ───────────────────────────────────────────────────────────────

// CTA appears once a user is "engaged" — accumulated through `computeEngagementBoost`.
// Roughly: 3 turns of small-talk hits this, or 2 turns with a positive keyword,
// or one explicit ready_to_invest LLM signal (which forces show separately).
const ENGAGEMENT_CTA_THRESHOLD = 3;

// Per-session daily token budget — once exceeded for the current UTC day,
// the LLM is bypassed in favor of the rule-tree fallback so a single user
// can't consume unbounded credit. Counter resets at the next UTC date
// rollover via `llmBudgetDate` on the session row.
const SESSION_DAILY_TOKEN_BUDGET = 200_000;

// Polite fallback when the LLM is exhausted, disabled, or down. Keeps the
// chat usable instead of erroring.
const FALLBACK_REPLY =
  "Let me hand you over to our human team for this one — they'll respond personally. You can also use the quick options below to explore the platform.";

// Quick-option set rendered alongside the fallback reply. Mirrors the rule-
// tree shape so the frontend can keep using its existing option-button
// renderer without a special branch — value strings match the existing
// `handleOptionClick()` switch on the client.
const FALLBACK_QUICK_OPTIONS = [
  { label: "🚀 How to Start", value: "how_to_start" },
  { label: "📊 Investment Plans", value: "investment_guide" },
  { label: "💬 Talk to Expert", value: "expert" },
  { label: "🏠 Back to Menu", value: "main_menu" },
];

// Returns true if `d` (UTC) falls on a different calendar day from "now".
// Used to gate the per-session per-day token reset.
function isStaleBudgetDate(d: Date | null | undefined, now: Date = new Date()): boolean {
  if (!d) return true;
  return (
    d.getUTCFullYear() !== now.getUTCFullYear() ||
    d.getUTCMonth() !== now.getUTCMonth() ||
    d.getUTCDate() !== now.getUTCDate()
  );
}

// ─── Per-user LLM rate limiter ───────────────────────────────────────────────
// 30 LLM calls / hour / user is generous for a normal back-and-forth chat
// (about a turn every 2 minutes for a full hour) but stops a runaway script
// from running up a credit bill. Falls back to the rule-tree reply when hit.
const llmReplyLimiter = makeRedisLimiter({
  name: "chat-llm-reply",
  windowMs: 60 * 60 * 1000,
  limit: 30,
  message: {
    error: "Too many AI replies — please slow down or talk to a human expert.",
    code: "llm_rate_limited",
    fallbackReply: FALLBACK_REPLY,
  },
  // authMiddleware (mounted before this limiter on /chat/llm-reply) guarantees
  // userId is set, so we key purely off the user — no req.ip fallback. This
  // also sidesteps express-rate-limit's IPv6 keygen validator which trips on
  // any keyGenerator that touches req.ip without going through ipKeyGenerator.
  keyGenerator: (req) => `u:${(req as AuthRequest).userId}`,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loadUserContext(userId: number): Promise<UserContext | null> {
  const userRows = await db
    .select({
      fullName: usersTable.fullName,
      kycStatus: usersTable.kycStatus,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!userRows.length) return null;
  const u = userRows[0]!;

  const walletRows = await db
    .select({
      mainBalance: walletsTable.mainBalance,
      tradingBalance: walletsTable.tradingBalance,
      profitBalance: walletsTable.profitBalance,
    })
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);
  const w = walletRows[0] ?? { mainBalance: "0", tradingBalance: "0", profitBalance: "0" };

  const invRows = await db
    .select({ isActive: investmentsTable.isActive })
    .from(investmentsTable)
    .where(eq(investmentsTable.userId, userId))
    .limit(1);
  const hasActiveInvestment = invRows[0]?.isActive ?? false;

  // Sum of completed deposits — uses a SQL aggregate so we never pull the
  // full transactions table for a chat reply on a heavy account.
  const depositRows = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)::text`,
      count: sql<string>`COUNT(*)::text`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "deposit"),
        eq(transactionsTable.status, "completed"),
      ),
    );
  const totalDeposited = depositRows[0]?.total ?? "0";
  const depositCount = parseInt(depositRows[0]?.count ?? "0", 10);

  const daysSinceSignup = u.createdAt
    ? Math.floor((Date.now() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    fullName: u.fullName,
    kycStatus: u.kycStatus,
    walletMain: String(w.mainBalance),
    walletProfit: String(w.profitBalance),
    walletTrading: String(w.tradingBalance),
    hasActiveInvestment,
    totalDeposited,
    daysSinceSignup,
    hasMadeFirstDeposit: depositCount > 0,
  };
}

function mergeProfile(existing: SessionProfile, updates: SessionProfile): SessionProfile {
  // Shallow merge with array union for known list fields so we don't keep
  // overwriting `mentioned_objections` on every turn.
  const merged: SessionProfile = { ...existing, ...updates };
  for (const key of ["mentioned_objections", "last_topics"] as const) {
    const a = Array.isArray(existing[key]) ? (existing[key] as string[]) : [];
    const b = Array.isArray(updates[key]) ? (updates[key] as string[]) : [];
    if (a.length || b.length) {
      merged[key] = Array.from(new Set([...a, ...b])).slice(-10);
    }
  }
  return merged;
}

// Localized "let me take you there" acknowledgments shown in the chat
// after the user taps a navigation CTA, BEFORE we route them away. This is
// what makes the bot feel like a real human on the other side rather than
// an instant page-redirect — the user sees a warm sentence acknowledging
// their click and inviting them to come back, then we navigate.
function ctaAckText(variant: string, language: string | null | undefined): string {
  const lang = (language ?? "en").toLowerCase();
  const isHindi = lang === "hi" || lang.startsWith("hi-");
  const isHinglish = lang === "hinglish" || lang === "hi-en";

  switch (variant) {
    case "view_dashboard":
      if (isHindi) {
        return "Live dashboard. Equity curve, open positions, payout history — sab real-time. Wapas yahin aana ho toh chat reopen kar dena.";
      }
      if (isHinglish) {
        return "Live dashboard. Equity curve, open positions, payout history — sab real-time. Wapas chat me aana ho toh reopen kar dena.";
      }
      return "Live dashboard. Equity curve, open positions, payout history — all real-time. Reopen the chat anytime.";

    case "small_deposit":
      if (isHindi) {
        return "Conservative tier se start karo — ₹500 minimum, drawdown ceiling 3%, withdraw kabhi bhi.";
      }
      if (isHinglish) {
        return "Conservative tier se start karo — ₹500 minimum, drawdown ceiling 3%, withdraw kabhi bhi.";
      }
      return "Start at Conservative — ₹500 / $10 minimum, 3% drawdown ceiling, withdraw anytime.";

    case "talk_to_expert":
      if (isHindi) {
        return "Advisor connect kar raha hoon. Ek minute.";
      }
      if (isHinglish) {
        return "Advisor connect kar raha hoon. Ek minute.";
      }
      return "Connecting an advisor. One minute.";

    default:
      return "On it.";
  }
}

function buildCtaCard(
  variant: string,
  language?: string | null,
): { variant: string; label: string; href?: string; action?: string; ackText: string } {
  const ackText = ctaAckText(variant, language);
  switch (variant) {
    case "small_deposit":
      return {
        variant,
        label: "Start with a small deposit",
        href: "/deposit",
        ackText,
      };
    case "view_dashboard":
      return {
        variant,
        label: "Show me the dashboard",
        href: "/dashboard",
        ackText,
      };
    case "talk_to_expert":
      return {
        variant,
        label: "Talk to a human advisor",
        action: "request_expert",
        ackText,
      };
    default:
      return { variant, label: "Continue", href: "/dashboard", ackText };
  }
}

// ─── Routes: existing core chat ─────────────────────────────────────────────

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

    if (!session.length || session[0]!.userId !== req.userId!) {
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
    if (!session.length || session[0]!.userId !== userId) {
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
    if (!session.length || session[0]!.userId !== userId) {
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

    if (!session.length || session[0]!.userId !== req.userId!) {
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
    if (!session.length || session[0]!.userId !== userId) {
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

// ─── LLM REPLY ENDPOINT (Task 101) ──────────────────────────────────────────
// Called when the user types a free-form message (not a quick-option click).
// Persists both the user message and the assistant reply, updates session
// profile/intent/engagement, and returns the reply + optional CTA card.
router.post(
  "/chat/llm-reply",
  authMiddleware,
  llmReplyLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { sessionId: rawSessionId, content } = req.body ?? {};
      const sessionId = Number(rawSessionId);
      const userMessage = typeof content === "string" ? content.trim() : "";

      if (!sessionId || !userMessage) {
        res.status(400).json({ error: "sessionId and non-empty content required" });
        return;
      }
      if (userMessage.length > 2000) {
        res.status(400).json({ error: "Message too long (max 2000 chars)" });
        return;
      }

      const sessionRows = await db
        .select()
        .from(chatSessionsTable)
        .where(eq(chatSessionsTable.id, sessionId))
        .limit(1);
      const session = sessionRows[0];
      if (!session || session.userId !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      // Expert mode: the LLM stops replying — humans take over. Still persist
      // the user's message so the admin sees it; just don't generate a bot
      // reply.
      if (session.status === "expert_requested") {
        const [savedUser] = await db
          .insert(chatMessagesTable)
          .values({ sessionId, senderType: "user", senderId: userId, content: userMessage })
          .returning();
        await db
          .update(chatSessionsTable)
          .set({ lastMessageAt: new Date() })
          .where(eq(chatSessionsTable.id, sessionId));
        res.json({
          userMessage: savedUser,
          reply: null,
          expertMode: true,
        });
        return;
      }

      // 1) Persist user message immediately so admins see it even if the LLM call fails.
      const [savedUser] = await db
        .insert(chatMessagesTable)
        .values({ sessionId, senderType: "user", senderId: userId, content: userMessage })
        .returning();

      // 2) Load conversation history + user context.
      const history = await db
        .select({ senderType: chatMessagesTable.senderType, content: chatMessagesTable.content })
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.sessionId, sessionId))
        .orderBy(chatMessagesTable.createdAt);
      // The history query intentionally INCLUDES the just-saved message so
      // the LLM sees the same chronology the user does. We pass it as the
      // separate `userMessage` arg too — the chat-llm module places that as
      // the trailing user turn explicitly. To avoid double-inclusion, drop
      // the last item from history when it equals the current user turn.
      const trimmedHistory: ChatHistoryItem[] = history
        .slice(0, -1)
        .map((h) => ({ senderType: h.senderType as ChatHistoryItem["senderType"], content: h.content }));

      const userContext = await loadUserContext(userId);
      if (!userContext) {
        // Should not happen — user authed but row missing. Fail soft.
        res.status(500).json({ error: "User profile not found" });
        return;
      }

      const sessionProfile = (session.profile ?? {}) as SessionProfile;
      const turnCount = trimmedHistory.filter((h) => h.senderType === "user").length + 1;

      // 3) Cost guardrail — once a session burns through its DAILY budget we
      // refuse the LLM and serve the fallback. Caller-side rate limiter
      // (above) handles per-user volume; this one handles per-session token
      // spend on a per-UTC-day basis (a small number of calls with very long
      // inputs could otherwise explode the cost). If the stored budget date
      // has rolled over, reset the counter to 0 before applying the check.
      const now = new Date();
      const budgetIsStale = isStaleBudgetDate(session.llmBudgetDate ?? null, now);
      const tokensUsedToday = budgetIsStale ? 0 : session.llmTokensUsed;
      const llmDisabled = !isLLMAvailable() || tokensUsedToday >= SESSION_DAILY_TOKEN_BUDGET;
      let llmResult = null as Awaited<ReturnType<typeof generateAssistantReply>>;
      if (!llmDisabled) {
        llmResult = await generateAssistantReply({
          history: trimmedHistory,
          userMessage,
          userContext,
          sessionProfile,
          turnCount,
        });
      }

      const replyText = llmResult?.reply ?? FALLBACK_REPLY;
      const metadata = llmResult?.metadata;
      // When the LLM is bypassed (unavailable / daily-budget-exceeded) we
      // surface the legacy rule-tree quick-options so the user still has the
      // expected next-step buttons + an explicit Talk-to-Expert hand-off.
      // The frontend renders these the same way it renders the static FLOWS
      // option grids.
      const fallbackOptions = llmResult ? null : FALLBACK_QUICK_OPTIONS;

      // 4) Persist assistant reply.
      const [savedAssistant] = await db
        .insert(chatMessagesTable)
        .values({ sessionId, senderType: "bot", content: replyText })
        .returning();

      // 5) Update session: profile merge, intent, language, engagement, counters.
      const engagementBoost = computeEngagementBoost(userMessage);
      const newEngagementScore = session.engagementScore + engagementBoost;
      const mergedProfile = metadata
        ? mergeProfile(sessionProfile, metadata.profileUpdates)
        : sessionProfile;

      // CTA shows when: LLM explicitly says high engagement & emits a variant,
      // OR engagement score crossed the threshold AND the model emitted a
      // variant. We never show a CTA the LLM didn't pick a variant for.
      const ctaEligible =
        Boolean(metadata?.shouldShowCta) &&
        Boolean(metadata?.ctaVariant) &&
        (metadata!.engagementSignal === "high" || newEngagementScore >= ENGAGEMENT_CTA_THRESHOLD);

      const ctaCard = ctaEligible && metadata?.ctaVariant
        ? buildCtaCard(metadata.ctaVariant, metadata.language)
        : null;

      // Per-day token accounting: if the budget date rolled over, restart
      // today's count at this call's usage; otherwise add to the running
      // total. Either way `llmBudgetDate` is bumped to "now" so the next
      // call sees a fresh anchor.
      const tokensThisCall = llmResult?.tokensUsed ?? 0;
      const newTokensUsed = budgetIsStale ? tokensThisCall : session.llmTokensUsed + tokensThisCall;

      await db
        .update(chatSessionsTable)
        .set({
          lastMessageAt: new Date(),
          ...(metadata?.detectedIntent ? { detectedIntent: metadata.detectedIntent } : {}),
          ...(metadata?.language ? { language: metadata.language } : {}),
          engagementScore: newEngagementScore,
          profile: mergedProfile,
          llmReplyCount: session.llmReplyCount + 1,
          llmTokensUsed: newTokensUsed,
          llmBudgetDate: now,
          ...(ctaEligible ? { ctaShownCount: session.ctaShownCount + 1 } : {}),
        })
        .where(eq(chatSessionsTable.id, sessionId));

      // 6) Audit-log a cta_shown event when one was rendered.
      if (ctaEligible && ctaCard) {
        await db.insert(chatConversionEventsTable).values({
          sessionId,
          userId,
          eventType: "cta_shown",
          metadata: { variant: ctaCard.variant, intent: metadata?.detectedIntent ?? null },
        });
      }

      res.json({
        userMessage: savedUser,
        reply: { ...savedAssistant, content: replyText },
        cta: ctaCard,
        intent: metadata?.detectedIntent ?? null,
        language: metadata?.language ?? null,
        engagementScore: newEngagementScore,
        // `quickOptions` is non-null only when the LLM was bypassed; the
        // client renders these as buttons identical to the rule-tree FLOWS.
        quickOptions: fallbackOptions,
        llmDisabled,
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[chat] /chat/llm-reply failed");
      // Surface the rule-tree quick options on hard failure too — keeps the
      // user moving instead of dead-ending the chat.
      res.status(500).json({
        error: "Failed to generate reply",
        fallbackReply: FALLBACK_REPLY,
        quickOptions: FALLBACK_QUICK_OPTIONS,
      });
    }
  },
);

// ─── Conversion-event endpoints (Task 101, Step 8) ──────────────────────────

// CTA clicked — frontend calls this when a user taps a CTA card.
router.post("/chat/cta-click", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { sessionId: rawSessionId, variant } = req.body ?? {};
    const sessionId = Number(rawSessionId);
    if (!sessionId) {
      res.status(400).json({ error: "sessionId required" });
      return;
    }
    const sessionRows = await db
      .select()
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, sessionId))
      .limit(1);
    if (!sessionRows.length || sessionRows[0]!.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db
      .update(chatSessionsTable)
      .set({ ctaClickedCount: sessionRows[0]!.ctaClickedCount + 1 })
      .where(eq(chatSessionsTable.id, sessionId));
    await db.insert(chatConversionEventsTable).values({
      sessionId,
      userId,
      eventType: "cta_clicked",
      metadata: { variant: variant ?? null },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to log CTA click" });
  }
});

// Deposit page visited from chat — frontend reads ?src=chat&sid=N from URL
// and calls this once. Idempotent-ish: we still log every visit so the admin
// can see how many times the user re-entered the funnel.
router.post("/chat/deposit-visit", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { sessionId: rawSessionId } = req.body ?? {};
    const sessionId = Number(rawSessionId);
    if (!sessionId) {
      res.status(400).json({ error: "sessionId required" });
      return;
    }
    const sessionRows = await db
      .select({ userId: chatSessionsTable.userId })
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, sessionId))
      .limit(1);
    if (!sessionRows.length || sessionRows[0]!.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db.insert(chatConversionEventsTable).values({
      sessionId,
      userId,
      eventType: "deposit_page_visited",
      metadata: {},
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to log deposit visit" });
  }
});

// Deposit completed — server-AUTHORITATIVE conversion stamping. The client
// pings this endpoint from the deposit page when it believes a deposit has
// been credited, but we DO NOT trust the client's word. Before stamping
// `converted_at` we look for an actual completed deposit transaction owned
// by this user that was created after the chat session started. Only then
// do we mark the session as converted and log the deposit_completed event.
//
// This makes the conversion signal spoof-resistant: a malicious client
// hitting this endpoint without a real deposit on record will get a 200
// {success:false,reason:"no_deposit_found"} but the session row stays
// untouched and no analytics event fires.
router.post("/chat/deposit-complete", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { sessionId: rawSessionId } = req.body ?? {};
    const sessionId = Number(rawSessionId);
    if (!sessionId) {
      res.status(400).json({ error: "sessionId required" });
      return;
    }
    const sessionRows = await db
      .select()
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, sessionId))
      .limit(1);
    if (!sessionRows.length || sessionRows[0]!.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const sess = sessionRows[0]!;

    // Server-side verification: pull the most recent completed deposit for
    // this user that landed AFTER the session started. We use session.createdAt
    // as the floor so historical deposits don't get attributed.
    const depositRows = await db
      .select({
        id: transactionsTable.id,
        amount: transactionsTable.amount,
        createdAt: transactionsTable.createdAt,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "deposit"),
          eq(transactionsTable.status, "completed"),
          sql`${transactionsTable.createdAt} >= ${sess.createdAt}`,
        ),
      )
      .orderBy(desc(transactionsTable.createdAt))
      .limit(1);

    if (!depositRows.length) {
      // No qualifying deposit on record — refuse to log conversion. Return
      // 200 (this endpoint is fire-and-forget from the client) with a
      // structured reason so admins can debug if needed.
      res.json({ success: false, reason: "no_deposit_found" });
      return;
    }

    const deposit = depositRows[0]!;

    if (!sess.convertedAt) {
      await db
        .update(chatSessionsTable)
        .set({ convertedAt: new Date() })
        .where(eq(chatSessionsTable.id, sessionId));
    }
    await db.insert(chatConversionEventsTable).values({
      sessionId,
      userId,
      eventType: "deposit_completed",
      metadata: {
        transactionId: deposit.id,
        amount: deposit.amount,
        depositCreatedAt: deposit.createdAt,
      },
    });
    res.json({ success: true, alreadyConverted: Boolean(sess.convertedAt) });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[chat] /chat/deposit-complete failed");
    res.status(500).json({ error: "Failed to log deposit completion" });
  }
});

// ─── ADMIN ROUTES ───────────────────────────────────────────

// List all chat sessions (admin only) — now enriched with intent/engagement/CTA stats.
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
        detectedIntent: chatSessionsTable.detectedIntent,
        language: chatSessionsTable.language,
        engagementScore: chatSessionsTable.engagementScore,
        profile: chatSessionsTable.profile,
        ctaShownCount: chatSessionsTable.ctaShownCount,
        ctaClickedCount: chatSessionsTable.ctaClickedCount,
        convertedAt: chatSessionsTable.convertedAt,
        llmReplyCount: chatSessionsTable.llmReplyCount,
      })
      .from(chatSessionsTable)
      .leftJoin(usersTable, eq(chatSessionsTable.userId, usersTable.id))
      .orderBy(desc(chatSessionsTable.lastMessageAt));

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// Get messages + session details for a session (admin only)
router.get("/admin/chats/:id/messages", authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = parseInt(getParam(req, "id"));
    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.sessionId, sessionId))
      .orderBy(chatMessagesTable.createdAt);

    const session = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId)).limit(1);

    const events = await db
      .select()
      .from(chatConversionEventsTable)
      .where(eq(chatConversionEventsTable.sessionId, sessionId))
      .orderBy(desc(chatConversionEventsTable.createdAt))
      .limit(50);

    res.json({ messages, session: session[0] || null, events });
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
