-- Broker integration: Zerodha live + demo trading mode
CREATE TABLE IF NOT EXISTS broker_user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  trading_mode VARCHAR(16) NOT NULL DEFAULT 'demo',
  active_broker VARCHAR(32),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broker_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker VARCHAR(32) NOT NULL,
  broker_user_id VARCHAR(64),
  broker_user_name VARCHAR(255),
  access_token_enc TEXT NOT NULL,
  api_key VARCHAR(64),
  token_expires_at TIMESTAMP,
  meta JSONB,
  connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS broker_connections_user_broker_uq
  ON broker_connections(user_id, broker);

CREATE TABLE IF NOT EXISTS broker_demo_state (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cash_balance NUMERIC(18, 2) NOT NULL DEFAULT 1000000,
  holdings JSONB NOT NULL DEFAULT '[]'::jsonb,
  positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  orders JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
