import {
  pgTable, serial, integer, numeric, varchar, text,
  timestamp, boolean, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── P2P Wallet ─────────────────────────────────────────────────────────────
// Per-user USDT balance dedicated to P2P trading. Separate from the main
// trading wallet so P2P funds are never confused with investment capital.
export const p2pWalletsTable = pgTable("p2p_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  availableBalance: numeric("available_balance", { precision: 18, scale: 8 }).notNull().default("0"),
  frozenBalance: numeric("frozen_balance", { precision: 18, scale: 8 }).notNull().default("0"),
  escrowBalance: numeric("escrow_balance", { precision: 18, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── P2P User Payment Methods ────────────────────────────────────────────────
// Payment methods the user (seller) accepts when receiving INR.
export const p2pUserPaymentMethodsTable = pgTable("p2p_user_payment_methods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // UPI | BANK | IMPS
  displayName: varchar("display_name", { length: 100 }).notNull(),
  upiId: varchar("upi_id", { length: 100 }),
  bankName: varchar("bank_name", { length: 100 }),
  accountHolder: varchar("account_holder", { length: 200 }),
  accountNumber: varchar("account_number", { length: 50 }),
  ifsc: varchar("ifsc", { length: 20 }),
  qrCodeData: text("qr_code_data"), // base64 data URL of QR code image (optional)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("p2p_upm_user_idx").on(t.userId),
}));

// ─── P2P Ads ─────────────────────────────────────────────────────────────────
// Buy / Sell advertisements posted by users.
// SELL ad creation: seller's USDT moves available → frozen immediately.
export const p2pAdsTable = pgTable("p2p_ads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: varchar("type", { length: 4 }).notNull(),           // BUY | SELL
  asset: varchar("asset", { length: 10 }).notNull().default("USDT"),
  fiatCurrency: varchar("fiat_currency", { length: 5 }).notNull().default("INR"),
  price: numeric("price", { precision: 18, scale: 2 }).notNull(),          // INR per 1 USDT
  quantity: numeric("quantity", { precision: 18, scale: 8 }).notNull(),    // total USDT in ad
  minLimit: numeric("min_limit", { precision: 18, scale: 2 }).notNull(),   // min INR per order
  maxLimit: numeric("max_limit", { precision: 18, scale: 2 }).notNull(),   // max INR per order
  paymentMethods: text("payment_methods").notNull().default("[]"),          // JSON array of method IDs
  terms: text("terms"),
  timeLimit: integer("time_limit").notNull().default(15), // minutes buyer has to pay
  status: varchar("status", { length: 20 }).notNull().default("active"),   // active | paused | completed | cancelled
  filledQuantity: numeric("filled_quantity", { precision: 18, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("p2p_ads_user_idx").on(t.userId),
  statusTypeIdx: index("p2p_ads_status_type_idx").on(t.status, t.type),
}));

// ─── P2P Orders ──────────────────────────────────────────────────────────────
// Order created by a buyer against a SELL ad (or seller against a BUY ad).
export const p2pOrdersTable = pgTable("p2p_orders", {
  id: serial("id").primaryKey(),
  adId: integer("ad_id").notNull(),
  buyerId: integer("buyer_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  fiatAmount: numeric("fiat_amount", { precision: 18, scale: 2 }).notNull(),   // total INR
  usdtAmount: numeric("usdt_amount", { precision: 18, scale: 8 }).notNull(),   // total USDT
  price: numeric("price", { precision: 18, scale: 2 }).notNull(),              // rate locked at order time
  paymentMethod: varchar("payment_method", { length: 30 }),                    // chosen payment method type
  status: varchar("status", { length: 20 }).notNull().default("pending"),      // pending | paid | completed | cancelled | disputed
  paymentDeadline: timestamp("payment_deadline"),
  paidAt: timestamp("paid_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  paymentRef: text("payment_ref"), // buyer's payment reference / UPI transaction ID
  paymentProofUrl: text("payment_proof_url"), // base64 data URL of buyer's payment screenshot
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  buyerIdx: index("p2p_orders_buyer_idx").on(t.buyerId),
  sellerIdx: index("p2p_orders_seller_idx").on(t.sellerId),
  adIdx: index("p2p_orders_ad_idx").on(t.adId),
  statusCreatedIdx: index("p2p_orders_status_created_idx").on(t.status, t.createdAt),
  // Composite indexes for stats aggregation query (completion rate per advertiser)
  // Allows index-only scans for COUNT(*) FILTER (WHERE status = 'completed')
  buyerStatusIdx: index("p2p_orders_buyer_status_idx").on(t.buyerId, t.status),
  sellerStatusIdx: index("p2p_orders_seller_status_idx").on(t.sellerId, t.status),
}));

// ─── P2P Escrow Transactions ──────────────────────────────────────────────────
// Audit trail of every escrow movement. One row per order.
export const p2pEscrowTransactionsTable = pgTable("p2p_escrow_transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().unique(),
  sellerId: integer("seller_id").notNull(),
  buyerId: integer("buyer_id").notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("held"), // held | released | returned
  releasedAt: timestamp("released_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  sellerIdx: index("p2p_escrow_seller_idx").on(t.sellerId),
}));

// ─── P2P Chat Messages ────────────────────────────────────────────────────────
// Per-order messaging between buyer and seller during active trades.
export const p2pChatMessagesTable = pgTable("p2p_chat_messages", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  senderId: integer("sender_id").notNull(),
  message: text("message").notNull().default(""),
  isSystem: boolean("is_system").notNull().default(false),
  attachmentData: text("attachment_data"),   // base64 data-URL (image or PDF)
  attachmentType: varchar("attachment_type", { length: 10 }), // 'image' | 'pdf' | null
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  orderIdx: index("p2p_chat_order_idx").on(t.orderId),
}));

