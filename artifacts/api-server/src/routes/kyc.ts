import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { and, eq, sql, isNotNull, ne } from "drizzle-orm";
import { authMiddleware, getQueryString, type AuthRequest } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";
import { sendOtp, verifyOtp, sendTxnEmailToUser } from "../lib/email-service";
import { notSmokeTestUser, shouldIncludeSmokeTest } from "../lib/smoke-test-account";
import { invalidateMerchantProfiles } from "../lib/p2p-profile";

const router = Router();

const ALLOWED_DOC_TYPES = ["passport", "national_id", "drivers_license"] as const;
type DocType = (typeof ALLOWED_DOC_TYPES)[number];

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB
const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+=*)$/;

function validateImageDataUrl(value: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "invalid_url" };
  const m = value.match(DATA_URL_RE);
  if (!m) return { ok: false, error: "invalid_format" };
  const b64 = m[2];
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((b64.length * 3) / 4) - padding;
  if (decodedBytes < 1024) return { ok: false, error: "image_too_small" };
  if (decodedBytes > MAX_IMAGE_BYTES) return { ok: false, error: "image_too_large" };
  return { ok: true };
}

// ─── GET STATUS (all 3 levels) ───────────────────────────────
router.get("/kyc/status", authMiddleware, async (req: AuthRequest, res) => {
  const rows = await db
    .select({
      // Lv.1
      kycPersonalStatus: usersTable.kycPersonalStatus,
      phoneNumber: usersTable.phoneNumber,
      dateOfBirth: usersTable.dateOfBirth,
      kycPersonalSubmittedAt: usersTable.kycPersonalSubmittedAt,
      email: usersTable.email,
      fullName: usersTable.fullName,
      // Lv.2
      kycStatus: usersTable.kycStatus,
      kycDocumentType: usersTable.kycDocumentType,
      kycSubmittedAt: usersTable.kycSubmittedAt,
      kycReviewedAt: usersTable.kycReviewedAt,
      kycRejectionReason: usersTable.kycRejectionReason,
      // Lv.3
      kycAddressStatus: usersTable.kycAddressStatus,
      addressLine1: usersTable.addressLine1,
      addressCity: usersTable.addressCity,
      addressState: usersTable.addressState,
      addressCountry: usersTable.addressCountry,
      addressPostalCode: usersTable.addressPostalCode,
      kycAddressSubmittedAt: usersTable.kycAddressSubmittedAt,
      kycAddressReviewedAt: usersTable.kycAddressReviewedAt,
      kycAddressRejectionReason: usersTable.kycAddressRejectionReason,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!rows.length) { res.status(404).json({ error: "user_not_found" }); return; }
  res.json(rows[0]);
});

// ─── Lv.1 — PERSONAL DETAILS (auto-approve on submit) ────────
router.post("/kyc/personal", authMiddleware, async (req: AuthRequest, res) => {
  const { dateOfBirth } = req.body ?? {};
  if (typeof dateOfBirth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    res.status(400).json({ error: "invalid_dob", message: "Use YYYY-MM-DD" });
    return;
  }
  // Age check: must be 18+
  const dob = new Date(dateOfBirth);
  const ageMs = Date.now() - dob.getTime();
  const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
  if (Number.isNaN(ageYears) || ageYears < 18 || ageYears > 120) {
    res.status(400).json({ error: "invalid_age", message: "You must be 18 or older" });
    return;
  }
  // Phone must already be verified via voice OTP (POST /api/phone-otp/verify)
  const [user] = await db
    .select({
      phoneNumber: usersTable.phoneNumber,
      phoneVerifiedAt: usersTable.phoneVerifiedAt,
      kycPersonalStatus: usersTable.kycPersonalStatus,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user?.phoneVerifiedAt || !user?.phoneNumber) {
    res.status(400).json({
      error: "phone_not_verified",
      message: "Verify your mobile number via voice OTP first.",
    });
    return;
  }
  // Idempotency guard: if Lv.1 already approved, no-op without re-firing
  // notifications/emails. Prevents spam from rapid re-submissions.
  if (user.kycPersonalStatus === "approved") {
    res.json({ success: true, status: "approved", noop: true });
    return;
  }
  await db
    .update(usersTable)
    .set({
      dateOfBirth,
      kycPersonalStatus: "approved",
      kycPersonalSubmittedAt: new Date(),
    })
    .where(eq(usersTable.id, req.userId!));
  await createNotification(req.userId!, "system", "Personal details verified", "Lv.1 verification complete.");
  sendTxnEmailToUser(
    req.userId!,
    "Personal details verified — Qorix Markets",
    "Your personal details (Lv.1) have been verified successfully. You can now proceed to identity verification (Lv.2).",
  );
  res.json({ success: true, status: "approved" });
});

// ─── Lv.2 — IDENTITY DOCUMENT ────────────────────────────────
router.post("/kyc/submit", authMiddleware, async (req: AuthRequest, res) => {
  const body = req.body ?? {};
  const { documentType, documentUrl, documentUrlBack } = body;
  if (!ALLOWED_DOC_TYPES.includes(documentType as DocType)) {
    res.status(400).json({ error: "invalid_document_type" });
    return;
  }
  const front = validateImageDataUrl(documentUrl);
  if (!front.ok) { res.status(400).json(front); return; }
  const requiresBack = documentType === "national_id" || documentType === "drivers_license";
  let back: string | null = null;
  if (documentUrlBack != null && documentUrlBack !== "") {
    const v = validateImageDataUrl(documentUrlBack);
    if (!v.ok) { res.status(400).json({ error: `back_${v.error}` }); return; }
    back = documentUrlBack;
  } else if (requiresBack) {
    res.status(400).json({ error: "back_image_required" });
    return;
  }
  const u = (
    await db
      .select({ kycStatus: usersTable.kycStatus, kycPersonalStatus: usersTable.kycPersonalStatus })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1)
  )[0];
  if (!u) { res.status(404).json({ error: "user_not_found" }); return; }
  if (u.kycPersonalStatus !== "approved") {
    res.status(400).json({ error: "personal_required", message: "Complete personal details first" });
    return;
  }
  if (u.kycStatus === "approved") { res.status(400).json({ error: "already_approved" }); return; }
  if (u.kycStatus === "pending") { res.status(400).json({ error: "already_pending" }); return; }
  await db
    .update(usersTable)
    .set({
      kycStatus: "pending",
      kycDocumentUrl: documentUrl,
      kycDocumentUrlBack: back,
      kycDocumentType: documentType,
      kycSubmittedAt: new Date(),
      kycReviewedAt: null,
      kycRejectionReason: null,
    })
    .where(eq(usersTable.id, req.userId!));
  await createNotification(req.userId!, "system", "Identity submitted", "Your ID is under review. We'll notify you within 24 hours.");
  sendTxnEmailToUser(
    req.userId!,
    "Identity verification submitted — Qorix Markets",
    "We've received your identity document (Lv.2). Our team will review it within 24 hours and notify you once a decision is made. No further action is needed from your side right now.",
  );
  res.json({ success: true, status: "pending" });
});

// ─── Lv.3 — ADDRESS VERIFICATION ─────────────────────────────
router.post("/kyc/address", authMiddleware, async (req: AuthRequest, res) => {
  const body = req.body ?? {};
  const { addressLine1, addressCity, addressState, addressCountry, addressPostalCode, documentUrl } = body;
  const reqStr = (v: unknown, max: number) =>
    typeof v === "string" && v.trim().length >= 2 && v.length <= max;
  if (!reqStr(addressLine1, 500)) { res.status(400).json({ error: "invalid_address_line1" }); return; }
  if (!reqStr(addressCity, 100)) { res.status(400).json({ error: "invalid_city" }); return; }
  if (!reqStr(addressState, 100)) { res.status(400).json({ error: "invalid_state" }); return; }
  if (!reqStr(addressCountry, 100)) { res.status(400).json({ error: "invalid_country" }); return; }
  if (!reqStr(addressPostalCode, 20)) { res.status(400).json({ error: "invalid_postal_code" }); return; }
  const doc = validateImageDataUrl(documentUrl);
  if (!doc.ok) { res.status(400).json(doc); return; }
  const u = (
    await db
      .select({ kycAddressStatus: usersTable.kycAddressStatus, kycStatus: usersTable.kycStatus })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1)
  )[0];
  if (!u) { res.status(404).json({ error: "user_not_found" }); return; }
  if (u.kycStatus !== "approved") {
    res.status(400).json({ error: "identity_required", message: "Complete identity verification first" });
    return;
  }
  if (u.kycAddressStatus === "approved") { res.status(400).json({ error: "already_approved" }); return; }
  if (u.kycAddressStatus === "pending") { res.status(400).json({ error: "already_pending" }); return; }
  await db
    .update(usersTable)
    .set({
      addressLine1: addressLine1.trim(),
      addressCity: addressCity.trim(),
      addressState: addressState.trim(),
      addressCountry: addressCountry.trim(),
      addressPostalCode: addressPostalCode.trim(),
      kycAddressDocUrl: documentUrl,
      kycAddressStatus: "pending",
      kycAddressSubmittedAt: new Date(),
      kycAddressReviewedAt: null,
      kycAddressRejectionReason: null,
    })
    .where(eq(usersTable.id, req.userId!));
  await createNotification(req.userId!, "system", "Address submitted", "Your address proof is under review.");
  sendTxnEmailToUser(
    req.userId!,
    "Address verification submitted — Qorix Markets",
    "We've received your address proof (Lv.3). Our team will review it within 24 hours and notify you once a decision is made.",
  );
  res.json({ success: true, status: "pending" });
});

