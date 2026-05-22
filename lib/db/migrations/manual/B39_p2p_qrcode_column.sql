-- B39: Fix missing columns from B38 migration (schema was updated after B38 was written)
-- Safe to re-run (IF NOT EXISTS everywhere).

-- 1. p2p_user_payment_methods.qr_code_data — missed in B38
ALTER TABLE p2p_user_payment_methods
ADD COLUMN IF NOT EXISTS qr_code_data TEXT;

-- 2. p2p_ads.time_limit — schema has default 15, B38 missed it entirely
ALTER TABLE p2p_ads
ADD COLUMN IF NOT EXISTS time_limit INTEGER NOT NULL DEFAULT 15;

-- 3. p2p_orders.cancel_reason — schema has it, B38 missed it
ALTER TABLE p2p_orders
ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
