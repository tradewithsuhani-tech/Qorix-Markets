import { Router } from "express";
import { db } from "@workspace/db";
import {
  chatSessionsTable,
  chatMessagesTable,
  chatConversionEventsTable,
  chatLeadsTable,
  usersTable,
  walletsTable,
  investmentsTable,
  transactionsTable,
} from "@workspace/db/schema";
import { eq, desc, and, sql, gte, lt, ne, isNull } from "drizzle-orm";
import { authMiddleware, adminMiddleware, getParam, type AuthRequest } from "../middlewares/auth";
import { makeRedisLimiter } from "../middlewares/rate-limit";
import {
  generateAssistantReply,
  computeEngagementBoost,
  normalizePreferredLanguage,
  type SessionProfile,
  type UserContext,
  type ChatHistoryItem,
} from "../lib/chat-llm";
import { isLLMAvailable } from "../lib/openai-client";
import { logger } from "../lib/logger";
import type { Request, Response } from "express";

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

// Get or create the resumable session for the current user.
//
// Resume policy (Task 104): pick the user's MOST RECENT non-resolved session
// (status active OR expert_requested), regardless of how long ago it was
// opened. This is what makes the assistant feel like a continuous
// conversation across visits — a user who closed the tab mid-chat (or even
// signed out and came back next week) lands back in the same thread with
// their full history visible. Only when the user has explicitly hit "End
// Chat" (status = resolved) do we mint a brand new session.
router.post("/chat/session", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const existing = await db
      .select()
      .from(chatSessionsTable)
      .where(and(eq(chatSessionsTable.userId, userId), ne(chatSessionsTable.status, "resolved")))
      .orderBy(desc(chatSessionsTable.lastMessageAt))
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

// Set the user's preferred reply language for this session. Persisted on
// the session row so subsequent /chat/llm-reply calls inject the override
// into the LLM system prompt and the localized CTA acknowledgement helper
// uses the same language. The body accepts "en" | "hi" | "hinglish";
// anything else stores NULL (= "let the LLM mirror naturally").
router.post(
  "/chat/session/:id/language",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const sessionId = parseInt(getParam(req, "id"));
      const { language } = req.body ?? {};

      const sessionRows = await db
        .select()
        .from(chatSessionsTable)
        .where(eq(chatSessionsTable.id, sessionId))
        .limit(1);
      if (!sessionRows.length || sessionRows[0]!.userId !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const normalized = normalizePreferredLanguage(typeof language === "string" ? language : null);
      await db
        .update(chatSessionsTable)
        .set({ preferredLanguage: normalized })
        .where(eq(chatSessionsTable.id, sessionId));

      res.json({ success: true, preferredLanguage: normalized });
    } catch (err) {
      res.status(500).json({ error: "Failed to update language" });
    }
  },
);

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
          preferredLanguage: session.preferredLanguage,
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

      // CTA acknowledgement copy uses the user's explicit pill choice when
      // they've made one, otherwise falls back to whatever language the LLM
      // detected for this turn — keeps the bot voice consistent with the
      // header pill.
      const ctaLanguage = session.preferredLanguage ?? metadata?.language ?? null;
      const ctaCard = ctaEligible && metadata?.ctaVariant
        ? buildCtaCard(metadata.ctaVariant, ctaLanguage)
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

// ─── Chat analytics dashboard (Task 103) ────────────────────────────────────
// Aggregate funnel + cost view across the chat assistant. Powers the
// /admin/chat-analytics page so ops can see at a glance how many chats are
// converting, where users drop off, which intents convert best, and roughly
// what we're spending on the LLM per conversion.
//
// Cost model: gpt-5-mini blended (input + output) is roughly $1 per 1M
// tokens. We track total tokens per session in `chat_sessions.llm_tokens_used`
// (the sum of `usage.total_tokens` returned by the chat completion call), so
// we just multiply by a per-token rate. This is intentionally a rough
// estimate — exact billing comes from the OpenAI dashboard.
const EST_OPENAI_USD_PER_TOKEN = 0.000001;

// Engagement threshold for the funnel "engaged" stage. Mirrors the
// ENGAGEMENT_CTA_THRESHOLD constant above so the funnel and the live CTA
// gating stay aligned.
const ENGAGED_FUNNEL_THRESHOLD = ENGAGEMENT_CTA_THRESHOLD;

