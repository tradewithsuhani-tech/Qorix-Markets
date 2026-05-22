-- B39: P2P Dispute Evidence (Phase 8)
-- Multi-file evidence attached AFTER a dispute is opened, by either party
-- (buyer or seller). The legacy `p2p_disputes.evidence_url` column remains
-- for the opener's at-creation upload; this table covers everything posted
-- later (counter-screenshots, bank statements, etc).
-- Safe to re-run (IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS p2p_dispute_evidence (
  id                   SERIAL PRIMARY KEY,
  dispute_id           INTEGER NOT NULL,
  uploaded_by_user_id  INTEGER NOT NULL,
  uploader_role        VARCHAR(10) NOT NULL,   -- buyer | seller
  file_type            VARCHAR(20) NOT NULL,   -- image | document
  file_data            TEXT NOT NULL,          -- base64 data URL
  caption              VARCHAR(280),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS p2p_dispute_evidence_dispute_idx
  ON p2p_dispute_evidence(dispute_id);
