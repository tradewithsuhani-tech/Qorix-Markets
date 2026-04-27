import { Router, type IRouter } from "express";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";

// Phone-number CHANGE wizard, distinct from initial verification.
//
// Why a separate flow from /phone-otp/send + /verify:
//   The initial-verify flow tentatively writes the candidate phoneNumber on
//   the user row at "send" time and only marks phoneVerifiedAt at "verify"
//   time. That works for first-time verification (the field was NULL before)
//   but is unsafe for a CHANGE: the user already has a verified phone X, and
//   we cannot overwrite phoneNumber with a candidate Y while phoneVerifiedAt
//   still claims X is verified — that briefly tells the rest of the system
//   "this user owns Y" without any proof.
//
// Wizard contract:
//   1. POST /phone-change/start          → OTP voice-call to OLD verified phone
//   2. POST /phone-change/verify-old     → confirm old-phone OTP, opens 10-min window
//   3. POST /phone-change/send-new       → OTP voice-call to candidate NEW phone
//   4. POST /phone-change/verify-new     → confirm new-phone OTP, atomically swap
//   5. POST /phone-change/cancel         → abort, clear staging columns
//   6. GET  /phone-change/status         → frontend wizard state
//
// On step-4 success the OLD number is cleared from the user row, so it
// becomes free for any other account to verify next.

const router: IRouter = Router();

const TWO_FACTOR_KEY = process.env.TWO_FACTOR_API_KEY ?? "";
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_DAY = 8;
// After old-phone OTP is verified the user has 10 minutes to submit the new
// number + new-phone OTP before they have to start over. Bounds the window
// during which a hijacked session could push through a phone change.
const OLD_VERIFIED_WINDOW_MS = 10 * 60 * 1000;

function normalizePhone(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) return digits.slice(1);
  return null;
}

type TwoFactorResp = { Status?: string; Details?: string };

async function callVoiceAutogen(phone: string): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  try {
    const url = `https://2factor.in/API/V1/${encodeURIComponent(TWO_FACTOR_KEY)}/VOICE/${encodeURIComponent(phone)}/AUTOGEN`;
    const r = await fetch(url);
    const data = (await r.json().catch(() => ({}))) as TwoFactorResp;
    if (!r.ok || data?.Status !== "Success" || !data?.Details) {
      return { ok: false, error: data?.Details || `voice send failed (${r.status})` };
    }
    return { ok: true, sessionId: String(data.Details) };
  } catch (err: any) {
    return { ok: false, error: err?.message || "network error" };
  }
}

async function verifySessionOtp(sessionId: string, otp: string): Promise<{ ok: boolean; expired: boolean; details: string }> {
  // Same dual-channel verifier as /phone-otp/verify — try unified SMS path
  // first (works for both channels in most plans), fall back to VOICE path.
  const tryOne = async (path: "SMS" | "VOICE") => {
    const url = `https://2factor.in/API/V1/${encodeURIComponent(TWO_FACTOR_KEY)}/${path}/VERIFY/${encodeURIComponent(sessionId)}/${encodeURIComponent(otp)}`;
    const r = await fetch(url);
    let data: TwoFactorResp = {};
    try { data = (await r.json()) as TwoFactorResp; } catch { /* non-json body */ }
    return { ok: r.ok && data?.Status === "Success", details: data?.Details || "" };
  };
  const a = await tryOne("SMS");
  if (a.ok) return { ok: true, expired: false, details: a.details };
  const b = await tryOne("VOICE");
  if (b.ok) return { ok: true, expired: false, details: b.details };
  const details = a.details || b.details;
  return { ok: false, expired: /expir/i.test(details), details };
}

