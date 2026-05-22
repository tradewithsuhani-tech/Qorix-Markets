-- B40: Add missing p2p_orders columns (payment_ref, payment_proof_url)
-- These were present in the Drizzle schema but never added to the migration.
-- Without them, INSERT into p2p_orders throws "column does not exist".
-- Safe to re-run (IF NOT EXISTS everywhere).

ALTER TABLE p2p_orders
ADD COLUMN IF NOT EXISTS payment_ref TEXT;

ALTER TABLE p2p_orders
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