// ─── PHONE OTP (KYC) ─────────────────────────────────────────

const KYC_TWO_FACTOR_KEY = process.env.TWO_FACTOR_API_KEY ?? "";
const KYC_OTP_EXPIRY_MS = 5 * 60 * 1000;     // 5 min
const KYC_RESEND_COOLDOWN_MS = 60 * 1000;     // 60 sec
const KYC_MAX_SENDS_PER_DAY = 5;

// Normalize Indian phone — accept "+91", "91", or 10-digit
function normalizePhone(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) return digits.slice(1);
  return null;
}

// Send OTP via 2factor.in (same provider as web app /phone-otp/send)
async function kycSend2FactorOtp(
  phone: string,
  channel: "sms" | "voice",
): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  const ch = channel === "voice" ? "VOICE" : "SMS";
  const url = `https://2factor.in/API/V1/${encodeURIComponent(KYC_TWO_FACTOR_KEY)}/${ch}/${encodeURIComponent(phone)}/AUTOGEN`;
  try {
    const r = await fetch(url);
    const data: any = await r.json().catch(() => ({}));
    if (!r.ok || data?.Status !== "Success" || !data?.Details) {
      return { ok: false, error: data?.Details || `${ch} OTP send failed (${r.status})` };
    }
    return { ok: true, sessionId: String(data.Details) };
  } catch (err: any) {
    return { ok: false, error: err?.message || "network error" };
  }
}

