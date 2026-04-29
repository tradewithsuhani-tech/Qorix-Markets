#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Post-merge bootstrap. Runs automatically after every task/branch merge in
# this monorepo (see .local/skills/post_merge_setup).
#
# IMPORTANT: This project uses Drizzle's PUSH workflow, not committed
# migration files. There is intentionally no `lib/db/migrations/` directory
# and no `*.sql` migration scripts anywhere in the tree. Schema changes are
# made by editing the table definitions under `lib/db/src/schema/*` and the
# command below diffs the DB against those definitions and applies the
# necessary `CREATE`/`ALTER` statements in-place.
#
# Concretely, the `pnpm --filter db push` step below is what propagates new
# columns and tables (e.g. for Task #101: the new `chat_sessions` columns
# `detected_intent`, `language`, `engagement_score`, `profile`,
# `cta_shown_count`, `cta_clicked_count`, `converted_at`, `llm_reply_count`,
# `llm_tokens_used`, `llm_budget_date`, plus the new `chat_conversion_events`
# table and its indexes) to every environment on merge — without anyone
# needing to write a SQL migration by hand.
# ─────────────────────────────────────────────────────────────────────────────
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
