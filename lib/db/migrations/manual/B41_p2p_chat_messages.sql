-- B41: Create p2p_chat_messages table + attachment columns.
-- This table was defined in the Drizzle schema (lib/db/src/schema/p2p.ts)
-- but was never included in B38_p2p_module.sql, so INSERT fails with
-- "relation p2p_chat_messages does not exist".
-- Also adds attachment_data / attachment_type so buyers/sellers can share
-- payment screenshots and PDFs inline in the trade chat.
-- Safe to re-run (IF NOT EXISTS / IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS p2p_chat_messages (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL,
  sender_id       INTEGER NOT NULL,
  message         TEXT    NOT NULL DEFAULT '',
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  attachment_data TEXT,                          -- base64 data-URL (image or PDF)
  attachment_type VARCHAR(10),                   -- 'image' | 'pdf' | NULL
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS p2p_chat_order_idx ON p2p_chat_messages(order_id);