// Internal helper: compute the headline totals + funnel-stage counts for
// a single time window. Re-used for the requested range AND the previous
// equivalent window, so the dashboard can render period-over-period deltas
// without doubling the route handler's branching.
async function computeChatAnalyticsTotals(fromDate: Date, toDate: Date) {
  const upperBound = new Date(toDate.getTime() + 1);
  const sessionRange = and(
    gte(chatSessionsTable.createdAt, fromDate),
    lt(chatSessionsTable.createdAt, upperBound),
  );

  const totalsRows = await db
    .select({
      sessions: sql<string>`COUNT(*)::text`,
      aiReplies: sql<string>`COALESCE(SUM(${chatSessionsTable.llmReplyCount}), 0)::text`,
      tokensUsed: sql<string>`COALESCE(SUM(${chatSessionsTable.llmTokensUsed}), 0)::text`,
      ctaShown: sql<string>`COALESCE(SUM(${chatSessionsTable.ctaShownCount}), 0)::text`,
      ctaClicked: sql<string>`COALESCE(SUM(${chatSessionsTable.ctaClickedCount}), 0)::text`,
      sessionsWithCtaShown: sql<string>`COUNT(*) FILTER (WHERE ${chatSessionsTable.ctaShownCount} > 0)::text`,
      sessionsWithCtaClick: sql<string>`COUNT(*) FILTER (WHERE ${chatSessionsTable.ctaClickedCount} > 0)::text`,
      engagedSessions: sql<string>`COUNT(*) FILTER (WHERE ${chatSessionsTable.engagementScore} >= ${ENGAGED_FUNNEL_THRESHOLD})::text`,
      convertedSessions: sql<string>`COUNT(*) FILTER (WHERE ${chatSessionsTable.convertedAt} IS NOT NULL)::text`,
      avgEngagement: sql<string>`COALESCE(AVG(${chatSessionsTable.engagementScore})::numeric(10,2), 0)::text`,
      // Median time-to-conversion in seconds. Uses PERCENTILE_CONT for a
      // continuous median — far more representative than AVG when a few
      // long-tail "user converted 3 weeks later" sessions are mixed in
      // with normal same-session conversions.
      medianTimeToConvertSec: sql<string>`COALESCE(
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (${chatSessionsTable.convertedAt} - ${chatSessionsTable.createdAt}))
        ) FILTER (WHERE ${chatSessionsTable.convertedAt} IS NOT NULL),
        0
      )::text`,
    })
    .from(chatSessionsTable)
    .where(sessionRange);

  const t = totalsRows[0]!;

  const depositVisitRows = await db
    .select({
      sessions: sql<string>`COUNT(DISTINCT ${chatConversionEventsTable.sessionId})::text`,
    })
    .from(chatConversionEventsTable)
    .innerJoin(
      chatSessionsTable,
      eq(chatConversionEventsTable.sessionId, chatSessionsTable.id),
    )
    .where(
      and(
        sessionRange,
        eq(chatConversionEventsTable.eventType, "deposit_page_visited"),
      ),
    );

  return {
    sessions: parseInt(t.sessions, 10),
    aiReplies: parseInt(t.aiReplies, 10),
    tokensUsed: parseInt(t.tokensUsed, 10),
    ctaShown: parseInt(t.ctaShown, 10),
    ctaClicked: parseInt(t.ctaClicked, 10),
    sessionsWithCtaShown: parseInt(t.sessionsWithCtaShown, 10),
    sessionsWithCtaClick: parseInt(t.sessionsWithCtaClick, 10),
    engagedSessions: parseInt(t.engagedSessions, 10),
    convertedSessions: parseInt(t.convertedSessions, 10),
    depositVisitSessions: parseInt(depositVisitRows[0]?.sessions ?? "0", 10),
    avgEngagement: parseFloat(t.avgEngagement) || 0,
    medianTimeToConvertSec: parseFloat(t.medianTimeToConvertSec) || 0,
  };
}

