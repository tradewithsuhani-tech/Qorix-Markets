CREATE TYPE "public"."chat_session_status" AS ENUM('active', 'expert_requested', 'resolved');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"admin_role" varchar(30) DEFAULT 'user' NOT NULL,
	"kyc_status" varchar(30) DEFAULT 'not_submitted' NOT NULL,
	"kyc_document_url" text,
	"kyc_document_url_back" text,
	"kyc_document_type" varchar(30),
	"kyc_submitted_at" timestamp,
	"kyc_reviewed_at" timestamp,
	"kyc_rejection_reason" text,
	"kyc_personal_status" varchar(30) DEFAULT 'not_submitted' NOT NULL,
	"phone_number" varchar(32),
	"date_of_birth" varchar(20),
	"kyc_personal_submitted_at" timestamp,
	"phone_verified_at" timestamp,
	"phone_otp_session_id" varchar(64),
	"phone_otp_expires_at" timestamp,
	"phone_otp_send_count" integer DEFAULT 0 NOT NULL,
	"phone_otp_last_sent_at" timestamp,
	"phone_change_new_phone" varchar(32),
	"phone_change_old_verified_at" timestamp,
	"kyc_address_status" varchar(30) DEFAULT 'not_submitted' NOT NULL,
	"address_line1" text,
	"address_city" varchar(100),
	"address_state" varchar(100),
	"address_country" varchar(100),
	"address_postal_code" varchar(20),
	"kyc_address_doc_url" text,
	"kyc_address_submitted_at" timestamp,
	"kyc_address_reviewed_at" timestamp,
	"kyc_address_rejection_reason" text,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"is_frozen" boolean DEFAULT false NOT NULL,
	"force_logout_after" timestamp,
	"password_changed_at" timestamp,
	"active_session_fingerprint" varchar(64),
	"active_session_last_seen" timestamp,
	"referral_code" varchar(20) NOT NULL,
	"sponsor_id" serial NOT NULL,
	"tron_address" varchar(64),
	"email_verified" boolean DEFAULT false NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"is_smoke_test" boolean DEFAULT false NOT NULL,
	"telegram_chat_id" bigint,
	"telegram_username" varchar(64),
	"telegram_link_code" varchar(16),
	"telegram_link_code_expires_at" timestamp,
	"telegram_linked_at" timestamp,
	"telegram_opt_in" boolean DEFAULT true NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" text,
	"two_factor_backup_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"two_factor_enabled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"device_fingerprint" varchar(64) NOT NULL,
	"user_agent" text,
	"ip_address" varchar(64),
	"browser_label" varchar(80),
	"os_label" varchar(80),
	"poll_token" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"issued_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"decided_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"main_balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"trading_balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"profit_balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"usdt_balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"demo_equity_boost" numeric(18, 2) DEFAULT '0' NOT NULL,
	"demo_equity_last_at" bigint DEFAULT 0 NOT NULL,
	"daily_pnl_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"daily_pnl_pct" numeric(6, 4) DEFAULT '0' NOT NULL,
	"daily_pnl_day" varchar(10) DEFAULT '' NOT NULL,
	"daily_pnl_target_pct" numeric(6, 4) DEFAULT '0' NOT NULL,
	"daily_pnl_chunks" text DEFAULT '[]' NOT NULL,
	"daily_pnl_increments_done" integer DEFAULT 0 NOT NULL,
	"trading_fund_boost" numeric(18, 2) DEFAULT '0' NOT NULL,
	"trading_fund_last_at" bigint DEFAULT 0 NOT NULL,
	"total_profit_boost" numeric(18, 2) DEFAULT '0' NOT NULL,
	"synth_win_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"synth_max_drawdown" numeric(5, 2) DEFAULT '0' NOT NULL,
	"synth_avg_return" numeric(5, 2) DEFAULT '0' NOT NULL,
	"synth_risk_score" varchar(10) DEFAULT 'Low' NOT NULL,
	"synth_metrics_day" varchar(10) DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"description" text,
	"wallet_address" varchar(255),
	"tx_hash" varchar(255),
	"idempotency_key" varchar(80),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" numeric(18, 8) DEFAULT '0' NOT NULL,
	"risk_level" varchar(20) DEFAULT 'low' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"auto_compound" boolean DEFAULT false NOT NULL,
	"total_profit" numeric(18, 8) DEFAULT '0' NOT NULL,
	"daily_profit" numeric(18, 8) DEFAULT '0' NOT NULL,
	"drawdown" numeric(18, 8) DEFAULT '0' NOT NULL,
	"drawdown_limit" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"peak_balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"referral_bonus_paid" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"stopped_at" timestamp,
	"paused_at" timestamp,
	CONSTRAINT "investments_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"entry_price" numeric(18, 8) NOT NULL,
	"exit_price" numeric(18, 8) NOT NULL,
	"profit" numeric(18, 8) NOT NULL,
	"profit_percent" numeric(10, 4) NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equity_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"equity" numeric(18, 8) NOT NULL,
	"profit" numeric(18, 8) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "daily_profit_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_date" date NOT NULL,
	"profit_percent" numeric(10, 4) NOT NULL,
	"total_aum" numeric(18, 8) DEFAULT '0' NOT NULL,
	"total_profit_distributed" numeric(18, 8) DEFAULT '0' NOT NULL,
	"investors_affected" integer DEFAULT 0 NOT NULL,
	"referral_bonus_paid" numeric(18, 8) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(30) DEFAULT 'system' NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_desk_traders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"strategy_type" varchar(20) NOT NULL,
	"experience_years" integer NOT NULL,
	"win_rate_percent" numeric(5, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"monthly_return" numeric(10, 4) DEFAULT '0' NOT NULL,
	"max_drawdown" numeric(10, 4) DEFAULT '0' NOT NULL,
	"win_rate" numeric(10, 4) DEFAULT '0' NOT NULL,
	"total_profit" numeric(18, 8) DEFAULT '0' NOT NULL,
	"trading_days" integer DEFAULT 0 NOT NULL,
	"winning_days" integer DEFAULT 0 NOT NULL,
	"start_equity" numeric(18, 8) DEFAULT '0' NOT NULL,
	"peak_equity" numeric(18, 8) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"hash_id" varchar(64) NOT NULL,
	"user_id" integer NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"monthly_return" numeric(10, 4) NOT NULL,
	"max_drawdown" numeric(10, 4) NOT NULL,
	"win_rate" numeric(10, 4) NOT NULL,
	"total_profit" numeric(18, 8) NOT NULL,
	"trading_days" integer NOT NULL,
	"winning_days" integer NOT NULL,
	"start_equity" numeric(18, 8) NOT NULL,
	"peak_equity" numeric(18, 8) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_verifications_hash_id_unique" UNIQUE("hash_id")
);
--> statement-breakpoint
CREATE TABLE "gl_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"account_type" varchar(50) NOT NULL,
	"normal_balance" varchar(10) DEFAULT 'debit' NOT NULL,
	"user_id" integer,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gl_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_id" varchar(100) NOT NULL,
	"transaction_id" integer,
	"account_id" integer NOT NULL,
	"account_code" varchar(100) NOT NULL,
	"entry_type" varchar(10) NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"currency" varchar(10) DEFAULT 'USDT' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"flag_type" varchar(50) NOT NULL,
	"severity" varchar(10) DEFAULT 'medium' NOT NULL,
	"details" text DEFAULT '{}' NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolved_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ip_address" varchar(64) NOT NULL,
	"user_agent" text,
	"device_fingerprint" varchar(64),
	"event_type" varchar(20) DEFAULT 'login' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversion_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" integer,
	"event_type" varchar(40) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"visitor_id" varchar(64),
	"email" varchar(255) NOT NULL,
	"name" varchar(120),
	"phone" varchar(40),
	"consent" boolean DEFAULT false NOT NULL,
	"follow_up_sent_at" timestamp,
	"follow_up_attempts" integer DEFAULT 0 NOT NULL,
	"unsubscribed_at" timestamp,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"sender_type" text NOT NULL,
	"sender_id" integer,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"visitor_id" varchar(64),
	"status" "chat_session_status" DEFAULT 'active' NOT NULL,
	"expert_requested" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"detected_intent" varchar(32),
	"language" varchar(16),
	"preferred_language" varchar(16),
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cta_shown_count" integer DEFAULT 0 NOT NULL,
	"cta_clicked_count" integer DEFAULT 0 NOT NULL,
	"converted_at" timestamp,
	"llm_reply_count" integer DEFAULT 0 NOT NULL,
	"llm_tokens_used" integer DEFAULT 0 NOT NULL,
	"llm_budget_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "chat_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"system_prompt" text,
	"quick_replies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deposit_cta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"email_followup" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"model" varchar(64) DEFAULT 'gpt-4o-mini' NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.7' NOT NULL,
	"max_tokens" integer DEFAULT 600 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "deposit_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trc20_address" varchar(64) NOT NULL,
	"private_key_enc" varchar(512) DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_addresses_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "deposit_addresses_trc20_address_unique" UNIQUE("trc20_address")
);
--> statement-breakpoint
CREATE TABLE "blockchain_deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tx_hash" varchar(128) NOT NULL,
	"from_address" varchar(64) NOT NULL,
	"to_address" varchar(64) NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"credited" boolean DEFAULT false NOT NULL,
	"swept" boolean DEFAULT false NOT NULL,
	"sweep_tx_hash" varchar(128),
	"block_timestamp" timestamp,
	"credited_at" timestamp,
	"swept_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blockchain_deposits_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "email_otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"otp" varchar(8) NOT NULL,
	"purpose" varchar(30) DEFAULT 'verify_email' NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip_signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" varchar(64) NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"reference_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_proofs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"proof_type" varchar(20) DEFAULT 'text' NOT NULL,
	"proof_content" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(60) NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" varchar(20) DEFAULT 'daily' NOT NULL,
	"point_reward" integer DEFAULT 0 NOT NULL,
	"requires_proof" boolean DEFAULT false NOT NULL,
	"requires_kyc" boolean DEFAULT false NOT NULL,
	"requires_deposit" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"icon_name" varchar(40) DEFAULT 'Star' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_task_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"period_key" varchar(16) DEFAULT 'ALL' NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_trade_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"action" varchar(30) NOT NULL,
	"actor_user_id" integer,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_trade_distributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"share_basis" numeric(18, 8) NOT NULL,
	"profit_amount" numeric(18, 8) NOT NULL,
	"swept_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"pair" varchar(20) NOT NULL,
	"direction" varchar(4) NOT NULL,
	"entry_price" numeric(18, 5) NOT NULL,
	"pips_target" numeric(12, 2) NOT NULL,
	"pip_size" numeric(12, 6) DEFAULT '0.0001' NOT NULL,
	"exit_price" numeric(18, 5) NOT NULL,
	"tp_price" numeric(18, 5),
	"sl_price" numeric(18, 5),
	"scheduled_at" timestamp,
	"expected_profit_percent" numeric(8, 4) NOT NULL,
	"realized_profit_percent" numeric(8, 4),
	"realized_exit_price" numeric(18, 5),
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"close_reason" varchar(30),
	"notes" text,
	"total_distributed" numeric(18, 8) DEFAULT '0',
	"affected_users" integer DEFAULT 0,
	"idempotency_key" varchar(80) NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	CONSTRAINT "signal_trades_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "pnl_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" varchar(10) NOT NULL,
	"percent" numeric(6, 4) DEFAULT '0' NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code" varchar(32) NOT NULL,
	"status" varchar(20) DEFAULT 'issued' NOT NULL,
	"bonus_percent" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"bonus_amount" numeric(18, 8),
	"deposit_id" integer,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"redeemed_at" timestamp,
	"credited_at" timestamp,
	CONSTRAINT "promo_redemptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "scheduled_promos" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(32) NOT NULL,
	"description" text,
	"bonus_percent" numeric(5, 2) NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"max_redemptions" integer,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_promos_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(20) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"account_holder" varchar(200),
	"account_number" varchar(50),
	"ifsc" varchar(20),
	"bank_name" varchar(100),
	"upi_id" varchar(100),
	"qr_image_base64" text,
	"min_amount" numeric(18, 2) DEFAULT '100' NOT NULL,
	"max_amount" numeric(18, 2) DEFAULT '500000' NOT NULL,
	"instructions" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"merchant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inr_deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"payment_method_id" integer NOT NULL,
	"amount_inr" numeric(18, 2) NOT NULL,
	"amount_usdt" numeric(18, 6) NOT NULL,
	"rate_used" numeric(18, 4) NOT NULL,
	"utr" varchar(100) NOT NULL,
	"proof_image_base64" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"reviewed_by" integer,
	"reviewed_by_kind" varchar(20),
	"reviewed_at" timestamp,
	"escalated_to_merchant_at" timestamp,
	"escalated_to_admin_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inr_withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount_inr" numeric(18, 2) NOT NULL,
	"amount_usdt" numeric(18, 6) NOT NULL,
	"rate_used" numeric(18, 4) NOT NULL,
	"payout_method" varchar(20) NOT NULL,
	"upi_id" varchar(100),
	"account_holder" varchar(200),
	"account_number" varchar(50),
	"ifsc" varchar(20),
	"bank_name" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"payout_reference" varchar(100),
	"reviewed_by" integer,
	"reviewed_by_kind" varchar(20),
	"assigned_merchant_id" integer,
	"reviewed_at" timestamp,
	"escalated_to_merchant_at" timestamp,
	"escalated_to_admin_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(200) NOT NULL,
	"password_hash" varchar(200) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"phone" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"inr_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"provider" varchar(40) NOT NULL,
	"amount_usd" numeric(10, 2) DEFAULT '0' NOT NULL,
	"billing_cycle" varchar(20) DEFAULT 'monthly' NOT NULL,
	"next_due_date" date,
	"last_paid_date" date,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_permissions" (
	"admin_id" integer PRIMARY KEY NOT NULL,
	"modules" text[] DEFAULT '{}' NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"admin_email" varchar(255),
	"admin_role" varchar(20),
	"module" varchar(50),
	"action" varchar(50) NOT NULL,
	"method" varchar(10),
	"path" text,
	"target_type" varchar(50),
	"target_id" varchar(100),
	"summary" text,
	"metadata" text,
	"ip_address" varchar(64),
	"user_agent" text,
	"status_code" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"device_fingerprint" varchar(64) NOT NULL,
	"user_agent" text,
	"browser_label" varchar(80),
	"os_label" varchar(80),
	"first_seen_ip" varchar(64),
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_ip" varchar(64),
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_city" varchar(120),
	"last_country" varchar(80),
	"alert_sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "admin_escalation_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar(80),
	"phone" varchar(30) NOT NULL,
	"email" varchar(200),
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"instance_id" varchar(80) PRIMARY KEY NOT NULL,
	"process_group" varchar(40) NOT NULL,
	"beat_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "p2p_ads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(4) NOT NULL,
	"asset" varchar(10) DEFAULT 'USDT' NOT NULL,
	"fiat_currency" varchar(5) DEFAULT 'INR' NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"quantity" numeric(18, 8) NOT NULL,
	"min_limit" numeric(18, 2) NOT NULL,
	"max_limit" numeric(18, 2) NOT NULL,
	"payment_methods" text DEFAULT '[]' NOT NULL,
	"terms" text,
	"time_limit" integer DEFAULT 15 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"filled_quantity" numeric(18, 8) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "p2p_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"attachment_data" text,
	"attachment_type" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "p2p_dispute_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispute_id" integer NOT NULL,
	"uploaded_by_user_id" integer NOT NULL,
	"uploader_role" varchar(10) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"file_data" text NOT NULL,
	"caption" varchar(280),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "p2p_disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"opened_by_user_id" integer NOT NULL,
	"opener_role" varchar(10) NOT NULL,
	"reason" varchar(60) NOT NULL,
	"description" text,
	"evidence_url" text,
	"status" varchar(25) DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"resolved_by_admin_id" integer,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "p2p_disputes_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "p2p_escrow_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"buyer_id" integer NOT NULL,
	"amount" numeric(18, 8) NOT NULL,
	"status" varchar(20) DEFAULT 'held' NOT NULL,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "p2p_escrow_transactions_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "p2p_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_id" integer NOT NULL,
	"buyer_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"fiat_amount" numeric(18, 2) NOT NULL,
	"usdt_amount" numeric(18, 8) NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"payment_method" varchar(30),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"payment_deadline" timestamp,
	"paid_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"payment_ref" text,
	"payment_proof_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "p2p_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "p2p_user_payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"upi_id" varchar(100),
	"bank_name" varchar(100),
	"account_holder" varchar(200),
	"account_number" varchar(50),
	"ifsc" varchar(20),
	"qr_code_data" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "p2p_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"available_balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"frozen_balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"escrow_balance" numeric(18, 8) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "p2p_wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversion_events" ADD CONSTRAINT "chat_conversion_events_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversion_events" ADD CONSTRAINT "chat_conversion_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_leads" ADD CONSTRAINT "chat_leads_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_settings" ADD CONSTRAINT "chat_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_permissions" ADD CONSTRAINT "admin_permissions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_permissions" ADD CONSTRAINT "admin_permissions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_chat_id_uidx" ON "users" USING btree ("telegram_chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_verified_uidx" ON "users" USING btree ("phone_number") WHERE phone_verified_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX "login_attempts_user_pending_idx" ON "login_attempts" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "login_attempts_poll_token_idx" ON "login_attempts" USING btree ("poll_token");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_user_type_idem_uq" ON "transactions" USING btree ("user_id","type","idempotency_key") WHERE "transactions"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_user_created_idx" ON "transactions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_created_idx" ON "ledger_entries" USING btree ("account_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "fraud_flags_user_id_idx" ON "fraud_flags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fraud_flags_type_idx" ON "fraud_flags" USING btree ("flag_type");--> statement-breakpoint