// POST /kyc/phone/send-otp  body: { phoneNumber, channel? }
// channel: "call" | "voice" → 2factor.in voice call
// channel: "sms"            → 2factor.in SMS
// channel: "email" / unset  → email OTP (fallback when 2factor key absent)
router.post("/kyc/phone/send-otp", authMiddleware, async (req: AuthRequest, res) => {
  const { phoneNumber, channel: rawChannel } = req.body ?? {};
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) {
    res.status(400).json({ error: "invalid_phone", message: "Enter a valid 10-digit Indian mobile number." });
    return;
  }

  // Normalise channel: Flutter sends "call" → map to "voice" for 2factor.in
  const ch = String(rawChannel ?? "sms").toLowerCase();
  const channel: "voice" | "sms" | "email" =
    ch === "call" || ch === "voice" ? "voice" :
    ch === "email" ? "email" : "sms";

  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      phoneVerifiedAt: usersTable.phoneVerifiedAt,
      phoneOtpSendCount: usersTable.phoneOtpSendCount,
      phoneOtpLastSentAt: usersTable.phoneOtpLastSentAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
  if (user.phoneVerifiedAt) {
    res.status(400).json({ error: "phone_already_verified", message: "Your mobile number is already verified." });
    return;
  }

  // Cooldown guard
  if (user.phoneOtpLastSentAt) {
    const since = Date.now() - new Date(user.phoneOtpLastSentAt).getTime();
    if (since < KYC_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((KYC_RESEND_COOLDOWN_MS - since) / 1000);
      res.status(429).json({ error: "cooldown", message: `Wait ${waitSec}s before requesting another OTP.` });
      return;
    }
    if (since > 24 * 60 * 60 * 1000) {
      await db.update(usersTable).set({ phoneOtpSendCount: 0 }).where(eq(usersTable.id, req.userId!));
      user.phoneOtpSendCount = 0;
    }
  }
  if ((user.phoneOtpSendCount ?? 0) >= KYC_MAX_SENDS_PER_DAY) {
    res.status(429).json({ error: "daily_limit", message: "Daily OTP limit reached. Try again tomorrow." });
    return;
  }

  // Multi-account guard: block if number is already verified on another account
  const conflict = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.phoneNumber, normalized), isNotNull(usersTable.phoneVerifiedAt), ne(usersTable.id, req.userId!)))
    .limit(1);
  if (conflict.length > 0) {
    res.status(409).json({ error: "phone_in_use", message: "This number is already verified on another account." });
    return;
  }

  // ── 2factor.in path (call / SMS) ──────────────────────────
  if (channel !== "email" && KYC_TWO_FACTOR_KEY) {
    const result = await kycSend2FactorOtp(normalized, channel === "voice" ? "voice" : "sms");
    if (!result.ok) {
      res.status(502).json({ error: "otp_send_failed", message: result.error || "Could not send OTP. Try again." });
      return;
    }
    const expiresAt = new Date(Date.now() + KYC_OTP_EXPIRY_MS);
    await db.update(usersTable)
      .set({
        phoneNumber: normalized,
        phoneOtpSessionId: result.sessionId!,
        phoneOtpExpiresAt: expiresAt,
        phoneOtpSendCount: (user.phoneOtpSendCount ?? 0) + 1,
        phoneOtpLastSentAt: new Date(),
      })
      .where(eq(usersTable.id, req.userId!));

    res.json({
      success: true,
      delivery: channel === "voice" ? "call" : "sms",
      expiresAt: expiresAt.toISOString(),
      cooldownSec: KYC_RESEND_COOLDOWN_MS / 1000,
      sendsRemaining: Math.max(0, KYC_MAX_SENDS_PER_DAY - ((user.phoneOtpSendCount ?? 0) + 1)),
    });
    return;
  }

  // ── Email fallback (channel=email or TWO_FACTOR_API_KEY not set) ──
  await sendOtp(user.id, user.email, "kyc_phone_verify");
  await db.update(usersTable)
    .set({
      phoneNumber: normalized,
      phoneOtpSendCount: (user.phoneOtpSendCount ?? 0) + 1,
      phoneOtpLastSentAt: new Date(),
    })
    .where(eq(usersTable.id, req.userId!));

  res.json({
    success: true,
    delivery: "email",
    message: "OTP sent to your registered email address.",
    maskedEmail: user.email.replace(/(.{2}).+(@.+)/, "$1***$2"),
    cooldownSec: KYC_RESEND_COOLDOWN_MS / 1000,
  });
});

