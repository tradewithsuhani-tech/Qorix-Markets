import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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
      phoneOtpSendCount: usersTable.phoneOtpSendCount,
      phoneOtpLastSentAt: usersTable.phoneOtpLastSentAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }

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
      phoneOtpSessionId: usersTable.phoneOtpSessionId,
      phoneOtpExpiresAt: usersTable.phoneOtpExpiresAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
  if (!user.phoneOtpSessionId) {
    res.status(400).json({ error: "no_active_otp", message: "Request a voice OTP first" });
    return;
  }
  if (user.phoneOtpExpiresAt && new Date(user.phoneOtpExpiresAt).getTime() < Date.now()) {
    await db.update(usersTable).set({ phoneOtpSessionId: null, phoneOtpExpiresAt: null }).where(eq(usersTable.id, req.userId!));
    res.status(400).json({ error: "otp_expired", message: "Voice OTP expired. Request a new one." });
    return;
  }

  // Verify with 2Factor.in
  try {
    const url = `https://2factor.in/API/V1/${encodeURIComponent(TWO_FACTOR_KEY)}/SMS/VERIFY/${encodeURIComponent(user.phoneOtpSessionId)}/${encodeURIComponent(cleanOtp)}`;
    const r = await fetch(url);
    const data: any = await r.json().catch(() => ({}));
    if (!r.ok || data?.Status !== "Success") {
      res.status(400).json({ error: "otp_mismatch", message: data?.Details === "OTP Expired" ? "OTP expired" : "Wrong OTP, try again" });
      return;
    }
  } catch (err: any) {
    console.error("[phone-otp] verify network error", err?.message);
    res.status(502).json({ error: "otp_network_error", message: "Network error verifying OTP" });
    return;
  }

  await db
    .update(usersTable)
    .set({
      phoneVerifiedAt: new Date(),
      phoneOtpSessionId: null,
      phoneOtpExpiresAt: null,
    })
    .where(eq(usersTable.id, req.userId!));

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
