import { Router, type IRouter } from "express";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";

const router: IRouter = Router();

const TWO_FACTOR_KEY = process.env.TWO_FACTOR_API_KEY ?? "";
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 min
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 sec
const MAX_SENDS_PER_DAY = 8;

// Normalize Indian phone — accept "+91", "91", or 10-digit and return clean 10-digit
function normalizePhone(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) return digits.slice(1);
  return null;
}

// POST /api/phone-otp/send  body: { phone }
router.post("/phone-otp/send", authMiddleware, async (req: AuthRequest, res) => {
  if (!TWO_FACTOR_KEY) {
    res.status(500).json({ error: "otp_not_configured", message: "Voice OTP service not configured" });
    return;
  }
  const { phone } = req.body ?? {};
  const normalized = normalizePhone(phone);
  if (!normalized) {
    res.status(400).json({ error: "invalid_phone", message: "Enter a valid 10-digit Indian mobile number" });
    return;
  }

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

  // SECURITY GUARD: this legacy endpoint is for INITIAL phone verification
  // (KYC flow). If the user already has a verified phone, changing it MUST
  // go through the /phone-change/* wizard which requires old-phone OTP
  // proof first. Otherwise a hijacked authenticated session could silently
  // re-bind the account to an attacker number using just this single
  // endpoint, defeating the whole purpose of the change wizard.
  // Allowed exception: re-verifying the SAME number (no-op semantically).
  if (user.phoneVerifiedAt && user.phoneNumber && normalized !== user.phoneNumber) {
    res.status(403).json({
      error: "use_phone_change_flow",
      message: "Your phone is already verified. Use the change-number flow in Settings to switch to a new number.",
    });
    return;
  }

  // Cooldown check
  if (user.phoneOtpLastSentAt) {
    const since = Date.now() - new Date(user.phoneOtpLastSentAt).getTime();
    if (since < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - since) / 1000);
      res.status(429).json({ error: "cooldown", message: `Wait ${waitSec}s before requesting another voice OTP` });
      return;
    }
    // Reset count if last send was > 24h ago
    if (since > 24 * 60 * 60 * 1000) {
      await db.update(usersTable).set({ phoneOtpSendCount: 0 }).where(eq(usersTable.id, req.userId!));
      user.phoneOtpSendCount = 0;
    }
  }

  // Daily limit
  if ((user.phoneOtpSendCount ?? 0) >= MAX_SENDS_PER_DAY) {
    res.status(429).json({ error: "daily_limit", message: "Daily voice OTP limit reached. Try again tomorrow." });
    return;
  }

  // KYC integrity guard: reject if this number is already verified on a
  // different account. Without this, one person could verify the same phone
  // across many accounts (multi-account fraud, signup-bonus farming, deposit
  // limit bypass). Pre-check here saves a wasted voice call + the user gets
  // a clear error instead of seeing a phantom OTP.
  const conflicts = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(
      eq(usersTable.phoneNumber, normalized),
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

  // Call 2Factor.in Voice OTP API
  let sessionId: string;
  try {
    const url = `https://2factor.in/API/V1/${encodeURIComponent(TWO_FACTOR_KEY)}/VOICE/${encodeURIComponent(normalized)}/AUTOGEN`;
    const r = await fetch(url);
    const data: any = await r.json().catch(() => ({}));
    if (!r.ok || data?.Status !== "Success" || !data?.Details) {
      console.warn("[phone-otp] 2Factor send failed", { status: r.status, data });
      res.status(502).json({ error: "otp_send_failed", message: data?.Details || "Could not place voice call. Try again." });
      return;
    }
    sessionId = String(data.Details);
  } catch (err: any) {
    console.error("[phone-otp] 2Factor network error", err?.message);
    res.status(502).json({ error: "otp_network_error", message: "Network error contacting voice OTP service" });
    return;
  }

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  await db
    .update(usersTable)
    .set({
      phoneOtpSessionId: sessionId,
      phoneOtpExpiresAt: expiresAt,
      phoneOtpSendCount: (user.phoneOtpSendCount ?? 0) + 1,
      phoneOtpLastSentAt: new Date(),
      phoneNumber: normalized, // tentative — only marked verified after OTP confirmed
    })
    .where(eq(usersTable.id, req.userId!));

  res.json({
    success: true,
    expiresAt: expiresAt.toISOString(),
    cooldownSec: RESEND_COOLDOWN_MS / 1000,
    sendsRemaining: Math.max(0, MAX_SENDS_PER_DAY - ((user.phoneOtpSendCount ?? 0) + 1)),
    phone: normalized,
  });
});