router.get(
  "/admin/chat-analytics",
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      // Parse optional ISO date range. Defaults: last 30 days.
      const now = new Date();
      const defaultFrom = new Date(now);
      defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);

      const fromRaw = typeof req.query.from === "string" ? req.query.from : null;
      const toRaw = typeof req.query.to === "string" ? req.query.to : null;
      const fromDate = fromRaw && !Number.isNaN(Date.parse(fromRaw)) ? new Date(fromRaw) : defaultFrom;
      // For an inclusive `to` date (UI sends a calendar day), bump the upper
      // bound to the start of the next day so events on the `to` day count.
      const toBase = toRaw && !Number.isNaN(Date.parse(toRaw)) ? new Date(toRaw) : now;
      const toDate = new Date(toBase);
      if (toRaw) {
        toDate.setUTCHours(23, 59, 59, 999);
      }
      if (toDate < fromDate) {
        res.status(400).json({ error: "`to` must be on or after `from`" });
        return;
      }

      // Previous equivalent window for period-over-period deltas. Spans
      // exactly the same length as the requested range, immediately before
      // `fromDate`. e.g. selecting "last 7 days" compares against the 7
      // days BEFORE that.
      const rangeMs = toDate.getTime() - fromDate.getTime();
      const prevTo = new Date(fromDate.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - rangeMs);

      const sessionRange = and(
        gte(chatSessionsTable.createdAt, fromDate),
        lt(chatSessionsTable.createdAt, new Date(toDate.getTime() + 1)),
      );

      // Run current totals, previous-period totals, and the per-intent /
      // per-language / variant / objections / time-series queries in
      // parallel — all read-only and independent.
      const [
        currentTotals,
        previousTotals,
        intentRows,
        languageRows,
        variantRows,
        objectionRows,
        timeseriesRows,
      ] = await Promise.all([
        computeChatAnalyticsTotals(fromDate, toDate),
        computeChatAnalyticsTotals(prevFrom, prevTo),

        // ── Per-intent breakdown ────────────────────────────────────────
        db
          .select({
            intent: sql<string>`COALESCE(${chatSessionsTable.detectedIntent}, 'unknown')`,
            sessions: sql<string>`COUNT(*)::text`,
            conversions: sql<string>`COUNT(*) FILTER (WHERE ${chatSessionsTable.convertedAt} IS NOT NULL)::text`,
            ctaShown: sql<string>`COALESCE(SUM(${chatSessionsTable.ctaShownCount}), 0)::text`,
            ctaClicked: sql<string>`COALESCE(SUM(${chatSessionsTable.ctaClickedCount}), 0)::text`,
            engaged: sql<string>`COUNT(*) FILTER (WHERE ${chatSessionsTable.engagementScore} >= ${ENGAGED_FUNNEL_THRESHOLD})::text`,
          })
          .from(chatSessionsTable)
          .where(sessionRange)
          .groupBy(sql`COALESCE(${chatSessionsTable.detectedIntent}, 'unknown')`),

        // ── Per-language breakdown ──────────────────────────────────────
        db
          .select({
            language: sql<string>`COALESCE(${chatSessionsTable.language}, 'unknown')`,
            sessions: sql<string>`COUNT(*)::text`,
            conversions: sql<string>`COUNT(*) FILTER (WHERE ${chatSessionsTable.convertedAt} IS NOT NULL)::text`,
          })
          .from(chatSessionsTable)
          .where(sessionRange)
          .groupBy(sql`COALESCE(${chatSessionsTable.language}, 'unknown')`),

        // ── CTA variant breakdown ───────────────────────────────────────
        // Joins conversion events to sessions so we can scope by the
        // session's createdAt. Counts (impressions, clicks) per variant
        // and the click-through rate is computed in JS afterwards.
        db
          .select({
            variant: sql<string>`COALESCE(${chatConversionEventsTable.metadata}->>'variant', 'unknown')`,
            shown: sql<string>`COUNT(*) FILTER (WHERE ${chatConversionEventsTable.eventType} = 'cta_shown')::text`,
            clicked: sql<string>`COUNT(*) FILTER (WHERE ${chatConversionEventsTable.eventType} = 'cta_clicked')::text`,
          })
          .from(chatConversionEventsTable)
          .innerJoin(
            chatSessionsTable,
            eq(chatConversionEventsTable.sessionId, chatSessionsTable.id),
          )
          .where(
            and(
              sessionRange,
              sql`${chatConversionEventsTable.eventType} IN ('cta_shown', 'cta_clicked')`,
            ),
          )
          .groupBy(sql`COALESCE(${chatConversionEventsTable.metadata}->>'variant', 'unknown')`),

        // ── Top objections ──────────────────────────────────────────────
        // Unfolds the JSONB profile.mentioned_objections array per session
        // and counts each objection. Capped at 8 to keep the UI
        // digestible.
        db.execute<{ objection: string; count: string }>(sql`
          SELECT obj AS objection, COUNT(*)::text AS count
          FROM (
            SELECT jsonb_array_elements_text(profile->'mentioned_objections') AS obj
            FROM chat_sessions
            WHERE created_at >= ${fromDate}
              AND created_at < ${new Date(toDate.getTime() + 1)}
              AND profile ? 'mentioned_objections'
              AND jsonb_typeof(profile->'mentioned_objections') = 'array'
          ) sub
          GROUP BY obj
          ORDER BY COUNT(*) DESC
          LIMIT 8
        `),

        // ── Daily time series ───────────────────────────────────────────
        // Grouped by UTC calendar day. Smaller-than-7-day ranges still
        // return a usable curve; larger ranges naturally aggregate.
        db
          .select({
            day: sql<string>`DATE_TRUNC('day', ${chatSessionsTable.createdAt})::date::text`,
            sessions: sql<string>`COUNT(*)::text`,
            conversions: sql<string>`COUNT(*) FILTER (WHERE ${chatSessionsTable.convertedAt} IS NOT NULL)::text`,
            ctaShown: sql<string>`COALESCE(SUM(${chatSessionsTable.ctaShownCount}), 0)::text`,
            ctaClicked: sql<string>`COALESCE(SUM(${chatSessionsTable.ctaClickedCount}), 0)::text`,
            tokensUsed: sql<string>`COALESCE(SUM(${chatSessionsTable.llmTokensUsed}), 0)::text`,
          })
          .from(chatSessionsTable)
          .where(sessionRange)
          .groupBy(sql`DATE_TRUNC('day', ${chatSessionsTable.createdAt})`)
          .orderBy(sql`DATE_TRUNC('day', ${chatSessionsTable.createdAt})`),
      ]);

      const safeRatio = (num: number, denom: number) => (denom > 0 ? num / denom : 0);

      function buildTotalsView(t: Awaited<ReturnType<typeof computeChatAnalyticsTotals>>) {
        const estimatedCostUsd = t.tokensUsed * EST_OPENAI_USD_PER_TOKEN;
        return {
          sessions: t.sessions,
          aiReplies: t.aiReplies,
          tokensUsed: t.tokensUsed,
          estimatedCostUsd,
          costPerConvertedUsd: safeRatio(estimatedCostUsd, t.convertedSessions),
          ctaShown: t.ctaShown,
          ctaClicked: t.ctaClicked,
          ctaCtr: safeRatio(t.ctaClicked, t.ctaShown),
          depositVisitSessions: t.depositVisitSessions,
          convertedSessions: t.convertedSessions,
          conversionRate: safeRatio(t.convertedSessions, t.sessions),
          avgEngagement: t.avgEngagement,
          avgAiRepliesPerSession: safeRatio(t.aiReplies, t.sessions),
          avgTokensPerSession: safeRatio(t.tokensUsed, t.sessions),
          medianTimeToConvertSec: t.medianTimeToConvertSec,
          estOpenaiUsdPerToken: EST_OPENAI_USD_PER_TOKEN,
        };
      }

      // Densify the time series so the chart has a continuous x-axis even
      // on quiet days (otherwise gaps misrepresent "no traffic" as
      // "didn't ask for that day"). One bucket per UTC day from `from` to
      // `to` inclusive.
      const seriesByDay = new Map(
        timeseriesRows.map((r) => [
          r.day,
          {
            sessions: parseInt(r.sessions, 10),
            conversions: parseInt(r.conversions, 10),
            ctaShown: parseInt(r.ctaShown, 10),
            ctaClicked: parseInt(r.ctaClicked, 10),
            tokensUsed: parseInt(r.tokensUsed, 10),
          },
        ]),
      );
      const densifiedSeries: Array<{
        date: string;
        sessions: number;
        conversions: number;
        ctaShown: number;
        ctaClicked: number;
        tokensUsed: number;
        estCostUsd: number;
      }> = [];
      const cursor = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
      const endCursor = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));
      // Hard cap at 365 days to protect the UI / payload size.
      let safety = 0;
      while (cursor <= endCursor && safety < 365) {
        const key = cursor.toISOString().slice(0, 10);
        const r = seriesByDay.get(key) ?? {
          sessions: 0,
          conversions: 0,
          ctaShown: 0,
          ctaClicked: 0,
          tokensUsed: 0,
        };
        densifiedSeries.push({
          date: key,
          ...r,
          estCostUsd: r.tokensUsed * EST_OPENAI_USD_PER_TOKEN,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        safety++;
      }

      res.json({
        range: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        previousRange: {
          from: prevFrom.toISOString(),
          to: prevTo.toISOString(),
        },
        totals: buildTotalsView(currentTotals),
        previousTotals: buildTotalsView(previousTotals),
        funnel: [
          { stage: "chat_started", label: "Chat started", count: currentTotals.sessions },
          { stage: "engaged", label: `Engaged (score≥${ENGAGED_FUNNEL_THRESHOLD})`, count: currentTotals.engagedSessions },
          { stage: "cta_shown", label: "CTA shown", count: currentTotals.sessionsWithCtaShown },
          { stage: "cta_clicked", label: "CTA clicked", count: currentTotals.sessionsWithCtaClick },
          { stage: "deposit_visit", label: "Deposit page visit", count: currentTotals.depositVisitSessions },
          { stage: "deposit_complete", label: "Deposit complete", count: currentTotals.convertedSessions },
        ],
        intents: intentRows
          .map((r) => {
            const s = parseInt(r.sessions, 10);
            const c = parseInt(r.conversions, 10);
            return {
              intent: r.intent,
              sessions: s,
              conversions: c,
              conversionRate: safeRatio(c, s),
              ctaShown: parseInt(r.ctaShown, 10),
              ctaClicked: parseInt(r.ctaClicked, 10),
              engaged: parseInt(r.engaged, 10),
            };
          })
          .sort((a, b) => b.sessions - a.sessions),
        languages: languageRows
          .map((r) => {
            const s = parseInt(r.sessions, 10);
            const c = parseInt(r.conversions, 10);
            return {
              language: r.language,
              sessions: s,
              conversions: c,
              conversionRate: safeRatio(c, s),
            };
          })
          .sort((a, b) => b.sessions - a.sessions),
        ctaVariants: variantRows
          .map((r) => {
            const shown = parseInt(r.shown, 10);
            const clicked = parseInt(r.clicked, 10);
            return {
              variant: r.variant,
              shown,
              clicked,
              ctr: safeRatio(clicked, shown),
            };
          })
          .sort((a, b) => b.shown - a.shown),
        topObjections: (objectionRows.rows ?? objectionRows).map((r: { objection: string; count: string }) => ({
          objection: r.objection,
          count: parseInt(r.count, 10),
        })),
        timeseries: densifiedSeries,
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[chat] /admin/chat-analytics failed");
      res.status(500).json({ error: "Failed to fetch chat analytics" });
    }
  },
);

// ─── GUEST (anonymous visitor) ROUTES — Task 145, Batch A ──────────────────
// Mirror of the authed `/chat/*` surface for unauthenticated visitors on the
// landing / login / public marketing pages. Sessions are keyed by an opaque
// client-generated `visitorId` (UUID stored in the visitor's localStorage).
// Hardened with IP + visitor rate limits because there is no user gating.

// Conservative: a visitor on the landing page typically sends 1–10 messages
// before either signing up or leaving. 60 LLM calls / hour / visitor is a
// generous ceiling that still caps a runaway script.
const guestLlmReplyLimiter = makeRedisLimiter({
  name: "chat-guest-llm-reply",
  windowMs: 60 * 60 * 1000,
  limit: 60,
  message: {
    error: "Too many AI replies — please slow down or sign up to continue.",
    code: "guest_llm_rate_limited",
    fallbackReply: FALLBACK_REPLY,
  },
  keyGenerator: (req) => {
    const vid = getVisitorId(req as Request);
    // Express-rate-limit's IPv6 keygen validator trips if we touch req.ip
    // directly here, so prefer the visitor cookie/header. Fall back to a
    // stable string when missing — the per-IP global limiter (600/min, see
    // rate-limit.ts) handles those cases as a backstop.
    return vid ? `v:${vid}` : `v:anon`;
  },
});

// Heavier per-IP cap on session-creation specifically so a botnet can't
// mint thousands of empty sessions to flood the admin dashboard.
const guestSessionCreateLimiter = makeRedisLimiter({
  name: "chat-guest-session-create",
  windowMs: 60 * 60 * 1000,
  limit: 30,
  message: { error: "Too many chat sessions — try again later.", code: "guest_session_rate_limited" },
});

// Visitor IDs are client-generated UUIDs. Accept anything that looks like a
// UUID-ish opaque token: 16–64 chars, alphanumeric + dashes/underscores.
// Anything else is rejected to keep junk out of the index.
const VISITOR_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

function getVisitorId(req: Request): string | null {
  const fromHeader = req.headers["x-visitor-id"];
  if (typeof fromHeader === "string" && VISITOR_ID_RE.test(fromHeader)) return fromHeader;
  const fromBody = (req.body as { visitorId?: unknown } | undefined)?.visitorId;
  if (typeof fromBody === "string" && VISITOR_ID_RE.test(fromBody)) return fromBody;
  return null;
}

// Synthetic UserContext for anonymous visitors. The system prompt's
// USER_CONTEXT block uses these fields purely as situational awareness;
// for a guest we want the LLM to treat them as a brand-new prospect with
// zero history.
function guestUserContext(): UserContext {
  return {
    fullName: null,
    kycStatus: "guest",
    walletMain: "0",
    walletProfit: "0",
    walletTrading: "0",
    hasActiveInvestment: false,
    totalDeposited: "0",
    daysSinceSignup: 0,
    hasMadeFirstDeposit: false,
  };
}

// Verify the supplied visitorId actually owns the supplied sessionId.
// Returns the session row when authorised, null otherwise. Centralised so
// every guest endpoint applies the same check.
async function authoriseGuestSession(visitorId: string, sessionId: number) {
  const rows = await db
    .select()
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.id, sessionId))
    .limit(1);
  const sess = rows[0];
  if (!sess) return null;
  if (sess.visitorId !== visitorId) return null;
  return sess;
}

