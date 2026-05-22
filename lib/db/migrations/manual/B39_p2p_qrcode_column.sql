-- B39: Add qr_code_data column to p2p_user_payment_methods
-- The B38 migration missed this column (added in schema later).
-- Safe to re-run (IF NOT EXISTS).

ALTER TABLE p2p_user_payment_methods
ADD COLUMN IF NOT EXISTS qr_code_data TEXT;