// POST /api/phone-otp/verify  body: { otp }
router.post("/phone-otp/verify", authMiddleware, async (req: AuthRequest, res) => {
  if (!TWO_FACTOR_KEY) {
    res.status(500).json({ error: "otp_not_configured" });
    return;
  }
  const { otp } = req.body ?? {};
  const cleanOtp = String(otp ?? "").replace(/\D/g, "");
  if (!/^\d{4,8}$/.test(cleanOtp)) {
    res.status(400).json({ error: "invalid_otp_format", message: "Enter the digits from the voice call" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      phoneVerifiedAt: usersTable.phoneVerifiedAt,
      phoneOtpSessionId: usersTable.phoneOtpSessionId,
      phoneOtpExpiresAt: usersTable.phoneOtpExpiresAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }

  // SECURITY GUARD (mirrors /phone-otp/send): if the user already has a
  // verified phone, this legacy verify endpoint must not flip the number.
  // A pending OTP session created BEFORE the new send-side guard could
  // otherwise still slip through and silently re-bind to an attacker's
  // candidate. Force the change wizard, which carries old-phone proof.
  if (user.phoneVerifiedAt) {
    // Best-effort cleanup of any dangling session so the wizard can claim it.
    await db.update(usersTable)
      .set({ phoneOtpSessionId: null, phoneOtpExpiresAt: null })
      .where(eq(usersTable.id, req.userId!));
    res.status(403).json({
      error: "use_phone_change_flow",
      message: "Your phone is already verified. Use the change-number flow in Settings to switch to a new number.",
    });
    return;
  }

  if (!user.phoneOtpSessionId) {
    res.status(400).json({ error: "no_active_otp", message: "Request a voice OTP first" });
    return;
  }
  if (user.phoneOtpExpiresAt && new Date(user.phoneOtpExpiresAt).getTime() < Date.now()) {
    await db.update(usersTable).set({ phoneOtpSessionId: null, phoneOtpExpiresAt: null }).where(eq(usersTable.id, req.userId!));
    res.status(400).json({ error: "otp_expired", message: "Voice OTP expired. Request a new one." });
    return;
  }

  // Verify with 2Factor.in.
  // 2Factor exposes /SMS/VERIFY/{sessionId}/{otp} as the unified session-based
  // verifier (works for both SMS and Voice channels). Some accounts/plans
  // require the channel-specific path /VOICE/VERIFY/{sessionId}/{otp}, so we
  // try the unified endpoint first and fall back to VOICE on a non-Success
  // response — and log the full response from each attempt so we can see the
  // real reason ("OTP Expired", "Invalid Session Id", "OTP Mismatch", etc.).
  type TwoFactorResp = { Status?: string; Details?: string };
  const tryVerify = async (path: "SMS" | "VOICE"): Promise<{ ok: boolean; status: number; data: TwoFactorResp }> => {
    const url = `https://2factor.in/API/V1/${encodeURIComponent(TWO_FACTOR_KEY)}/${path}/VERIFY/${encodeURIComponent(user.phoneOtpSessionId!)}/${encodeURIComponent(cleanOtp)}`;
    const r = await fetch(url);
    let data: TwoFactorResp = {};
    try { data = (await r.json()) as TwoFactorResp; } catch { /* non-JSON body */ }
    return { ok: r.ok && data?.Status === "Success", status: r.status, data };
  };

  try {
    const primary = await tryVerify("SMS");
    let final = primary;
    if (!primary.ok) {
      // Fallback to VOICE channel verifier
      const fallback = await tryVerify("VOICE");
      if (fallback.ok) {
        console.log("[phone-otp] verify ok via VOICE fallback", { userId: req.userId, sessionId: user.phoneOtpSessionId });
        final = fallback;
      } else {
        console.warn("[phone-otp] verify failed", {
          userId: req.userId,
          sessionId: user.phoneOtpSessionId,
          otpLen: cleanOtp.length,
          primary: { status: primary.status, Status: primary.data?.Status, Details: primary.data?.Details },
          fallback: { status: fallback.status, Status: fallback.data?.Status, Details: fallback.data?.Details },
        });
        const details = primary.data?.Details || fallback.data?.Details || "";
        const isExpired = /expir/i.test(details);
        res.status(400).json({
          error: "otp_mismatch",
          message: isExpired ? "OTP expired. Request a new voice call." : "Wrong OTP. Listen to the call again and re-enter.",
        });
        return;
      }
    }
    console.log("[phone-otp] verify success", { userId: req.userId, status: final.data?.Status });
  } catch (err: any) {
    console.error("[phone-otp] verify network error", err?.message);
    res.status(502).json({ error: "otp_network_error", message: "Network error verifying OTP" });
    return;
  }

  // Re-fetch the current phone the user submitted (set by /send) and final
  // race-condition guard: between /send and /verify another account could
  // have raced to verify the same number. The DB unique partial index is
  // the ultimate fence, but we surface a clean 409 instead of a raw 500
  // when that happens.
  const [me] = await db
    .select({ phoneNumber: usersTable.phoneNumber })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (me?.phoneNumber) {
    const conflicts = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(
        eq(usersTable.phoneNumber, me.phoneNumber),
        isNotNull(usersTable.phoneVerifiedAt),
        ne(usersTable.id, req.userId!),
      ))
      .limit(1);
    if (conflicts.length > 0) {
      // Clear the dangling otp state so the user gets a clean error path.
      await db
        .update(usersTable)
        .set({ phoneOtpSessionId: null, phoneOtpExpiresAt: null })
        .where(eq(usersTable.id, req.userId!));
      res.status(409).json({
        error: "phone_already_verified",
        message: "This number was just verified on another account. Use a different number or contact support.",
      });
      return;
    }
  }

  try {
    await db
      .update(usersTable)
      .set({
        phoneVerifiedAt: new Date(),
        phoneOtpSessionId: null,
        phoneOtpExpiresAt: null,
      })
      .where(eq(usersTable.id, req.userId!));
  } catch (err: any) {
    // Last-line defence: the partial unique index will throw if a true race
    // slipped past the pre-check. Translate to a clean 409.
    const msg = String(err?.message || "");
    if (/unique|duplicate/i.test(msg)) {
      res.status(409).json({
        error: "phone_already_verified",
        message: "This number is already verified on another account.",
      });
      return;
    }
    console.error("[phone-otp] verify final update failed", { userId: req.userId, err: msg });
    res.status(500).json({ error: "verify_failed", message: "Could not save verification. Please retry." });
    return;
  }

  await createNotification(req.userId!, "system", "Phone verified", "Your mobile number has been verified via voice OTP.");
  res.json({ success: true, verified: true });
});

// GET /api/phone-otp/status — for frontend to know current state
router.get("/phone-otp/status", authMiddleware, async (req: AuthRequest, res) => {
  const [user] = await db
    .select({
      phoneNumber: usersTable.phoneNumber,
      phoneVerifiedAt: usersTable.phoneVerifiedAt,
      phoneOtpExpiresAt: usersTable.phoneOtpExpiresAt,
      phoneOtpSessionId: usersTable.phoneOtpSessionId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
  res.json({
    phoneNumber: user.phoneNumber,
    verified: !!user.phoneVerifiedAt,
    verifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    pendingOtp: !!user.phoneOtpSessionId && !!user.phoneOtpExpiresAt && new Date(user.phoneOtpExpiresAt).getTime() > Date.now(),
    otpExpiresAt: user.phoneOtpExpiresAt?.toISOString() ?? null,
  });
});

export default router;
