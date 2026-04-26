import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authMiddleware, getQueryString, type AuthRequest } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";

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
  const { phoneNumber, dateOfBirth } = req.body ?? {};
  if (typeof phoneNumber !== "string" || phoneNumber.trim().length < 6 || phoneNumber.length > 32) {
    res.status(400).json({ error: "invalid_phone" });
    return;
  }
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
  await db
    .update(usersTable)
    .set({
      phoneNumber: phoneNumber.trim(),
      dateOfBirth,
      kycPersonalStatus: "approved",
      kycPersonalSubmittedAt: new Date(),
    })
    .where(eq(usersTable.id, req.userId!));
  await createNotification(req.userId!, "system", "Personal details verified", "Lv.1 verification complete.");
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
  res.json({ success: true, status: "pending" });
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
    .where(eq(statusCol, status))
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
        kycAddressRejectionReason: action === "reject" ? (reason ?? "Document not acceptable") : null,
      }
    : {
        kycStatus: newStatus,
        kycReviewedAt: new Date(),
        kycRejectionReason: action === "reject" ? (reason ?? "Document not acceptable") : null,
      };
  await db.update(usersTable).set(set).where(eq(usersTable.id, userId));
  await createNotification(
    userId,
    "system",
    action === "approve"
      ? (isAddress ? "Address verified" : "KYC approved")
      : (isAddress ? "Address rejected" : "KYC rejected"),
    action === "approve"
      ? (isAddress ? "Lv.3 verification complete." : "Identity verified — withdrawals enabled.")
      : `${isAddress ? "Address" : "KYC"} rejected. ${reason ?? "Please re-submit."}`,
  );
  res.json({ success: true, status: newStatus });
});

export default router;