// Cooldown / daily-cap check shared by both OTP send routes. Returns null if
// allowed, or an HTTP status + body to send back.
function checkSendBudget(user: { phoneOtpLastSentAt: Date | null; phoneOtpSendCount: number }): { status: number; body: any } | null {
  if (user.phoneOtpLastSentAt) {
    const since = Date.now() - new Date(user.phoneOtpLastSentAt).getTime();
    if (since < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - since) / 1000);
      return { status: 429, body: { error: "cooldown", message: `Wait ${waitSec}s before requesting another voice call` } };
    }
  }
  if ((user.phoneOtpSendCount ?? 0) >= MAX_SENDS_PER_DAY) {
    return { status: 429, body: { error: "daily_limit", message: "Daily voice OTP limit reached. Try again tomorrow." } };
  }
  return null;
}

// ─── 1. Start: send OTP to OLD verified phone ─────────────────────────────────
router.post("/phone-change/start", authMiddleware, async (req: AuthRequest, res) => {
  if (!TWO_FACTOR_KEY) { res.status(500).json({ error: "otp_not_configured" }); return; }

  const [user] = await db
    .select({
      id: usersTable.id,
      phoneNumber: usersTable.phoneNumber,
      phoneVerifiedAt: usersTable.phoneVerifiedAt,
      phoneOtpSendCount: usersTable.phoneOtpSendCount,
      phoneOtpLastSentAt: usersTable.phoneOtpLastSentAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }

  // Must already have a verified phone to use the CHANGE flow. First-time
  // verification still goes through /phone-otp/send.
  if (!user.phoneNumber || !user.phoneVerifiedAt) {
    res.status(400).json({
      error: "no_verified_phone",
      message: "You don't have a verified phone yet. Use the regular phone verification first.",
    });
    return;
  }

  // Reset daily counter if last send was >24h ago
  const lastSentMs = user.phoneOtpLastSentAt ? new Date(user.phoneOtpLastSentAt).getTime() : 0;
  if (lastSentMs && Date.now() - lastSentMs > 24 * 60 * 60 * 1000) {
    await db.update(usersTable).set({ phoneOtpSendCount: 0 }).where(eq(usersTable.id, req.userId!));
    user.phoneOtpSendCount = 0;
  }

  const budget = checkSendBudget({
    phoneOtpLastSentAt: user.phoneOtpLastSentAt as Date | null,
    phoneOtpSendCount: user.phoneOtpSendCount ?? 0,
  });
  if (budget) { res.status(budget.status).json(budget.body); return; }

  const r = await callVoiceAutogen(user.phoneNumber);
  if (!r.ok) {
    res.status(502).json({ error: "otp_send_failed", message: r.error || "Could not place voice call. Try again." });
    return;
  }

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  await db
    .update(usersTable)
    .set({
      phoneOtpSessionId: r.sessionId!,
      phoneOtpExpiresAt: expiresAt,
      phoneOtpSendCount: (user.phoneOtpSendCount ?? 0) + 1,
      phoneOtpLastSentAt: new Date(),
      // Wipe any prior change-flow state so we can't accidentally reuse a
      // stale "old verified" window from a previous abandoned attempt.
      phoneChangeNewPhone: null,
      phoneChangeOldVerifiedAt: null,
    })
    .where(eq(usersTable.id, req.userId!));

  // Mask the old number in the response — UI only needs to show last-4 to
  // remind the user where the call is going.
  const masked = user.phoneNumber.length >= 4
    ? "******" + user.phoneNumber.slice(-4)
    : user.phoneNumber;
  res.json({
    success: true,
    expiresAt: expiresAt.toISOString(),
    cooldownSec: RESEND_COOLDOWN_MS / 1000,
    sentTo: masked,
    step: "awaiting_old_otp",
  });
});

// ─── 2. Verify OLD-phone OTP → opens 10-min window ────────────────────────────
router.post("/phone-change/verify-old", authMiddleware, async (req: AuthRequest, res) => {
  if (!TWO_FACTOR_KEY) { res.status(500).json({ error: "otp_not_configured" }); return; }

  const cleanOtp = String(req.body?.otp ?? "").replace(/\D/g, "");
  if (!/^\d{4,8}$/.test(cleanOtp)) {
    res.status(400).json({ error: "invalid_otp_format", message: "Enter the digits from the voice call" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      phoneOtpSessionId: usersTable.phoneOtpSessionId,
      phoneOtpExpiresAt: usersTable.phoneOtpExpiresAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
  if (!user.phoneOtpSessionId) {
    res.status(400).json({ error: "no_active_otp", message: "Start the change flow first" });
    return;
  }
  if (user.phoneOtpExpiresAt && new Date(user.phoneOtpExpiresAt).getTime() < Date.now()) {
    await db.update(usersTable).set({ phoneOtpSessionId: null, phoneOtpExpiresAt: null }).where(eq(usersTable.id, req.userId!));
    res.status(400).json({ error: "otp_expired", message: "OTP expired. Request a new voice call." });
    return;
  }

  const v = await verifySessionOtp(user.phoneOtpSessionId, cleanOtp);
  if (!v.ok) {
    res.status(400).json({
      error: "otp_mismatch",
      message: v.expired ? "OTP expired. Request a new voice call." : "Wrong OTP. Listen to the call again and re-enter.",
    });
    return;
  }

  // Old phone confirmed — open the 10-min window and clear OTP state so the
  // /send-new step can place a fresh call without colliding with this one.
  await db
    .update(usersTable)
    .set({
      phoneOtpSessionId: null,
      phoneOtpExpiresAt: null,
      phoneChangeOldVerifiedAt: new Date(),
    })
    .where(eq(usersTable.id, req.userId!));

  res.json({
    success: true,
    step: "awaiting_new_phone",
    windowExpiresAt: new Date(Date.now() + OLD_VERIFIED_WINDOW_MS).toISOString(),
  });
});

// ─── 3. Send OTP to NEW candidate phone ───────────────────────────────────────
router.post("/phone-change/send-new", authMiddleware, async (req: AuthRequest, res) => {
  if (!TWO_FACTOR_KEY) { res.status(500).json({ error: "otp_not_configured" }); return; }

  const newNorm = normalizePhone(req.body?.phone);
  if (!newNorm) {
    res.status(400).json({ error: "invalid_phone", message: "Enter a valid 10-digit Indian mobile number" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      phoneNumber: usersTable.phoneNumber,
      phoneChangeOldVerifiedAt: usersTable.phoneChangeOldVerifiedAt,
      phoneOtpSendCount: usersTable.phoneOtpSendCount,
      phoneOtpLastSentAt: usersTable.phoneOtpLastSentAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }

  // Window check: old-phone OTP must have been verified in last 10 min.
  if (
    !user.phoneChangeOldVerifiedAt ||
    Date.now() - new Date(user.phoneChangeOldVerifiedAt).getTime() > OLD_VERIFIED_WINDOW_MS
  ) {
    await db.update(usersTable).set({ phoneChangeOldVerifiedAt: null, phoneChangeNewPhone: null }).where(eq(usersTable.id, req.userId!));
    res.status(400).json({
      error: "window_expired",
      message: "Old-phone verification window expired. Start the change flow again.",
    });
    return;
  }

  // Reject if new == current (nothing to change).
  if (user.phoneNumber === newNorm) {
    res.status(400).json({ error: "same_phone", message: "New number is the same as your current verified number." });
    return;
  }

  // Uniqueness pre-check against the partial unique index (avoids wasting a
  // voice-call quota on a number that will fail at swap time).
  const conflicts = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(
      eq(usersTable.phoneNumber, newNorm),
      isNotNull(usersTable.phoneVerifiedAt),
      ne(usersTable.id, req.userId!),
    ))
    .limit(1);
  if (conflicts.length > 0) {
    res.status(409).json({
      error: "phone_already_verified",
      message: "This number is already verified on another account. Use a different number or contact support.",
    });
    return;
  }

  const budget = checkSendBudget({
    phoneOtpLastSentAt: user.phoneOtpLastSentAt as Date | null,
    phoneOtpSendCount: user.phoneOtpSendCount ?? 0,
  });
  if (budget) { res.status(budget.status).json(budget.body); return; }

  const r = await callVoiceAutogen(newNorm);
  if (!r.ok) {
    res.status(502).json({ error: "otp_send_failed", message: r.error || "Could not place voice call. Try again." });
    return;
  }

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  await db
    .update(usersTable)
    .set({
      phoneOtpSessionId: r.sessionId!,
      phoneOtpExpiresAt: expiresAt,
      phoneOtpSendCount: (user.phoneOtpSendCount ?? 0) + 1,
      phoneOtpLastSentAt: new Date(),
      phoneChangeNewPhone: newNorm,
    })
    .where(eq(usersTable.id, req.userId!));

  res.json({
    success: true,
    expiresAt: expiresAt.toISOString(),
    cooldownSec: RESEND_COOLDOWN_MS / 1000,
    newPhone: newNorm,
    step: "awaiting_new_otp",
  });
});

// ─── 4. Verify NEW-phone OTP → atomic swap ────────────────────────────────────
router.post("/phone-change/verify-new", authMiddleware, async (req: AuthRequest, res) => {
  if (!TWO_FACTOR_KEY) { res.status(500).json({ error: "otp_not_configured" }); return; }

  const cleanOtp = String(req.body?.otp ?? "").replace(/\D/g, "");
  if (!/^\d{4,8}$/.test(cleanOtp)) {
    res.status(400).json({ error: "invalid_otp_format", message: "Enter the digits from the voice call" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      phoneNumber: usersTable.phoneNumber,
      phoneOtpSessionId: usersTable.phoneOtpSessionId,
      phoneOtpExpiresAt: usersTable.phoneOtpExpiresAt,
      phoneChangeNewPhone: usersTable.phoneChangeNewPhone,
      phoneChangeOldVerifiedAt: usersTable.phoneChangeOldVerifiedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
  if (!user.phoneOtpSessionId || !user.phoneChangeNewPhone) {
    res.status(400).json({ error: "no_active_otp", message: "Send the new-number OTP first" });
    return;
  }
  if (user.phoneOtpExpiresAt && new Date(user.phoneOtpExpiresAt).getTime() < Date.now()) {
    await db.update(usersTable).set({ phoneOtpSessionId: null, phoneOtpExpiresAt: null }).where(eq(usersTable.id, req.userId!));
    res.status(400).json({ error: "otp_expired", message: "OTP expired. Request a new voice call." });
    return;
  }
  if (
    !user.phoneChangeOldVerifiedAt ||
    Date.now() - new Date(user.phoneChangeOldVerifiedAt).getTime() > OLD_VERIFIED_WINDOW_MS
  ) {
    await db
      .update(usersTable)
      .set({ phoneChangeOldVerifiedAt: null, phoneChangeNewPhone: null, phoneOtpSessionId: null, phoneOtpExpiresAt: null })
      .where(eq(usersTable.id, req.userId!));
    res.status(400).json({ error: "window_expired", message: "Change window expired. Start over." });
    return;
  }

  const v = await verifySessionOtp(user.phoneOtpSessionId, cleanOtp);
  if (!v.ok) {
    res.status(400).json({
      error: "otp_mismatch",
      message: v.expired ? "OTP expired. Request a new voice call." : "Wrong OTP. Listen to the call again and re-enter.",
    });
    return;
  }

  // Final race re-check on the partial unique index (someone else might have
  // verified the same number in the seconds between /send-new and /verify-new).
  const conflicts = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(
      eq(usersTable.phoneNumber, user.phoneChangeNewPhone),
      isNotNull(usersTable.phoneVerifiedAt),
      ne(usersTable.id, req.userId!),
    ))
    .limit(1);
  if (conflicts.length > 0) {
    await db
      .update(usersTable)
      .set({ phoneOtpSessionId: null, phoneOtpExpiresAt: null, phoneChangeNewPhone: null, phoneChangeOldVerifiedAt: null })
      .where(eq(usersTable.id, req.userId!));
    res.status(409).json({
      error: "phone_already_verified",
      message: "This number was just verified on another account. Use a different number or contact support.",
    });
    return;
  }

  const oldPhone = user.phoneNumber;
  try {
    await db
      .update(usersTable)
      .set({
        phoneNumber: user.phoneChangeNewPhone,
        phoneVerifiedAt: new Date(),
        phoneOtpSessionId: null,
        phoneOtpExpiresAt: null,
        phoneChangeNewPhone: null,
        phoneChangeOldVerifiedAt: null,
      })
      .where(eq(usersTable.id, req.userId!));
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (/unique|duplicate/i.test(msg)) {
      res.status(409).json({ error: "phone_already_verified", message: "This number is already verified on another account." });
      return;
    }
    console.error("[phone-change] swap failed", { userId: req.userId, err: msg });
    res.status(500).json({ error: "swap_failed", message: "Could not save new number. Please retry." });
    return;
  }

  await createNotification(
    req.userId!,
    "system",
    "Phone number changed",
    `Your verified mobile number was changed${oldPhone ? ` from ******${oldPhone.slice(-4)}` : ""} to ******${user.phoneChangeNewPhone.slice(-4)}.`,
  );
  res.json({ success: true, verified: true, newPhone: user.phoneChangeNewPhone });
});

// ─── 5. Cancel: clear staging columns ─────────────────────────────────────────
router.post("/phone-change/cancel", authMiddleware, async (req: AuthRequest, res) => {
  await db
    .update(usersTable)
    .set({
      phoneOtpSessionId: null,
      phoneOtpExpiresAt: null,
      phoneChangeNewPhone: null,
      phoneChangeOldVerifiedAt: null,
    })
    .where(eq(usersTable.id, req.userId!));
  res.json({ success: true });
});

// ─── 6. Status: for UI to drive the wizard ────────────────────────────────────
router.get("/phone-change/status", authMiddleware, async (req: AuthRequest, res) => {
  const [user] = await db
    .select({
      phoneNumber: usersTable.phoneNumber,
      phoneVerifiedAt: usersTable.phoneVerifiedAt,
      phoneOtpSessionId: usersTable.phoneOtpSessionId,
      phoneOtpExpiresAt: usersTable.phoneOtpExpiresAt,
      phoneChangeNewPhone: usersTable.phoneChangeNewPhone,
      phoneChangeOldVerifiedAt: usersTable.phoneChangeOldVerifiedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }

  const oldVerified = user.phoneChangeOldVerifiedAt
    ? Date.now() - new Date(user.phoneChangeOldVerifiedAt).getTime() <= OLD_VERIFIED_WINDOW_MS
    : false;
  const otpActive = !!user.phoneOtpSessionId && !!user.phoneOtpExpiresAt && new Date(user.phoneOtpExpiresAt).getTime() > Date.now();

  let step: "idle" | "awaiting_old_otp" | "awaiting_new_phone" | "awaiting_new_otp" = "idle";
  if (oldVerified && otpActive && user.phoneChangeNewPhone) step = "awaiting_new_otp";
  else if (oldVerified) step = "awaiting_new_phone";
  else if (otpActive && !user.phoneChangeNewPhone) step = "awaiting_old_otp";

  res.json({
    currentPhone: user.phoneNumber,
    currentVerified: !!user.phoneVerifiedAt,
    step,
    pendingNewPhone: user.phoneChangeNewPhone,
    otpExpiresAt: user.phoneOtpExpiresAt?.toISOString() ?? null,
    oldVerifiedWindowExpiresAt: user.phoneChangeOldVerifiedAt
      ? new Date(new Date(user.phoneChangeOldVerifiedAt).getTime() + OLD_VERIFIED_WINDOW_MS).toISOString()
      : null,
  });
});

export default router;