CREATE INDEX "fraud_flags_resolved_idx" ON "fraud_flags" USING btree ("is_resolved");--> statement-breakpoint
CREATE UNIQUE INDEX "fraud_flags_user_type_unresolved_uniq" ON "fraud_flags" USING btree ("user_id","flag_type") WHERE is_resolved = false;--> statement-breakpoint
CREATE INDEX "login_events_user_id_idx" ON "login_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_events_ip_idx" ON "login_events" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "login_events_fingerprint_idx" ON "login_events" USING btree ("device_fingerprint");--> statement-breakpoint
CREATE INDEX "chat_conv_events_session_idx" ON "chat_conversion_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_conv_events_type_idx" ON "chat_conversion_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "chat_leads_session_idx" ON "chat_leads" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_visitor_idx" ON "chat_sessions" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_user_active_idx" ON "chat_sessions" USING btree ("user_id","last_message_at");--> statement-breakpoint
CREATE INDEX "blockchain_deposits_user_created_idx" ON "blockchain_deposits" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "email_otps_user_id_idx" ON "email_otps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_otps_email_idx" ON "email_otps" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ip_signups_ip_idx" ON "ip_signups" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "points_txn_user_id_idx" ON "points_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "task_proofs_user_id_idx" ON "task_proofs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "task_proofs_task_id_idx" ON "task_proofs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_proofs_status_idx" ON "task_proofs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "utc_user_id_idx" ON "user_task_completions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "utc_task_id_idx" ON "user_task_completions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "utc_user_task_idx" ON "user_task_completions" USING btree ("user_id","task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "utc_user_task_period_uniq" ON "user_task_completions" USING btree ("user_id","task_id","period_key");--> statement-breakpoint
CREATE INDEX "signal_trade_audit_trade_idx" ON "signal_trade_audit" USING btree ("trade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signal_trade_dist_trade_user_unique" ON "signal_trade_distributions" USING btree ("trade_id","user_id");--> statement-breakpoint
CREATE INDEX "signal_trade_dist_user_idx" ON "signal_trade_distributions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "signal_trade_dist_user_created_idx" ON "signal_trade_distributions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "signal_trades_status_idx" ON "signal_trades" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pnl_history_user_date_unique" ON "pnl_history" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "scheduled_promos_active_window_idx" ON "scheduled_promos" USING btree ("is_active","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inr_deposits_utr_uq" ON "inr_deposits" USING btree ("utr");--> statement-breakpoint
CREATE INDEX "inr_deposits_user_idx" ON "inr_deposits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "inr_deposits_status_idx" ON "inr_deposits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inr_deposits_user_created_idx" ON "inr_deposits" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inr_withdrawals_user_idx" ON "inr_withdrawals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "inr_withdrawals_status_idx" ON "inr_withdrawals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inr_withdrawals_user_created_idx" ON "inr_withdrawals" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inr_withdrawals_assigned_merchant_idx" ON "inr_withdrawals" USING btree ("assigned_merchant_id") WHERE "inr_withdrawals"."assigned_merchant_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_email_uq" ON "merchants" USING btree ("email");--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_admin_id_idx" ON "admin_audit_log" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_module_idx" ON "admin_audit_log" USING btree ("module");--> statement-breakpoint
CREATE UNIQUE INDEX "user_devices_user_fp_uniq" ON "user_devices" USING btree ("user_id","device_fingerprint");--> statement-breakpoint
CREATE INDEX "user_devices_user_seen_idx" ON "user_devices" USING btree ("user_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "p2p_ads_user_idx" ON "p2p_ads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "p2p_ads_status_type_idx" ON "p2p_ads" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "p2p_chat_order_idx" ON "p2p_chat_messages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "p2p_dispute_evidence_dispute_idx" ON "p2p_dispute_evidence" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "p2p_disputes_status_idx" ON "p2p_disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "p2p_disputes_opened_by_idx" ON "p2p_disputes" USING btree ("opened_by_user_id");--> statement-breakpoint
CREATE INDEX "p2p_escrow_seller_idx" ON "p2p_escrow_transactions" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "p2p_orders_buyer_idx" ON "p2p_orders" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "p2p_orders_seller_idx" ON "p2p_orders" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "p2p_orders_ad_idx" ON "p2p_orders" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "p2p_orders_status_created_idx" ON "p2p_orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "p2p_orders_buyer_status_idx" ON "p2p_orders" USING btree ("buyer_id","status");--> statement-breakpoint
CREATE INDEX "p2p_orders_seller_status_idx" ON "p2p_orders" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "p2p_ratings_from_idx" ON "p2p_ratings" USING btree ("order_id","from_user_id");--> statement-breakpoint
CREATE INDEX "p2p_ratings_to_user_idx" ON "p2p_ratings" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "p2p_upm_user_idx" ON "p2p_user_payment_methods" USING btree ("user_id");