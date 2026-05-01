// Real-time quiz giveaway routes (Task 102).
//
// Mount layout
// ────────────
// All routes share `/api/quiz` prefix (mounted from routes/index.ts). Admin
// routes live under `/api/admin/quizzes` and go through `authMiddleware +
// adminMiddleware`. User routes live under `/api/quiz` directly and go
// through `authMiddleware`. The KYC-gated user routes additionally check
// `user.kycStatus === "approved"` inside the handler, matching the pattern
// used in wallet.ts and inr-withdrawals.ts.
//
// SSE
// ───
// `GET /api/quiz/:id/stream` is the only SSE endpoint. It gates by auth
// (server can't honour KYC gating on EventSource because the browser
// EventSource API does not allow custom headers — the standard query-token
// trick is used). Anyone with a valid JWT can SUBSCRIBE; only KYC-verified
// users can JOIN and ANSWER.

import { Router } from "express";
import type { Response } from "express";
import { db } from "@workspace/db";
import {
  quizzesTable,
  quizQuestionsTable,
  quizParticipantsTable,
  quizAnswersTable,
  quizWinnersTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, desc, asc, inArray, sql, gte, or } from "drizzle-orm";
import jwt from "jsonwebtoken";
import {
  authMiddleware,
  adminMiddleware,
  getParam,
  getQueryInt,
  getQueryString,
  type AuthRequest,
} from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getRunnerState, ANSWER_GRACE_MS } from "../lib/quiz-runner";
import { forceStartQuiz } from "../lib/quiz-scheduler";
import { subscribeToQuiz, type QuizSseEnvelope } from "../lib/quiz-event-bus";
import { addScore, claimAnswerSlot, computeScore, getTopN, getUserRank, getUserScore, getParticipantCount } from "../lib/quiz-scoring";
import { PLATFORM_RAKE_PCT, computeCompanyCut, computeDistributable } from "../lib/quiz-economics";
import { generateQuizQuestions } from "../lib/quiz-ai";

const router = Router();

// ─── Helpers ───────────────────────────────────────────────────────────────