// POST /kyc/phone/verify-otp  body: { phoneNumber, otp }
// Dual-path: verifies via 2factor.in session (call/SMS) OR email_otps table.
router.post("/kyc/phone/verify-otp", authMiddleware, async (req: AuthRequest, res) => {
  const { phoneNumber, otp } = req.body ?? {};
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) {
    res.status(400).json({ error: "invalid_phone", message: "Enter a valid 10-digit Indian mobile number." });
    return;
  }
  const cleaned = String(otp ?? "").replace(/\D/g, "");
  if (!/^\d{4,8}$/.test(cleaned)) {
    res.status(400).json({ error: "invalid_otp", message: "Enter the OTP digits." });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      phoneVerifiedAt: usersTable.phoneVerifiedAt,
      phoneOtpSessionId: usersTable.phoneOtpSessionId,
      phoneOtpExpiresAt: usersTable.phoneOtpExpiresAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  if (!user) { res.status(404).json({ error: "user_not_found" }); return; }
  if (user.phoneVerifiedAt) {
    res.status(400).json({ error: "phone_already_verified", message: "Your mobile number is already verified." });
    return;
  }

  // ── 2factor.in verification path ──────────────────────────
  if (user.phoneOtpSessionId && KYC_TWO_FACTOR_KEY) {
    if (user.phoneOtpExpiresAt && new Date(user.phoneOtpExpiresAt).getTime() < Date.now()) {
      await db.update(usersTable)
        .set({ phoneOtpSessionId: null, phoneOtpExpiresAt: null })
        .where(eq(usersTable.id, req.userId!));
      res.status(400).json({ error: "otp_expired", message: "OTP expired. Request a new one." });
      return;
    }
    const tryVerify = async (path: "SMS" | "VOICE") => {
      const url = `https://2factor.in/API/V1/${encodeURIComponent(KYC_TWO_FACTOR_KEY)}/${path}/VERIFY/${encodeURIComponent(user.phoneOtpSessionId!)}/${encodeURIComponent(cleaned)}`;
      const r = await fetch(url);
      const data: any = await r.json().catch(() => ({}));
      return r.ok && data?.Status === "Success";
    };
    let verified = false;
    try {
      verified = (await tryVerify("SMS")) || (await tryVerify("VOICE"));
    } catch {
      res.status(502).json({ error: "otp_verify_error", message: "Could not verify OTP. Try again." });
      return;
    }
    if (!verified) {
      res.status(400).json({ error: "invalid_otp", message: "Wrong OTP. Check your call/SMS and try again." });
      return;
    }
    await db.update(usersTable)
      .set({ phoneOtpSessionId: null, phoneOtpExpiresAt: null })
      .where(eq(usersTable.id, req.userId!));
  } else {
    // ── Email OTP path ─────────────────────────────────────
    const result = await verifyOtp(user.id, cleaned, "kyc_phone_verify");
    if (!result.valid) {
      res.status(400).json({ error: "invalid_otp", message: result.error ?? "Invalid or expired OTP." });
      return;
    }
  }

  await db.update(usersTable)
    .set({ phoneNumber: normalized, phoneVerifiedAt: new Date() })
    .where(eq(usersTable.id, req.userId!));
  await createNotification(req.userId!, "system", "Mobile number verified", "Your mobile number has been verified successfully.");
  res.json({ success: true, message: "Mobile number verified successfully." });
});

