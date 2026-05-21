-- B38: P2P Trading Module — Foundation (Step 1)
-- Creates 5 tables: p2p_wallets, p2p_user_payment_methods, p2p_ads,
-- p2p_orders, p2p_escrow_transactions.
-- Safe to re-run (IF NOT EXISTS everywhere).

-- ── p2p_wallets ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_wallets (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL UNIQUE,
  available_balance NUMERIC(18,8) NOT NULL DEFAULT 0,
  frozen_balance    NUMERIC(18,8) NOT NULL DEFAULT 0,
  escrow_balance    NUMERIC(18,8) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── p2p_user_payment_methods ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_user_payment_methods (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  type             VARCHAR(20) NOT NULL,          -- UPI | BANK | IMPS
  display_name     VARCHAR(100) NOT NULL,
  upi_id           VARCHAR(100),
  bank_name        VARCHAR(100),
  account_holder   VARCHAR(200),
  account_number   VARCHAR(50),
  ifsc             VARCHAR(20),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS p2p_upm_user_idx ON p2p_user_payment_methods(user_id);

-- ── p2p_ads ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_ads (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  type             VARCHAR(4) NOT NULL,           -- BUY | SELL
  asset            VARCHAR(10) NOT NULL DEFAULT 'USDT',
  fiat_currency    VARCHAR(5) NOT NULL DEFAULT 'INR',
  price            NUMERIC(18,2) NOT NULL,        -- INR per 1 USDT
  quantity         NUMERIC(18,8) NOT NULL,        -- total USDT in ad
  min_limit        NUMERIC(18,2) NOT NULL,        -- min INR per order
  max_limit        NUMERIC(18,2) NOT NULL,        -- max INR per order
  payment_methods  TEXT NOT NULL DEFAULT '[]',   -- JSON array of method IDs
  terms            TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'active',  -- active|paused|completed|cancelled
  filled_quantity  NUMERIC(18,8) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS p2p_ads_user_idx ON p2p_ads(user_id);
CREATE INDEX IF NOT EXISTS p2p_ads_status_type_idx ON p2p_ads(status, type);

-- ── p2p_orders ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_orders (
  id                SERIAL PRIMARY KEY,
  ad_id             INTEGER NOT NULL,
  buyer_id          INTEGER NOT NULL,
  seller_id         INTEGER NOT NULL,
  fiat_amount       NUMERIC(18,2) NOT NULL,
  usdt_amount       NUMERIC(18,8) NOT NULL,
  price             NUMERIC(18,2) NOT NULL,
  payment_method    VARCHAR(30),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending|paid|completed|cancelled|disputed
  payment_deadline  TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS p2p_orders_buyer_idx  ON p2p_orders(buyer_id);
CREATE INDEX IF NOT EXISTS p2p_orders_seller_idx ON p2p_orders(seller_id);
CREATE INDEX IF NOT EXISTS p2p_orders_ad_idx     ON p2p_orders(ad_id);

-- ── p2p_escrow_transactions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_escrow_transactions (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL UNIQUE,
  seller_id    INTEGER NOT NULL,
  buyer_id     INTEGER NOT NULL,
  amount       NUMERIC(18,8) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'held',  -- held|released|returned
  released_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS p2p_escrow_seller_idx ON p2p_escrow_transactions(seller_id);