// Resume the visitor's most recent non-resolved session, or mint a new one.
router.post(
  "/chat/guest-session",
  guestSessionCreateLimiter,
  async (req: Request, res: Response) => {
    try {
      const visitorId = getVisitorId(req);
      if (!visitorId) {
        res.status(400).json({ error: "visitorId required (16–64 chars, [A-Za-z0-9_-])" });
        return;
      }

      const existing = await db
        .select()
        .from(chatSessionsTable)
        .where(
          and(
            eq(chatSessionsTable.visitorId, visitorId),
            isNull(chatSessionsTable.userId),
            ne(chatSessionsTable.status, "resolved"),
          ),
        )
        .orderBy(desc(chatSessionsTable.lastMessageAt))
        .limit(1);

      if (existing.length > 0) {
        res.json({ session: existing[0] });
        return;
      }

      const [session] = await db
        .insert(chatSessionsTable)
        .values({ visitorId })
        .returning();
      res.json({ session });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[chat] /chat/guest-session failed");
      res.status(500).json({ error: "Failed to create guest session" });
    }
  },
);

// Fetch messages for a guest session. visitorId required (header or body).
router.get(
  "/chat/guest-session/:id/messages",
  async (req: Request, res: Response) => {
    try {
      const visitorId = getVisitorId(req);
      if (!visitorId) {
        res.status(400).json({ error: "visitorId required" });
        return;
      }
      const sessionId = parseInt(getParam(req as AuthRequest, "id"), 10);
      const sess = await authoriseGuestSession(visitorId, sessionId);
      if (!sess) {
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
  },
);

// Persist a user-typed message for a guest session.
router.post("/chat/guest-message", async (req: Request, res: Response) => {
  try {
    const visitorId = getVisitorId(req);
    const { sessionId, content } = req.body ?? {};
    if (!visitorId || !sessionId || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "visitorId, sessionId, content required" });
      return;
    }
    const sess = await authoriseGuestSession(visitorId, Number(sessionId));
    if (!sess) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [message] = await db
      .insert(chatMessagesTable)
      .values({ sessionId: sess.id, senderType: "user", senderId: null, content })
      .returning();
    await db
      .update(chatSessionsTable)
      .set({ lastMessageAt: new Date() })
      .where(eq(chatSessionsTable.id, sess.id));
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: "Failed to send guest message" });
  }
});

