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
  message: text("message").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
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