// ─── ADMIN ROUTES ────────────────────────────────────────────
async function requireAdmin(userId: number): Promise<boolean> {
  const r = (
    await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, userId)).limit(1)
  )[0];
  return !!r?.isAdmin;
}

router.get("/admin/kyc/queue", authMiddleware, async (req: AuthRequest, res) => {
  if (!(await requireAdmin(req.userId!))) { res.status(403).json({ error: "forbidden" }); return; }
  const status = getQueryString(req, "status", "pending");
  const kind = getQueryString(req, "kind", "identity"); // identity | address
  const statusCol = kind === "address" ? usersTable.kycAddressStatus : usersTable.kycStatus;
  const submittedCol = kind === "address" ? usersTable.kycAddressSubmittedAt : usersTable.kycSubmittedAt;
  // Hide the deploy smoke-test account from the identity / address queues by
  // default; admins can opt in via `?includeSmokeTest=true` for debugging.
  const includeSmoke = shouldIncludeSmokeTest(req.query["includeSmokeTest"]);
  const where = includeSmoke
    ? eq(statusCol, status)
    : and(eq(statusCol, status), notSmokeTestUser());
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      kycStatus: usersTable.kycStatus,
      kycDocumentType: usersTable.kycDocumentType,
      kycSubmittedAt: usersTable.kycSubmittedAt,
      kycReviewedAt: usersTable.kycReviewedAt,
      kycRejectionReason: usersTable.kycRejectionReason,
      kycAddressStatus: usersTable.kycAddressStatus,
      kycAddressSubmittedAt: usersTable.kycAddressSubmittedAt,
      kycAddressRejectionReason: usersTable.kycAddressRejectionReason,
    })
    .from(usersTable)
    .where(where)
    .orderBy(sql`${submittedCol} desc nulls last`)
    .limit(100);
  res.json({ users: rows, kind });
});

router.get("/admin/kyc/document/:userId", authMiddleware, async (req: AuthRequest, res) => {
  if (!(await requireAdmin(req.userId!))) { res.status(403).json({ error: "forbidden" }); return; }
  const targetId = Number(req.params.userId);
  if (!Number.isInteger(targetId) || targetId <= 0) { res.status(400).json({ error: "invalid_user_id" }); return; }
  const row = (
    await db
      .select({
        documentUrl: usersTable.kycDocumentUrl,
        documentUrlBack: usersTable.kycDocumentUrlBack,
        documentType: usersTable.kycDocumentType,
        addressDocUrl: usersTable.kycAddressDocUrl,
        addressLine1: usersTable.addressLine1,
        addressCity: usersTable.addressCity,
        addressState: usersTable.addressState,
        addressCountry: usersTable.addressCountry,
        addressPostalCode: usersTable.addressPostalCode,
        phoneNumber: usersTable.phoneNumber,
        dateOfBirth: usersTable.dateOfBirth,
      })
      .from(usersTable)
      .where(eq(usersTable.id, targetId))
      .limit(1)
  )[0];
  if (!row) { res.status(404).json({ error: "not_found" }); return; }
  const safe = (v: string | null) => (v && DATA_URL_RE.test(v) ? v : null);
  res.json({
    documentUrl: safe(row.documentUrl),
    documentUrlBack: safe(row.documentUrlBack),
    documentType: row.documentType,
    addressDocUrl: safe(row.addressDocUrl),
    addressLine1: row.addressLine1,
    addressCity: row.addressCity,
    addressState: row.addressState,
    addressCountry: row.addressCountry,
    addressPostalCode: row.addressPostalCode,
    phoneNumber: row.phoneNumber,
    dateOfBirth: row.dateOfBirth,
  });
});