// Persist a bot message for a guest session (used by client-side rule-tree
// flows that don't go through the LLM endpoint).
router.post("/chat/guest-bot-message", async (req: Request, res: Response) => {
  try {
    const visitorId = getVisitorId(req);
    const { sessionId, content } = req.body ?? {};
    if (!visitorId || !sessionId || typeof content !== "string") {
      res.status(400).json({ error: "visitorId, sessionId, content required" });
      return;
    }
    const sess = await authoriseGuestSession(visitorId, Number(sessionId));
    if (!sess) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [message] = await db
      .insert(chatMessagesTable)
      .values({ sessionId: sess.id, senderType: "bot", content })
      .returning();
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: "Failed to save guest bot message" });
  }
});

// End a guest session.
router.post("/chat/guest-session/:id/end", async (req: Request, res: Response) => {
  try {
    const visitorId = getVisitorId(req);
    if (!visitorId) {
      res.status(400).json({ error: "visitorId required" });
      return;
    }
    const sessionId = parseInt(getParam(req as AuthRequest, "id"), 10);
    const sess = await authoriseGuestSession(visitorId, sessionId);
    if (!sess) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db
      .update(chatSessionsTable)
      .set({ status: "resolved" })
      .where(eq(chatSessionsTable.id, sessionId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to end guest session" });
  }
});

// Set the guest's preferred reply language pill.
router.post(
  "/chat/guest-session/:id/language",
  async (req: Request, res: Response) => {
    try {
      const visitorId = getVisitorId(req);
      if (!visitorId) {
        res.status(400).json({ error: "visitorId required" });
        return;
      }
      const sessionId = parseInt(getParam(req as AuthRequest, "id"), 10);
      const sess = await authoriseGuestSession(visitorId, sessionId);
      if (!sess) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const normalized = normalizePreferredLanguage(
        typeof req.body?.language === "string" ? req.body.language : null,
      );
      await db
        .update(chatSessionsTable)
        .set({ preferredLanguage: normalized })
        .where(eq(chatSessionsTable.id, sessionId));
      res.json({ success: true, preferredLanguage: normalized });
    } catch (err) {
      res.status(500).json({ error: "Failed to update language" });
    }
  },
);

// Guest LLM reply — mirror of /chat/llm-reply. No auth, IP+visitor-rate-limited.
// Uses synthetic guest UserContext so the LLM treats the visitor as a brand-
// new prospect. CTA cards are still emitted (the landing-page widget will
// generally route them to /register instead of /deposit — handled client-side).
router.post(
  "/chat/guest-llm-reply",
  guestLlmReplyLimiter,
  async (req: Request, res: Response) => {
    try {
      const visitorId = getVisitorId(req);
      const { sessionId: rawSessionId, content } = req.body ?? {};
      const sessionId = Number(rawSessionId);
      const userMessage = typeof content === "string" ? content.trim() : "";

      if (!visitorId || !sessionId || !userMessage) {
        res.status(400).json({ error: "visitorId, sessionId and non-empty content required" });
        return;
      }
      if (userMessage.length > 2000) {
        res.status(400).json({ error: "Message too long (max 2000 chars)" });
        return;
      }

      const session = await authoriseGuestSession(visitorId, sessionId);
      if (!session) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      // Expert mode for guests: persist the message but don't generate a
      // bot reply. (Guests can't actually request "expert" yet — Batch A
      // does not wire a guest /chat/expert — but if a session was migrated
      // from authed → guest somehow the flag should still be honoured.)
      if (session.status === "expert_requested") {
        const [savedUser] = await db
          .insert(chatMessagesTable)
          .values({ sessionId, senderType: "user", senderId: null, content: userMessage })
          .returning();
        await db
          .update(chatSessionsTable)
          .set({ lastMessageAt: new Date() })
          .where(eq(chatSessionsTable.id, sessionId));
        res.json({ userMessage: savedUser, reply: null, expertMode: true });
        return;
      }

      const [savedUser] = await db
        .insert(chatMessagesTable)
        .values({ sessionId, senderType: "user", senderId: null, content: userMessage })
        .returning();

      const history = await db
        .select({ senderType: chatMessagesTable.senderType, content: chatMessagesTable.content })
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.sessionId, sessionId))
        .orderBy(chatMessagesTable.createdAt);
      const trimmedHistory: ChatHistoryItem[] = history
        .slice(0, -1)
        .map((h) => ({ senderType: h.senderType as ChatHistoryItem["senderType"], content: h.content }));

      const userContext = guestUserContext();
      const sessionProfile = (session.profile ?? {}) as SessionProfile;
      const turnCount = trimmedHistory.filter((h) => h.senderType === "user").length + 1;

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
          preferredLanguage: session.preferredLanguage,
        });
      }

      const replyText = llmResult?.reply ?? FALLBACK_REPLY;
      const metadata = llmResult?.metadata;
      const fallbackOptions = llmResult ? null : FALLBACK_QUICK_OPTIONS;

      const [savedAssistant] = await db
        .insert(chatMessagesTable)
        .values({ sessionId, senderType: "bot", content: replyText })
        .returning();

      const engagementBoost = computeEngagementBoost(userMessage);
      const newEngagementScore = session.engagementScore + engagementBoost;
      const mergedProfile = metadata
        ? mergeProfile(sessionProfile, metadata.profileUpdates)
        : sessionProfile;

      const ctaEligible =
        Boolean(metadata?.shouldShowCta) &&
        Boolean(metadata?.ctaVariant) &&
        (metadata!.engagementSignal === "high" || newEngagementScore >= ENGAGEMENT_CTA_THRESHOLD);

      const ctaLanguage = session.preferredLanguage ?? metadata?.language ?? null;
      const ctaCard = ctaEligible && metadata?.ctaVariant
        ? buildCtaCard(metadata.ctaVariant, ctaLanguage)
        : null;

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

      if (ctaEligible && ctaCard) {
        await db.insert(chatConversionEventsTable).values({
          sessionId,
          userId: null,
          eventType: "cta_shown",
          metadata: { variant: ctaCard.variant, intent: metadata?.detectedIntent ?? null, guest: true },
        });
      }

      res.json({
        userMessage: savedUser,
        reply: { ...savedAssistant, content: replyText },
        cta: ctaCard,
        intent: metadata?.detectedIntent ?? null,
        language: metadata?.language ?? null,
        engagementScore: newEngagementScore,
        quickOptions: fallbackOptions,
        llmDisabled,
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[chat] /chat/guest-llm-reply failed");
      res.status(500).json({
        error: "Failed to generate reply",
        fallbackReply: FALLBACK_REPLY,
        quickOptions: FALLBACK_QUICK_OPTIONS,
      });
    }
  },
);

