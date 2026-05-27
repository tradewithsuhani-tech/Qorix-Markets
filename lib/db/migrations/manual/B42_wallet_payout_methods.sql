-- B42: INR wallet payout methods (saved bank/UPI/Qorix-user destinations)
-- Used by: Profile → Account → "INR payout methods" CRUD
--           Wallet → Withdraw → INR → saved destination picker

CREATE TABLE IF NOT EXISTS wallet_payout_methods (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  type          VARCHAR(20) NOT NULL,          -- bank | upi | qorix_user
  label         VARCHAR(100),
  account_name  VARCHAR(200) NOT NULL,
  account_value VARCHAR(200) NOT NULL,
  bank_name     VARCHAR(100),
  ifsc          VARCHAR(20),
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wpm_user_idx ON wallet_payout_methods (user_id);
