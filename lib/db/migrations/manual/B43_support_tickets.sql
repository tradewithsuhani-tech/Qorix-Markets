-- B43: Persist user support tickets for in-app ticket history.
-- Safe to re-run (IF NOT EXISTS).

DO $$ BEGIN
  CREATE TYPE support_ticket_status AS ENUM ('open', 'in_progress', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS support_tickets (
  id          SERIAL PRIMARY KEY,
  ticket_id   VARCHAR(20) NOT NULL UNIQUE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    VARCHAR(80) NOT NULL,
  subject     VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  status      support_ticket_status NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_created_idx
  ON support_tickets (user_id, created_at DESC);