// Capture lead (email/name/phone) from a guest session for follow-up email.
// Idempotent on (session_id, email) — a second submission updates name/phone
// but does NOT re-arm follow-up.
router.post("/chat/guest-lead", async (req: Request, res: Response) => {
  try {
    const visitorId = getVisitorId(req);
    const { sessionId: rawSessionId, email, name, phone, consent } = req.body ?? {};
    const sessionId = Number(rawSessionId);
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!visitorId || !sessionId || !cleanEmail) {
      res.status(400).json({ error: "visitorId, sessionId, email required" });
      return;
    }
    // Lightweight email format check — full RFC validation would reject too
    // many real addresses. Prefer permissive + downstream SES-bounce handling.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 255) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }
    const sess = await authoriseGuestSession(visitorId, sessionId);
    if (!sess) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const cleanName = typeof name === "string" ? name.trim().slice(0, 120) : null;
    const cleanPhone = typeof phone === "string" ? phone.trim().slice(0, 40) : null;

    // Look for an existing lead on this session with this email — update in
    // place, don't insert a duplicate.
    const existing = await db
      .select()
      .from(chatLeadsTable)
      .where(and(eq(chatLeadsTable.sessionId, sessionId), eq(chatLeadsTable.email, cleanEmail)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(chatLeadsTable)
        .set({
          ...(cleanName ? { name: cleanName } : {}),
          ...(cleanPhone ? { phone: cleanPhone } : {}),
          ...(typeof consent === "boolean" ? { consent } : {}),
        })
        .where(eq(chatLeadsTable.id, existing[0]!.id));
      res.json({ success: true, lead: { id: existing[0]!.id }, deduped: true });
      return;
    }

    const [lead] = await db
      .insert(chatLeadsTable)
      .values({
        sessionId,
        visitorId,
        email: cleanEmail,
        name: cleanName,
        phone: cleanPhone,
        consent: typeof consent === "boolean" ? consent : false,
      })
      .returning();
    res.json({ success: true, lead: { id: lead!.id } });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[chat] /chat/guest-lead failed");
    res.status(500).json({ error: "Failed to save lead" });
  }
});