function maskName(full: string | null | undefined): string {
  if (!full?.trim()) return "Anonymous";
  const parts = full.trim().split(/\s+/);
  const first = parts[0]!;
  const fmasked = first.length <= 2 ? first + "***" : first.slice(0, 2) + "***";
  const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1]![0]!.toUpperCase()}.` : "";
  return fmasked + lastInitial;
}

function serializeQuiz(q: typeof quizzesTable.$inferSelect) {
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    status: q.status,
    scheduledStartAt: q.scheduledStartAt.toISOString(),
    startedAt: q.startedAt?.toISOString() ?? null,
    endedAt: q.endedAt?.toISOString() ?? null,
    prizePool: String(q.prizePool),
    prizeCurrency: q.prizeCurrency,
    prizeSplit: q.prizeSplit,
    questionTimeMs: q.questionTimeMs,
    entryRules: q.entryRules,
    notifyEnabled: q.notifyEnabled,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

function serializeQuestionAdmin(q: typeof quizQuestionsTable.$inferSelect) {
  return {
    id: q.id,
    quizId: q.quizId,
    position: q.position,
    prompt: q.prompt,
    options: q.options,
    correctIndex: q.correctIndex, // admins see this
    explanation: q.explanation,
    source: q.source,
  };
}

function validateQuestionPayload(body: unknown): { ok: true; question: { prompt: string; options: string[]; correctIndex: number; explanation: string; source?: "manual" | "ai" } } | { ok: false; error: string } {
  const b = body as { prompt?: unknown; options?: unknown; correctIndex?: unknown; explanation?: unknown; source?: unknown };
  if (typeof b?.prompt !== "string" || !b.prompt.trim()) return { ok: false, error: "invalid_prompt" };
  if (!Array.isArray(b?.options) || b.options.length !== 4 || b.options.some((o) => typeof o !== "string" || !String(o).trim())) {
    return { ok: false, error: "invalid_options" };
  }
  if (typeof b?.correctIndex !== "number" || b.correctIndex < 0 || b.correctIndex > 3) return { ok: false, error: "invalid_correctIndex" };
  const explanation = typeof b?.explanation === "string" ? b.explanation.trim() : "";
  const source = b?.source === "ai" ? "ai" : "manual";
  return {
    ok: true,
    question: {
      prompt: b.prompt.trim().slice(0, 500),
      options: (b.options as string[]).map((o) => String(o).trim().slice(0, 200)),
      correctIndex: b.correctIndex,
      explanation: explanation.slice(0, 500),
      source,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES — /api/admin/quizzes/*
// ═══════════════════════════════════════════════════════════════════════════

const adminRouter = Router();
adminRouter.use("/admin/quizzes", authMiddleware, adminMiddleware);

// List quizzes — newest first, optional status filter.
adminRouter.get("/admin/quizzes", async (req: AuthRequest, res) => {
  const status = getQueryString(req, "status");
  const limit = Math.min(getQueryInt(req, "limit", 50), 200);
  const where = status && ["scheduled", "live", "ended", "cancelled"].includes(status)
    ? eq(quizzesTable.status, status as "scheduled" | "live" | "ended" | "cancelled")
    : undefined;
  const rows = await (where
    ? db.select().from(quizzesTable).where(where).orderBy(desc(quizzesTable.scheduledStartAt)).limit(limit)
    : db.select().from(quizzesTable).orderBy(desc(quizzesTable.scheduledStartAt)).limit(limit));
  res.json({ data: rows.map(serializeQuiz) });
});

// Create a new (scheduled) quiz. Questions are added separately so the admin
// can iterate on them without losing draft metadata.
adminRouter.post("/admin/quizzes", async (req: AuthRequest, res) => {
  const b = req.body as {
    title?: string;
    description?: string;
    scheduledStartAt?: string;
    prizePool?: string | number;
    prizeCurrency?: string;
    prizeSplit?: number[];
    questionTimeMs?: number;
    entryRules?: { requireKyc?: boolean };
    notifyEnabled?: boolean;
  };
  const title = (b?.title ?? "").trim();
  if (title.length < 3 || title.length > 200) {
    res.status(400).json({ error: "invalid_title", message: "Title must be 3–200 characters" });
    return;
  }
  const startAt = b?.scheduledStartAt ? new Date(b.scheduledStartAt) : null;
  if (!startAt || Number.isNaN(startAt.getTime())) {
    res.status(400).json({ error: "invalid_start_time" });
    return;
  }
  const prizePool = parseFloat(String(b?.prizePool ?? "0"));
  if (!Number.isFinite(prizePool) || prizePool < 0) {
    res.status(400).json({ error: "invalid_prize_pool" });
    return;
  }
  const split = Array.isArray(b?.prizeSplit) ? b.prizeSplit.slice(0, 3).map(Number) : [0.5, 0.3, 0.2];
  if (split.length !== 3 || split.some((n) => !Number.isFinite(n) || n < 0) || Math.abs(split.reduce((a, c) => a + c, 0) - 1) > 0.001) {
    res.status(400).json({ error: "invalid_prize_split", message: "Split must be 3 fractions summing to 1" });
    return;
  }
  const qTime = Number(b?.questionTimeMs ?? 12_000);
  if (!Number.isFinite(qTime) || qTime < 10_000 || qTime > 15_000) {
    res.status(400).json({ error: "invalid_question_time", message: "questionTimeMs must be 10000–15000" });
    return;
  }
  const requireKyc = b?.entryRules?.requireKyc !== false; // default true
  const notifyEnabled = b?.notifyEnabled !== false; // default true — admins opt-out per quiz

  const [created] = await db.insert(quizzesTable).values({
    title,
    description: (b?.description ?? "").trim().slice(0, 2000),
    scheduledStartAt: startAt,
    prizePool: prizePool.toFixed(2),
    prizeCurrency: (b?.prizeCurrency ?? "USDT").trim().slice(0, 10).toUpperCase(),
    prizeSplit: split,
    questionTimeMs: qTime,
    entryRules: { requireKyc },
    notifyEnabled,
    createdBy: req.userId ?? null,
  }).returning();
  res.status(201).json(serializeQuiz(created!));
});

// Update a scheduled quiz. Locked once the quiz has gone live.
adminRouter.patch("/admin/quizzes/:id", async (req: AuthRequest, res) => {
  const id = parseInt(getParam(req, "id"));
  const [existing] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "not_found" }); return; }
  if (existing.status !== "scheduled") {
    res.status(409).json({ error: "not_editable", message: "Only scheduled quizzes can be edited" });
    return;
  }
  const b = req.body as Record<string, unknown>;
  const updates: Partial<typeof quizzesTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof b.title === "string") updates.title = b.title.trim().slice(0, 200);
  if (typeof b.description === "string") updates.description = b.description.trim().slice(0, 2000);
  if (typeof b.scheduledStartAt === "string") {
    const d = new Date(b.scheduledStartAt);
    if (Number.isNaN(d.getTime())) { res.status(400).json({ error: "invalid_start_time" }); return; }
    updates.scheduledStartAt = d;
  }
  if (b.prizePool !== undefined) {
    const p = parseFloat(String(b.prizePool));
    if (!Number.isFinite(p) || p < 0) { res.status(400).json({ error: "invalid_prize_pool" }); return; }
    updates.prizePool = p.toFixed(2);
  }
  if (typeof b.prizeCurrency === "string") updates.prizeCurrency = b.prizeCurrency.trim().slice(0, 10).toUpperCase();
  if (Array.isArray(b.prizeSplit)) {
    const split = (b.prizeSplit as unknown[]).slice(0, 3).map(Number);
    if (split.length !== 3 || split.some((n) => !Number.isFinite(n) || n < 0) || Math.abs(split.reduce((a, c) => a + c, 0) - 1) > 0.001) {
      res.status(400).json({ error: "invalid_prize_split" }); return;
    }
    updates.prizeSplit = split;
  }
  if (b.questionTimeMs !== undefined) {
    const q = Number(b.questionTimeMs);
    if (!Number.isFinite(q) || q < 10_000 || q > 15_000) { res.status(400).json({ error: "invalid_question_time" }); return; }
    updates.questionTimeMs = q;
  }
  if (b.entryRules && typeof b.entryRules === "object") {
    updates.entryRules = { requireKyc: (b.entryRules as { requireKyc?: boolean }).requireKyc !== false };
  }
  if (typeof b.notifyEnabled === "boolean") updates.notifyEnabled = b.notifyEnabled;
  const [updated] = await db.update(quizzesTable).set(updates).where(eq(quizzesTable.id, id)).returning();
  res.json(serializeQuiz(updated!));
});

adminRouter.post("/admin/quizzes/:id/cancel", async (_req: AuthRequest, res) => {
  const id = parseInt(getParam(_req, "id"));
  const [existing] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "not_found" }); return; }
  if (existing.status !== "scheduled") {
    res.status(409).json({ error: "not_cancellable", message: "Only scheduled quizzes can be cancelled" });
    return;
  }
  await db.update(quizzesTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(quizzesTable.id, id));
  res.json({ success: true });
});

adminRouter.post("/admin/quizzes/:id/force-start", async (_req: AuthRequest, res) => {
  const id = parseInt(getParam(_req, "id"));
  const [existing] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "not_found" }); return; }
  if (existing.status !== "scheduled") {
    res.status(409).json({ error: "not_startable" });
    return;
  }
  const questionCount = await db.select({ c: sql<string>`count(*)::text` }).from(quizQuestionsTable).where(eq(quizQuestionsTable.quizId, id));
  if ((parseInt(questionCount[0]?.c ?? "0", 10) || 0) < 5) {
    res.status(400).json({ error: "needs_5_questions", message: "Add 5 questions before starting" });
    return;
  }
  // Pull start time forward so the scheduler picks it up immediately on
  // the OTHER instance even if force-start lock contention happens.
  await db.update(quizzesTable).set({ scheduledStartAt: new Date(), updatedAt: new Date() }).where(eq(quizzesTable.id, id));
  const won = await forceStartQuiz(id);
  res.json({ success: true, startedHere: won });
});

// ── Questions sub-resource ──────────────────────────────────────────────
adminRouter.get("/admin/quizzes/:id/questions", async (_req: AuthRequest, res) => {
  const id = parseInt(getParam(_req, "id"));
  const rows = await db.select().from(quizQuestionsTable).where(eq(quizQuestionsTable.quizId, id)).orderBy(asc(quizQuestionsTable.position));
  res.json({ data: rows.map(serializeQuestionAdmin) });
});

adminRouter.post("/admin/quizzes/:id/questions", async (req: AuthRequest, res) => {
  const id = parseInt(getParam(req, "id"));
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, id)).limit(1);
  if (!quiz) { res.status(404).json({ error: "not_found" }); return; }
  if (quiz.status !== "scheduled") { res.status(409).json({ error: "not_editable" }); return; }

  // Body can be `{ question }` (single insert) or `{ questions: [...] }`
  // (bulk replace — used by the AI generator). Bulk mode wipes existing
  // questions and re-inserts so the admin can re-roll the entire set.
  const body = req.body as { question?: unknown; questions?: unknown[]; replace?: boolean };
  if (Array.isArray(body.questions)) {
    if (body.questions.length > 5) {
      res.status(400).json({ error: "too_many", message: "Max 5 questions per quiz" });
      return;
    }
    const validated: Array<{ prompt: string; options: string[]; correctIndex: number; explanation: string; source?: "manual" | "ai" }> = [];
    for (const q of body.questions) {
      const v = validateQuestionPayload(q);
      if (!v.ok) { res.status(400).json({ error: v.error }); return; }
      validated.push(v.question);
    }
    await db.transaction(async (tx) => {
      if (body.replace) {
        await tx.delete(quizQuestionsTable).where(eq(quizQuestionsTable.quizId, id));
      }
      const existingCount = body.replace
        ? 0
        : (await tx.select({ c: sql<string>`count(*)::text` }).from(quizQuestionsTable).where(eq(quizQuestionsTable.quizId, id)))[0]?.c;
      const startPos = parseInt(String(existingCount ?? "0"), 10) || 0;
      if (startPos + validated.length > 5) {
        throw new Error("over_limit");
      }
      await tx.insert(quizQuestionsTable).values(
        validated.map((q, i) => ({
          quizId: id,
          position: startPos + i,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          source: q.source ?? "manual",
        })),
      );
    }).catch((err) => {
      if ((err as Error).message === "over_limit") throw { status: 400, error: "over_limit" };
      throw err;
    });
    const refreshed = await db.select().from(quizQuestionsTable).where(eq(quizQuestionsTable.quizId, id)).orderBy(asc(quizQuestionsTable.position));
    res.status(201).json({ data: refreshed.map(serializeQuestionAdmin) });
    return;
  }

  const v = validateQuestionPayload(body.question);
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }
  const existing = await db.select({ pos: quizQuestionsTable.position }).from(quizQuestionsTable).where(eq(quizQuestionsTable.quizId, id));
  if (existing.length >= 5) { res.status(400).json({ error: "max_5_questions" }); return; }
  const nextPos = existing.length;
  const [created] = await db.insert(quizQuestionsTable).values({
    quizId: id,
    position: nextPos,
    prompt: v.question.prompt,
    options: v.question.options,
    correctIndex: v.question.correctIndex,
    explanation: v.question.explanation,
    source: v.question.source ?? "manual",
  }).returning();
  res.status(201).json(serializeQuestionAdmin(created!));
});

adminRouter.patch("/admin/quizzes/:id/questions/:qid", async (req: AuthRequest, res) => {
  const quizId = parseInt(getParam(req, "id"));
  const qid = parseInt(getParam(req, "qid"));
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, quizId)).limit(1);
  if (!quiz) { res.status(404).json({ error: "not_found" }); return; }
  if (quiz.status !== "scheduled") { res.status(409).json({ error: "not_editable" }); return; }
  const v = validateQuestionPayload(req.body);
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }
  const [updated] = await db.update(quizQuestionsTable).set({
    prompt: v.question.prompt,
    options: v.question.options,
    correctIndex: v.question.correctIndex,
    explanation: v.question.explanation,
  }).where(and(eq(quizQuestionsTable.id, qid), eq(quizQuestionsTable.quizId, quizId))).returning();
  if (!updated) { res.status(404).json({ error: "question_not_found" }); return; }
  res.json(serializeQuestionAdmin(updated));
});

adminRouter.delete("/admin/quizzes/:id/questions/:qid", async (req: AuthRequest, res) => {
  const quizId = parseInt(getParam(req, "id"));
  const qid = parseInt(getParam(req, "qid"));
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, quizId)).limit(1);
  if (!quiz) { res.status(404).json({ error: "not_found" }); return; }
  if (quiz.status !== "scheduled") { res.status(409).json({ error: "not_editable" }); return; }
  await db.transaction(async (tx) => {
    await tx.delete(quizQuestionsTable).where(and(eq(quizQuestionsTable.id, qid), eq(quizQuestionsTable.quizId, quizId)));
    // Renumber remaining questions so positions stay 0..N-1 contiguous —
    // the runner relies on `asc(position)` ordering.
    const rest = await tx.select({ id: quizQuestionsTable.id }).from(quizQuestionsTable).where(eq(quizQuestionsTable.quizId, quizId)).orderBy(asc(quizQuestionsTable.position));
    for (let i = 0; i < rest.length; i++) {
      await tx.update(quizQuestionsTable).set({ position: i }).where(eq(quizQuestionsTable.id, rest[i]!.id));
    }
  });
  res.json({ success: true });
});

// Reorder questions: body = { order: [questionId1, questionId2, ...] }
adminRouter.post("/admin/quizzes/:id/questions/reorder", async (req: AuthRequest, res) => {
  const quizId = parseInt(getParam(req, "id"));
  const order = (req.body as { order?: unknown }).order;
  if (!Array.isArray(order) || order.some((n) => typeof n !== "number")) {
    res.status(400).json({ error: "invalid_order" }); return;
  }
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, quizId)).limit(1);
  if (!quiz) { res.status(404).json({ error: "not_found" }); return; }
  if (quiz.status !== "scheduled") { res.status(409).json({ error: "not_editable" }); return; }
  const ids = order as number[];
  await db.transaction(async (tx) => {
    // First pass — bump everyone past 1000 so the unique (quizId, position)
    // index doesn't trip mid-update.
    for (let i = 0; i < ids.length; i++) {
      await tx.update(quizQuestionsTable).set({ position: 1000 + i }).where(and(eq(quizQuestionsTable.quizId, quizId), eq(quizQuestionsTable.id, ids[i]!)));
    }
    for (let i = 0; i < ids.length; i++) {
      await tx.update(quizQuestionsTable).set({ position: i }).where(and(eq(quizQuestionsTable.quizId, quizId), eq(quizQuestionsTable.id, ids[i]!)));
    }
  });
  const refreshed = await db.select().from(quizQuestionsTable).where(eq(quizQuestionsTable.quizId, quizId)).orderBy(asc(quizQuestionsTable.position));
  res.json({ data: refreshed.map(serializeQuestionAdmin) });
});

adminRouter.post("/admin/quizzes/:id/questions/generate-ai", async (req: AuthRequest, res) => {
  const quizId = parseInt(getParam(req, "id"));
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, quizId)).limit(1);
  if (!quiz) { res.status(404).json({ error: "not_found" }); return; }
  if (quiz.status !== "scheduled") { res.status(409).json({ error: "not_editable" }); return; }
  const topicHint = typeof (req.body as { topicHint?: unknown })?.topicHint === "string"
    ? ((req.body as { topicHint: string }).topicHint).slice(0, 200)
    : undefined;
  const previous = await db.select({ p: quizQuestionsTable.prompt }).from(quizQuestionsTable).where(eq(quizQuestionsTable.quizId, quizId));
  try {
    const drafts = await generateQuizQuestions({
      topicHint,
      previousPrompts: previous.map((r) => r.p),
    });
    res.json({ data: drafts });
  } catch (err) {
    const code = (err as Error).message;
    const status = code === "ai_unavailable" ? 503 : 502;
    res.status(status).json({ error: code });
  }
});

// Final results (admin view) — top 3 with PII for payout.
adminRouter.get("/admin/quizzes/:id/results", async (_req: AuthRequest, res) => {
  const id = parseInt(getParam(_req, "id"));
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, id)).limit(1);
  if (!quiz) { res.status(404).json({ error: "not_found" }); return; }
  const winners = await db.select({
    id: quizWinnersTable.id,
    rank: quizWinnersTable.rank,
    finalScore: quizWinnersTable.finalScore,
    prizeAmount: quizWinnersTable.prizeAmount,
    prizeCurrency: quizWinnersTable.prizeCurrency,
    paidStatus: quizWinnersTable.paidStatus,
    paidAt: quizWinnersTable.paidAt,
    paidNote: quizWinnersTable.paidNote,
    paidTxnId: quizWinnersTable.paidTxnId,
    paidByAdminId: quizWinnersTable.paidByAdminId,
    userId: quizWinnersTable.userId,
    userEmail: usersTable.email,
    userName: usersTable.fullName,
    userPhone: usersTable.phoneNumber,
  })
    .from(quizWinnersTable)
    .innerJoin(usersTable, eq(usersTable.id, quizWinnersTable.userId))
    .where(eq(quizWinnersTable.quizId, id))
    .orderBy(asc(quizWinnersTable.rank));

  const [{ c: participants } = { c: "0" }] = await db
    .select({ c: sql<string>`count(*)::text` })
    .from(quizParticipantsTable)
    .where(eq(quizParticipantsTable.quizId, id));

  // Admin-only revenue breakdown. Public endpoints never surface these.
  const poolNum = parseFloat(String(quiz.prizePool)) || 0;
  res.json({
    quiz: serializeQuiz(quiz),
    participants: parseInt(participants, 10) || 0,
    winners: winners.map((w) => ({
      ...w,
      prizeAmount: String(w.prizeAmount),
      paidAt: w.paidAt?.toISOString() ?? null,
    })),
    revenue: {
      advertisedPool: poolNum.toFixed(2),
      distributable: computeDistributable(poolNum).toFixed(2),
      companyCut: computeCompanyCut(poolNum).toFixed(2),
      rakePct: PLATFORM_RAKE_PCT,
      currency: quiz.prizeCurrency,
    },
  });
});

// Live monitor — current question + leaderboard + participant count.
adminRouter.get("/admin/quizzes/:id/monitor", async (_req: AuthRequest, res) => {
  const id = parseInt(getParam(_req, "id"));
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, id)).limit(1);
  if (!quiz) { res.status(404).json({ error: "not_found" }); return; }
  const state = getRunnerState(id);
  const top = await getTopN(id, 10);
  const names = top.length === 0 ? new Map<number, string>() : new Map(
    (await db.select({ id: usersTable.id, fullName: usersTable.fullName })
      .from(usersTable)
      .where(inArray(usersTable.id, top.map((r) => r.userId))))
      .map((r) => [r.id, maskName(r.fullName)] as const),
  );
  const [{ c: participants } = { c: "0" }] = await db
    .select({ c: sql<string>`count(*)::text` })
    .from(quizParticipantsTable)
    .where(eq(quizParticipantsTable.quizId, id));
  res.json({
    quiz: serializeQuiz(quiz),
    runner: state,
    leaderboard: top.map((r) => ({ ...r, displayName: names.get(r.userId) ?? "Anonymous" })),
    participants: parseInt(participants, 10) || 0,
  });
});

// Mark a winner paid.
adminRouter.post("/admin/quizzes/:id/winners/:wid/mark-paid", async (req: AuthRequest, res) => {
  const wid = parseInt(getParam(req, "wid"));
  const note = typeof (req.body as { note?: unknown })?.note === "string"
    ? (req.body as { note: string }).note.slice(0, 500)
    : "";
  // Only update pending rows so a manual mark-paid can never overwrite
  // metadata (paidTxnId, paidNote) written by the auto-credit pipeline.
  const [updated] = await db.update(quizWinnersTable).set({
    paidStatus: "paid",
    paidAt: new Date(),
    paidByAdminId: req.userId ?? null,
    paidNote: note,
  }).where(and(
    eq(quizWinnersTable.id, wid),
    eq(quizWinnersTable.paidStatus, "pending"),
  )).returning();
  if (!updated) {
    const [existing] = await db.select({ id: quizWinnersTable.id, paidStatus: quizWinnersTable.paidStatus })
      .from(quizWinnersTable).where(eq(quizWinnersTable.id, wid)).limit(1);
    if (!existing) { res.status(404).json({ error: "winner_not_found" }); return; }
    res.status(409).json({ error: "already_paid" });
    return;
  }
  res.json({
    id: updated.id,
    paidStatus: updated.paidStatus,
    paidAt: updated.paidAt?.toISOString() ?? null,
    paidNote: updated.paidNote,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// USER ROUTES — /api/quiz/*
// ═══════════════════════════════════════════════════════════════════════════

const userRouter = Router();

// List visible quizzes — scheduled / live / recently-ended (last 24h).
userRouter.get("/quiz", authMiddleware, async (req: AuthRequest, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db.select().from(quizzesTable)
    .where(or(
      eq(quizzesTable.status, "scheduled"),
      eq(quizzesTable.status, "live"),
      and(eq(quizzesTable.status, "ended"), gte(quizzesTable.endedAt, since)),
    ))
    .orderBy(asc(quizzesTable.scheduledStartAt));
  // Include "have I joined" so the UI can render Join vs Open.
  const userId = req.userId!;
  const joined = rows.length === 0
    ? []
    : await db.select({ quizId: quizParticipantsTable.quizId })
      .from(quizParticipantsTable)
      .where(and(eq(quizParticipantsTable.userId, userId), inArray(quizParticipantsTable.quizId, rows.map((r) => r.id))));
  const joinedSet = new Set(joined.map((j) => j.quizId));
  res.json({
    data: rows.map((q) => ({ ...serializeQuiz(q), joined: joinedSet.has(q.id) })),
  });
});

// Quiz detail — stripped (no correct answers).
userRouter.get("/quiz/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(getParam(req, "id"));
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, id)).limit(1);
  if (!quiz) { res.status(404).json({ error: "not_found" }); return; }
  // Cancelled quizzes are still visible briefly so the UI can show a clean
  // "cancelled" state if a user opens an old link.
  const userId = req.userId!;
  const [joinRow] = await db.select().from(quizParticipantsTable)
    .where(and(eq(quizParticipantsTable.quizId, id), eq(quizParticipantsTable.userId, userId)))
    .limit(1);
  const [{ c: participants } = { c: "0" }] = await db
    .select({ c: sql<string>`count(*)::text` })
    .from(quizParticipantsTable)
    .where(eq(quizParticipantsTable.quizId, id));

  // For ended quizzes also surface the top 3.
  let winners: Array<{ rank: number; displayName: string; finalScore: number; prizeAmount: string; prizeCurrency: string; userId: number }> = [];
  if (quiz.status === "ended") {
    const ws = await db.select({
      rank: quizWinnersTable.rank,
      finalScore: quizWinnersTable.finalScore,
      prizeAmount: quizWinnersTable.prizeAmount,
      prizeCurrency: quizWinnersTable.prizeCurrency,
      userId: quizWinnersTable.userId,
      fullName: usersTable.fullName,
    })
      .from(quizWinnersTable)
      .innerJoin(usersTable, eq(usersTable.id, quizWinnersTable.userId))
      .where(eq(quizWinnersTable.quizId, id))
      .orderBy(asc(quizWinnersTable.rank));
    winners = ws.map((w) => ({
      rank: w.rank,
      displayName: maskName(w.fullName),
      finalScore: w.finalScore,
      prizeAmount: String(w.prizeAmount),
      prizeCurrency: w.prizeCurrency,
      userId: w.userId,
    }));
  }

  res.json({
    quiz: serializeQuiz(quiz),
    joined: !!joinRow,
    participants: parseInt(participants, 10) || 0,
    winners,
  });
});

// Join a quiz. Idempotent — re-joining returns the existing participant row.
userRouter.post("/quiz/:id/join", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(getParam(req, "id"));
  const userId = req.userId!;
  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, id)).limit(1);
  if (!quiz) { res.status(404).json({ error: "not_found" }); return; }
  if (quiz.status === "ended" || quiz.status === "cancelled") {
    res.status(409).json({ error: "not_joinable", message: "Quiz is no longer open for joining" });
    return;
  }
  // KYC gate — read fresh status to avoid relying on possibly-cached values.
  const [user] = await db.select({ kycStatus: usersTable.kycStatus, isDisabled: usersTable.isDisabled, isFrozen: usersTable.isFrozen }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
  if (user.isDisabled || user.isFrozen) {
    res.status(403).json({ error: "account_restricted" }); return;
  }
  if ((quiz.entryRules?.requireKyc ?? true) && user.kycStatus !== "approved") {
    res.status(403).json({ error: "kyc_required", message: "Complete KYC verification to join this quiz" });
    return;
  }
  // Insert with ON CONFLICT DO NOTHING — relies on the unique (quizId, userId) index.
  await db.insert(quizParticipantsTable)
    .values({ quizId: id, userId })
    .onConflictDoNothing();
  res.json({ success: true });
});

// Submit an answer. Server is the single source of truth for `responseMs`
// and the deadline. Three layers of anti-cheat:
//   1. Runner state must show this question is live.
//   2. Redis SETNX claims the answer slot before the DB write.
//   3. DB unique (user, question) index is the absolute backstop.
userRouter.post("/quiz/:id/answer", authMiddleware, async (req: AuthRequest, res) => {
  const quizId = parseInt(getParam(req, "id"));
  const userId = req.userId!;
  const body = req.body as { questionId?: unknown; selectedOption?: unknown };
  const questionId = Number(body?.questionId);
  const selectedOption = Number(body?.selectedOption);
  if (!Number.isInteger(questionId) || !Number.isInteger(selectedOption) || selectedOption < 0 || selectedOption > 3) {
    res.status(400).json({ error: "invalid_payload" }); return;
  }

  // Anti-cheat 0: KYC must still be approved at submit time.
  const [user] = await db.select({ kycStatus: usersTable.kycStatus, isDisabled: usersTable.isDisabled, isFrozen: usersTable.isFrozen }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
  if (user.isDisabled || user.isFrozen) { res.status(403).json({ error: "account_restricted" }); return; }
  if (user.kycStatus !== "approved") { res.status(403).json({ error: "kyc_required" }); return; }

  // Must have joined.
  const [joined] = await db.select({ id: quizParticipantsTable.id }).from(quizParticipantsTable)
    .where(and(eq(quizParticipantsTable.quizId, quizId), eq(quizParticipantsTable.userId, userId)))
    .limit(1);
  if (!joined) { res.status(403).json({ error: "not_joined" }); return; }

  // Anti-cheat 1: question must be the LIVE one. The runner state is
  // process-local — if the runner is on a different machine we fall back
  // to a DB lookup of the question + a recent timestamp check.
  const state = getRunnerState(quizId);
  let startedAtMs: number | null = null;
  let deadlineMs: number | null = null;
  let windowMs = 12_000;
  if (state && state.currentQuestionId === questionId && state.questionStartedAtMs && state.questionDeadlineMs) {
    startedAtMs = state.questionStartedAtMs;
    deadlineMs = state.questionDeadlineMs;
    windowMs = state.windowMs;
  } else {
    // Cross-instance fallback: the broadcast event_id-based dedup on the
    // client makes this rare, but we still validate that the question
    // belongs to the quiz and that the quiz is live. We refuse to score
    // when we can't determine `startedAtMs` because we have no honest
    // server timestamp — better to reject than to award an unfair score.
    res.status(409).json({ error: "no_active_question", message: "Submit when the question is on screen" });
    return;
  }

  // Anti-cheat 2: deadline check (server clock is the truth).
  const now = Date.now();
  if (now > deadlineMs + ANSWER_GRACE_MS) {
    res.status(409).json({ error: "too_late" });
    return;
  }

  // Anti-cheat 3 (Redis SETNX) — TTL slightly longer than window so a slow
  // DB insert can't accidentally let a duplicate slip through.
  const claimed = await claimAnswerSlot(quizId, questionId, userId, windowMs + 5_000);
  if (!claimed) {
    res.status(409).json({ error: "already_answered" });
    return;
  }

  // Lookup the correct index. We don't trust the client's `correctIndex`.
  const [q] = await db.select({ correctIndex: quizQuestionsTable.correctIndex, quizId: quizQuestionsTable.quizId })
    .from(quizQuestionsTable).where(eq(quizQuestionsTable.id, questionId)).limit(1);
  if (!q || q.quizId !== quizId) { res.status(404).json({ error: "question_not_found" }); return; }

  const isCorrect = selectedOption === q.correctIndex;
  const responseMs = Math.max(0, now - startedAtMs);
  const score = computeScore({ isCorrect, responseMs, windowMs });

  // Final backstop: DB unique constraint. If two requests slip through the
  // SETNX race on different machines, the loser gets a 409 here.
  try {
    await db.insert(quizAnswersTable).values({
      quizId,
      questionId,
      userId,
      selectedOption,
      isCorrect,
      responseTimeMs: responseMs,
      scoreAwarded: score,
    });
  } catch (err) {
    // Postgres unique-violation (23505). Treat as duplicate.
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "already_answered" }); return;
    }
    logger.error({ err: (err as Error).message, quizId, questionId, userId }, "[quiz] insert failed");
    res.status(500).json({ error: "internal" }); return;
  }

  if (score > 0) {
    await addScore(quizId, userId, score);
  }
  // We deliberately do NOT echo the correct answer here — the client
  // learns it via `question_ended` SSE event so all participants see the
  // reveal at the same moment.
  const newScore = await getUserScore(quizId, userId);
  const rank = await getUserRank(quizId, userId);
  res.json({
    accepted: true,
    scoreAwarded: score,
    totalScore: newScore,
    rank,
    locked: true,
  });
});

// "My past quizzes" — historical participation including final score + rank.
userRouter.get("/quiz/me/past", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(getQueryInt(req, "limit", 20), 50);
  // Pull joined quizzes that have ended.
  const rows = await db.select({
    quiz: quizzesTable,
  })
    .from(quizParticipantsTable)
    .innerJoin(quizzesTable, eq(quizzesTable.id, quizParticipantsTable.quizId))
    .where(and(eq(quizParticipantsTable.userId, userId), eq(quizzesTable.status, "ended")))
    .orderBy(desc(quizzesTable.endedAt))
    .limit(limit);
  if (rows.length === 0) { res.json({ data: [] }); return; }

  const quizIds = rows.map((r) => r.quiz.id);
  // Sum scores per quiz for this user.
  const scoreRows = await db
    .select({
      quizId: quizAnswersTable.quizId,
      total: sql<string>`COALESCE(SUM(${quizAnswersTable.scoreAwarded}), 0)::text`,
    })
    .from(quizAnswersTable)
    .where(and(eq(quizAnswersTable.userId, userId), inArray(quizAnswersTable.quizId, quizIds)))
    .groupBy(quizAnswersTable.quizId);
  const scoreMap = new Map(scoreRows.map((s) => [s.quizId, parseInt(s.total, 10) || 0]));

  // Was the user a winner?
  const winRows = await db
    .select({ quizId: quizWinnersTable.quizId, rank: quizWinnersTable.rank, prizeAmount: quizWinnersTable.prizeAmount, prizeCurrency: quizWinnersTable.prizeCurrency })
    .from(quizWinnersTable)
    .where(and(eq(quizWinnersTable.userId, userId), inArray(quizWinnersTable.quizId, quizIds)));
  const winMap = new Map(winRows.map((w) => [w.quizId, w]));

  res.json({
    data: rows.map((r) => ({
      ...serializeQuiz(r.quiz),
      myScore: scoreMap.get(r.quiz.id) ?? 0,
      myRank: winMap.get(r.quiz.id)?.rank ?? null,
      myPrize: winMap.has(r.quiz.id) ? {
        amount: String(winMap.get(r.quiz.id)!.prizeAmount),
        currency: winMap.get(r.quiz.id)!.prizeCurrency,
      } : null,
    })),
  });
});

// ── SSE stream ─────────────────────────────────────────────────────────
// EventSource cannot send Authorization headers, so we accept either:
//   1. A normal Bearer token (e.g. when the client uses fetch + ReadableStream).
//   2. A `?token=` query string parameter for vanilla EventSource clients.
//
// JWT validation is done inline rather than via authMiddleware because we
// also need to set SSE-specific headers and not write a JSON 401.
const SESSION_SECRET = process.env["SESSION_SECRET"] ?? "qorix-markets-secret";

userRouter.get("/quiz/:id/stream", async (req, res) => {
  const id = parseInt(req.params["id"] ?? "");
  if (!Number.isInteger(id)) {
    res.status(400).end(); return;
  }
  const headerToken = (req.headers["authorization"] ?? "").toString().startsWith("Bearer ")
    ? (req.headers["authorization"] as string).slice(7)
    : "";
  const queryToken = typeof req.query["token"] === "string" ? (req.query["token"] as string) : "";
  const token = headerToken || queryToken;
  if (!token) {
    res.status(401).end(); return;
  }
  let userId: number;
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as { userId: number };
    userId = decoded.userId;
  } catch {
    res.status(401).end(); return;
  }

  const [quiz] = await db.select({ id: quizzesTable.id, status: quizzesTable.status }).from(quizzesTable).where(eq(quizzesTable.id, id)).limit(1);
  if (!quiz) { res.status(404).end(); return; }

  // Set SSE-friendly headers. Critical for surviving Fly's proxy:
  //   * Content-Type: text/event-stream
  //   * Cache-Control: no-cache, no-transform — `no-transform` blocks any
  //     intermediary from buffering or compressing.
  //   * X-Accel-Buffering: no — disables nginx-style proxy buffering.
  //   * Connection: keep-alive
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (env: QuizSseEnvelope) => {
    try {
      res.write(`id: ${env.id}\nevent: ${env.payload.type}\ndata: ${JSON.stringify(env)}\n\n`);
    } catch {
      // Connection already closed — nothing to do; cleanup runs in `close`.
    }
  };

  // Initial "hello" event so the client knows the stream is open and gets a
  // baseline state to render before the first quiz_status_changed event.
  res.write(`event: hello\ndata: ${JSON.stringify({ ts: new Date().toISOString(), quizId: id, status: quiz.status })}\n\n`);

  // Heartbeat every 20s. Comment lines (": ping") are valid SSE keep-alives
  // that EventSource ignores but which keep the proxy from idling out.
  const heartbeat = setInterval(() => {
    try { res.write(`: ping ${Date.now()}\n\n`); } catch { /* closed */ }
  }, 20_000);

  const unsubscribe = subscribeToQuiz(id, send);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    try { res.end(); } catch { /* already ended */ }
  });

  // Touch userId so TS doesn't complain about unused (we don't currently
  // gate per-user SSE filtering — leaderboard payload is the same for
  // everyone, and rank-of-me is computed via the REST endpoint).
  void userId;
});

// "What's my live rank/score on this quiz" — handy for the "if outside
// top-10" UI element. Cheap (single ZSCORE + ZREVRANK).
userRouter.get("/quiz/:id/me", authMiddleware, async (req: AuthRequest, res) => {
  const id = parseInt(getParam(req, "id"));
  const userId = req.userId!;
  const score = await getUserScore(id, userId);
  const rank = await getUserRank(id, userId);
  const participants = await getParticipantCount(id);
  res.json({ score, rank, participants });
});

router.use(adminRouter);
router.use(userRouter);

export default router;