router.post("/admin/kyc/review", authMiddleware, async (req: AuthRequest, res) => {
  if (!(await requireAdmin(req.userId!))) { res.status(403).json({ error: "forbidden" }); return; }
  const { userId, action, reason, kind } = req.body ?? {};
  if (!Number.isInteger(userId) || userId <= 0) { res.status(400).json({ error: "invalid_user_id" }); return; }
  if (action !== "approve" && action !== "reject") { res.status(400).json({ error: "invalid_action" }); return; }
  if (kind !== "identity" && kind !== "address") { res.status(400).json({ error: "invalid_kind" }); return; }
  if (reason != null && (typeof reason !== "string" || reason.length > 500)) { res.status(400).json({ error: "invalid_reason" }); return; }
  // Normalize: empty / whitespace-only reason → fallback. Without this an
  // admin who submits "" (which passes validation above) would send a
  // rejection email with a blank reason field.
  const cleanReason = (typeof reason === "string" ? reason.trim() : "") || "Document not acceptable";
  const isAddress = kind === "address";

  const target = (
    await db
      .select({ kycStatus: usersTable.kycStatus, kycAddressStatus: usersTable.kycAddressStatus })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
  )[0];
  if (!target) { res.status(404).json({ error: "user_not_found" }); return; }
  const currentStatus = isAddress ? target.kycAddressStatus : target.kycStatus;
  if (currentStatus !== "pending") {
    res.status(400).json({ error: "not_pending", message: `Current status is ${currentStatus}` });
    return;
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const set: Record<string, unknown> = isAddress
    ? {
        kycAddressStatus: newStatus,
        kycAddressReviewedAt: new Date(),
        kycAddressRejectionReason: action === "reject" ? cleanReason : null,
      }
    : {
        kycStatus: newStatus,
        kycReviewedAt: new Date(),
        kycRejectionReason: action === "reject" ? cleanReason : null,
      };
  await db.update(usersTable).set(set).where(eq(usersTable.id, userId));
  // P2P merchant trust profile depends on users.kycStatus (verified badge
  // gate). When the admin flips KYC to approved/rejected, bust the cached
  // profile so the badge updates immediately instead of lagging by up to
  // 5 minutes on every P2P surface.
  if (!isAddress) {
    await invalidateMerchantProfiles([userId]);
  }
  const notifTitle =
    action === "approve"
      ? (isAddress ? "Address verified" : "KYC approved")
      : (isAddress ? "Address rejected" : "KYC rejected");
  const notifBody =
    action === "approve"
      ? (isAddress ? "Lv.3 verification complete." : "Identity verified — withdrawals enabled.")
      : `${isAddress ? "Address" : "KYC"} rejected. ${cleanReason}`;
  await createNotification(userId, "system", notifTitle, notifBody);
  const emailSubject =
    action === "approve"
      ? (isAddress ? "Address verified — Qorix Markets" : "Identity verified — Qorix Markets")
      : (isAddress ? "Address verification rejected — Qorix Markets" : "Identity verification rejected — Qorix Markets");
  const emailBody =
    action === "approve"
      ? (isAddress
          ? "Great news! Your address proof (Lv.3) has been verified. Your account is now fully verified."
          : "Great news! Your identity (Lv.2) has been verified. Withdrawals are now enabled on your account. You can proceed to Lv.3 (address) verification if not already done.")
      : (isAddress
          ? `Your address verification was rejected.\n\nReason: ${cleanReason}\n\nPlease re-submit a clearer copy of an accepted address proof from your dashboard.`
          : `Your identity verification was rejected.\n\nReason: ${cleanReason}\n\nPlease re-submit a clearer copy of an accepted ID document from your dashboard.`);
  sendTxnEmailToUser(userId, emailSubject, emailBody);
  res.json({ success: true, status: newStatus });
});

export default router;