// Claim a guest session into the just-authenticated user's account. Called
// by the client immediately after sign-in / sign-up so the chat history
// follows the visitor across the auth boundary.
router.post(
  "/chat/guest-session/claim",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const visitorId = getVisitorId(req as Request);
      if (!visitorId) {
        res.status(400).json({ error: "visitorId required" });
        return;
      }
      // Find the most recent non-resolved guest session for this visitor.
      const rows = await db
        .select()
        .from(chatSessionsTable)
        .where(
          and(
            eq(chatSessionsTable.visitorId, visitorId),
            isNull(chatSessionsTable.userId),
          ),
        )
        .orderBy(desc(chatSessionsTable.lastMessageAt))
        .limit(1);
      const guestSession = rows[0];
      if (!guestSession) {
        res.json({ success: true, claimed: false });
        return;
      }

      // Migrate ownership. Keep visitor_id for analytics / dedupe.
      await db
        .update(chatSessionsTable)
        .set({ userId })
        .where(eq(chatSessionsTable.id, guestSession.id));

      // Re-stamp any chat_leads on this session with no converted_at — the
      // user just signed up, which counts as a lead conversion.
      await db
        .update(chatLeadsTable)
        .set({ convertedAt: new Date() })
        .where(
          and(
            eq(chatLeadsTable.sessionId, guestSession.id),
            isNull(chatLeadsTable.convertedAt),
          ),
        );

      res.json({ success: true, claimed: true, sessionId: guestSession.id });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[chat] /chat/guest-session/claim failed");
      res.status(500).json({ error: "Failed to claim guest session" });
    }
  },
);

export default router;