// ─── P2P Ratings ──────────────────────────────────────────────────────────────
// Post-trade ratings (1–5 stars) left by buyer/seller after order completes.
export const p2pRatingsTable = pgTable("p2p_ratings", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  fromUserId: integer("from_user_id").notNull(),
  toUserId: integer("to_user_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  orderFromIdx: index("p2p_ratings_from_idx").on(t.orderId, t.fromUserId),
  toUserIdx: index("p2p_ratings_to_user_idx").on(t.toUserId),
}));

// ─── Insert Schemas (Zod) ─────────────────────────────────────────────────────
// ─── P2P Disputes ────────────────────────────────────────────────────────────
// One dispute per order. Opened by buyer or seller when something goes wrong
// after the buyer marked payment as sent. Admin reviews chat + payment proof
// + evidence and resolves by releasing USDT to buyer, refunding to seller,
// or rejecting the dispute (returns order to "paid" state).
export const p2pDisputesTable = pgTable("p2p_disputes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().unique(),
  openedByUserId: integer("opened_by_user_id").notNull(),
  openerRole: varchar("opener_role", { length: 10 }).notNull(), // buyer | seller
  reason: varchar("reason", { length: 60 }).notNull(),
  description: text("description"),
  evidenceUrl: text("evidence_url"), // optional base64 image
  status: varchar("status", { length: 25 }).notNull().default("open"),
  // open | resolved_release | resolved_refund | rejected
  resolutionNote: text("resolution_note"),
  resolvedByAdminId: integer("resolved_by_admin_id"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("p2p_disputes_status_idx").on(t.status),
  openedByIdx: index("p2p_disputes_opened_by_idx").on(t.openedByUserId),
}));

// ─── P2P Dispute Evidence ────────────────────────────────────────────────────
// Multi-file evidence attached to a dispute by either party (buyer or seller)
// after the dispute is opened. The legacy `p2p_disputes.evidence_url` column
// remains for the opener's at-creation upload; this table covers everything
// posted later (counter-evidence, second screenshots, etc) and is what admin
// reviews alongside the chat transcript. Files stored as base64 data URLs to
// keep parity with payment proofs (no S3 wiring yet) — size capped server-side.
export const p2pDisputeEvidenceTable = pgTable("p2p_dispute_evidence", {
  id: serial("id").primaryKey(),
  disputeId: integer("dispute_id").notNull(),
  uploadedByUserId: integer("uploaded_by_user_id").notNull(),
  uploaderRole: varchar("uploader_role", { length: 10 }).notNull(), // buyer | seller
  fileType: varchar("file_type", { length: 20 }).notNull(),         // image | document
  fileData: text("file_data").notNull(),                            // base64 data URL
  caption: varchar("caption", { length: 280 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  disputeIdx: index("p2p_dispute_evidence_dispute_idx").on(t.disputeId),
}));

export const insertP2pWalletSchema = createInsertSchema(p2pWalletsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertP2pAdSchema = createInsertSchema(p2pAdsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertP2pOrderSchema = createInsertSchema(p2pOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertP2pUserPaymentMethodSchema = createInsertSchema(p2pUserPaymentMethodsTable).omit({ id: true, createdAt: true });
export const insertP2pEscrowSchema = createInsertSchema(p2pEscrowTransactionsTable).omit({ id: true, createdAt: true });

export type P2pWallet = typeof p2pWalletsTable.$inferSelect;
export type P2pAd = typeof p2pAdsTable.$inferSelect;
export type P2pOrder = typeof p2pOrdersTable.$inferSelect;
export type P2pUserPaymentMethod = typeof p2pUserPaymentMethodsTable.$inferSelect;
export type P2pEscrowTransaction = typeof p2pEscrowTransactionsTable.$inferSelect;
