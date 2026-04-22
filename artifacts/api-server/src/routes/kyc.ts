import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";

const router = Router();

const ALLOWED_DOC_TYPES = ["passport", "national_id", "drivers_license"] as const;
type DocType = (typeof ALLOWED_DOC_TYPES)[number];

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB
const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+=*)$/;

function parseSubmitBody(body: any): { ok: true; data: { documentType: DocType; documentUrl: string } } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const { documentType, documentUrl } = body;
  if (!ALLOWED_DOC_TYPES.includes(documentType)) return { ok: false, error: "invalid_document_type" };
  if (typeof documentUrl !== "string") return { ok: false, error: "invalid_document_url" };
  const m = documentUrl.match(DATA_URL_RE);
  if (!m) return { ok: false, error: "invalid_document_format" };
  // Estimate decoded byte length: base64 -> bytes
  const b64 = m[2];
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((b64.length * 3) / 4) - padding;
  if (decodedBytes < 1024) return { ok: false, error: "image_too_small" };
  if (decodedBytes > MAX_IMAGE_BYTES) return { ok: false, error: "image_too_large" };
  return { ok: true, data: { documentType, documentUrl } };
}

function parseReviewBody(body: any): { ok: true; data: { userId: number; action: "approve" | "reject"; reason?: string } } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const { userId, action, reason } = body;
  if (!Number.isInteger(userId) || userId <= 0) return { ok: false, error: "invalid_user_id" };
  if (action !== "approve" && action !== "reject") return { ok: false, error: "invalid_action" };
  if (reason != null && (typeof reason !== "string" || reason.length > 500)) return { ok: false, error: "invalid_reason" };
  return { ok: true, data: { userId, action, reason } };
}

router.get("/kyc/status", authMiddleware, async (req: AuthRequest, res) => {
  const rows = await db
    .select({
      kycStatus: usersTable.kycStatus,
      kycDocumentType: usersTable.kycDocumentType,
      kycSubmittedAt: usersTable.kycSubmittedAt,
      kycReviewedAt: usersTable.kycReviewedAt,
      kycRejectionReason: usersTable.kycRejectionReason,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!rows.length) return res.status(404).json({ error: "user_not_found" });
  res.json(rows[0]);
});

router.post("/kyc/submit", authMiddleware, async (req: AuthRequest, res) => {
  const parsed = parseSubmitBody(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }
  const u = (
    await db.select({ kycStatus: usersTable.kycStatus }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1)
  )[0];
  if (!u) return res.status(404).json({ error: "user_not_found" });
  if (u.kycStatus === "approved") {
    return res.status(400).json({ error: "already_approved", message: "KYC is already approved" });
  }
  if (u.kycStatus === "pending") {
    return res.status(400).json({ error: "already_pending", message: "KYC submission is under review" });
  }
  await db
    .update(usersTable)
    .set({
      kycStatus: "pending",
      kycDocumentUrl: parsed.data.documentUrl,
      kycDocumentType: parsed.data.documentType,
      kycSubmittedAt: new Date(),
      kycReviewedAt: null,
      kycRejectionReason: null,
    })
    .where(eq(usersTable.id, req.userId!));
  await createNotification({
    userId: req.userId!,
    type: "system",
    title: "KYC submitted",
    message: "Your verification documents are under review. We'll notify you within 24 hours.",
  });
  res.json({ success: true, status: "pending" });
});

router.get("/admin/kyc/queue", authMiddleware, async (req: AuthRequest, res) => {
  const adminCheck = (
    await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1)
  )[0];
  if (!adminCheck?.isAdmin) return res.status(403).json({ error: "forbidden" });

  const status = (req.query.status as string) || "pending";
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
    })
    .from(usersTable)
    .where(eq(usersTable.kycStatus, status))
    .orderBy(sql`${usersTable.kycSubmittedAt} desc nulls last`)
    .limit(100);
  res.json({ users: rows });
});

router.get("/admin/kyc/document/:userId", authMiddleware, async (req: AuthRequest, res) => {
  const adminCheck = (
    await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1)
  )[0];
  if (!adminCheck?.isAdmin) return res.status(403).json({ error: "forbidden" });

  const targetId = Number(req.params.userId);
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: "invalid_user_id" });

  const row = (
    await db
      .select({ documentUrl: usersTable.kycDocumentUrl, documentType: usersTable.kycDocumentType })
      .from(usersTable)
      .where(eq(usersTable.id, targetId))
      .limit(1)
  )[0];
  if (!row || !row.documentUrl) return res.status(404).json({ error: "not_found" });
  // Re-validate stored value before returning
  if (!DATA_URL_RE.test(row.documentUrl)) return res.status(422).json({ error: "stored_value_invalid" });
  res.json({ documentUrl: row.documentUrl, documentType: row.documentType });
});

router.post("/admin/kyc/review", authMiddleware, async (req: AuthRequest, res) => {
  const adminCheck = (
    await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1)
  )[0];
  if (!adminCheck?.isAdmin) return res.status(403).json({ error: "forbidden" });

  const parsed = parseReviewBody(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const { userId, action, reason } = parsed.data;
  const newStatus = action === "approve" ? "approved" : "rejected";
  await db
    .update(usersTable)
    .set({
      kycStatus: newStatus,
      kycReviewedAt: new Date(),
      kycRejectionReason: action === "reject" ? (reason ?? "Document not acceptable") : null,
    })
    .where(eq(usersTable.id, userId));
  await createNotification({
    userId,
    type: action === "approve" ? "success" : "alert",
    title: action === "approve" ? "KYC approved" : "KYC rejected",
    message:
      action === "approve"
        ? "Your identity has been verified. You can now withdraw funds."
        : `Your KYC was rejected. ${reason ?? "Please re-submit clearer documents."}`,
  });
  res.json({ success: true, status: newStatus });
});

export default router;
