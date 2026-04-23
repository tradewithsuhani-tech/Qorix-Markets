--
-- PostgreSQL database dump
--

\restrict cDQLsyPc4wRnYLtpw1gv1TmajxagIbnj5ghFvecbyHm7JEhdh0I0E9F4yo4dixO

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: chat_session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chat_session_status AS ENUM (
    'active',
    'expert_requested',
    'resolved'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: blockchain_deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blockchain_deposits (
    id integer NOT NULL,
    user_id integer NOT NULL,
    tx_hash character varying(128) NOT NULL,
    from_address character varying(64) NOT NULL,
    to_address character varying(64) NOT NULL,
    amount numeric(18,6) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    credited boolean DEFAULT false NOT NULL,
    block_timestamp timestamp without time zone,
    credited_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    swept boolean DEFAULT false NOT NULL,
    sweep_tx_hash character varying(128),
    swept_at timestamp without time zone
);


--
-- Name: blockchain_deposits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.blockchain_deposits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: blockchain_deposits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.blockchain_deposits_id_seq OWNED BY public.blockchain_deposits.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    session_id integer NOT NULL,
    sender_type text NOT NULL,
    sender_id integer,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    status public.chat_session_status DEFAULT 'active'::public.chat_session_status NOT NULL,
    expert_requested boolean DEFAULT false NOT NULL,
    last_message_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_sessions_id_seq OWNED BY public.chat_sessions.id;


--
-- Name: daily_profit_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_profit_runs (
    id integer NOT NULL,
    run_date date NOT NULL,
    profit_percent numeric(10,4) NOT NULL,
    total_aum numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    total_profit_distributed numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    investors_affected integer DEFAULT 0 NOT NULL,
    referral_bonus_paid numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_profit_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_profit_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_profit_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_profit_runs_id_seq OWNED BY public.daily_profit_runs.id;


--
-- Name: deposit_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deposit_addresses (
    id integer NOT NULL,
    user_id integer NOT NULL,
    trc20_address character varying(64) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    private_key_enc character varying(512) DEFAULT ''::character varying NOT NULL
);


--
-- Name: deposit_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.deposit_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: deposit_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.deposit_addresses_id_seq OWNED BY public.deposit_addresses.id;


--
-- Name: email_otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_otps (
    id integer NOT NULL,
    user_id integer NOT NULL,
    email character varying(255) NOT NULL,
    otp character varying(8) NOT NULL,
    purpose character varying(30) DEFAULT 'verify_email'::character varying NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: email_otps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_otps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_otps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_otps_id_seq OWNED BY public.email_otps.id;


--
-- Name: equity_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equity_history (
    id integer NOT NULL,
    user_id integer NOT NULL,
    date date NOT NULL,
    equity numeric(18,8) NOT NULL,
    profit numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: equity_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equity_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equity_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equity_history_id_seq OWNED BY public.equity_history.id;


--
-- Name: fraud_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fraud_flags (
    id integer NOT NULL,
    user_id integer NOT NULL,
    flag_type character varying(50) NOT NULL,
    severity character varying(10) DEFAULT 'medium'::character varying NOT NULL,
    details text DEFAULT '{}'::text NOT NULL,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp without time zone,
    resolved_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: fraud_flags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fraud_flags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fraud_flags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fraud_flags_id_seq OWNED BY public.fraud_flags.id;


--
-- Name: gl_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gl_accounts (
    id integer NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    account_type character varying(50) NOT NULL,
    normal_balance character varying(10) DEFAULT 'debit'::character varying NOT NULL,
    user_id integer,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: gl_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gl_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gl_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gl_accounts_id_seq OWNED BY public.gl_accounts.id;


--
-- Name: investments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    amount numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    risk_level character varying(20) DEFAULT 'low'::character varying NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    is_paused boolean DEFAULT false NOT NULL,
    auto_compound boolean DEFAULT false NOT NULL,
    total_profit numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    daily_profit numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    drawdown numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    drawdown_limit numeric(5,2) DEFAULT 5.00 NOT NULL,
    peak_balance numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    started_at timestamp without time zone,
    stopped_at timestamp without time zone,
    paused_at timestamp without time zone
);


--
-- Name: investments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.investments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: investments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.investments_id_seq OWNED BY public.investments.id;


--
-- Name: ip_signups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_signups (
    id integer NOT NULL,
    ip_address character varying(64) NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ip_signups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ip_signups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ip_signups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ip_signups_id_seq OWNED BY public.ip_signups.id;


--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger_entries (
    id integer NOT NULL,
    journal_id character varying(100) NOT NULL,
    transaction_id integer,
    account_id integer NOT NULL,
    account_code character varying(100) NOT NULL,
    entry_type character varying(10) NOT NULL,
    amount numeric(18,8) NOT NULL,
    currency character varying(10) DEFAULT 'USDT'::character varying NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ledger_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ledger_entries_id_seq OWNED BY public.ledger_entries.id;


--
-- Name: login_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_events (
    id integer NOT NULL,
    user_id integer NOT NULL,
    ip_address character varying(64) NOT NULL,
    user_agent text,
    device_fingerprint character varying(64),
    event_type character varying(20) DEFAULT 'login'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: login_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.login_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: login_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.login_events_id_seq OWNED BY public.login_events.id;


--
-- Name: monthly_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_performance (
    id integer NOT NULL,
    user_id integer NOT NULL,
    year_month character varying(7) NOT NULL,
    monthly_return numeric(10,4) DEFAULT '0'::numeric NOT NULL,
    max_drawdown numeric(10,4) DEFAULT '0'::numeric NOT NULL,
    win_rate numeric(10,4) DEFAULT '0'::numeric NOT NULL,
    total_profit numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    trading_days integer DEFAULT 0 NOT NULL,
    winning_days integer DEFAULT 0 NOT NULL,
    start_equity numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    peak_equity numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: monthly_performance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.monthly_performance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: monthly_performance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.monthly_performance_id_seq OWNED BY public.monthly_performance.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(30) DEFAULT 'system'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: pnl_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pnl_history (
    id integer NOT NULL,
    user_id integer NOT NULL,
    date character varying(10) NOT NULL,
    percent numeric(6,4) DEFAULT '0'::numeric NOT NULL,
    amount numeric(18,2) DEFAULT '0'::numeric NOT NULL
);


--
-- Name: pnl_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pnl_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pnl_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pnl_history_id_seq OWNED BY public.pnl_history.id;


--
-- Name: points_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.points_transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    amount integer NOT NULL,
    type character varying(30) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    reference_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: points_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.points_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: points_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.points_transactions_id_seq OWNED BY public.points_transactions.id;


--
-- Name: promo_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_redemptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    code character varying(32) NOT NULL,
    status character varying(20) DEFAULT 'issued'::character varying NOT NULL,
    bonus_percent numeric(5,2) DEFAULT 5.00 NOT NULL,
    bonus_amount numeric(18,8),
    deposit_id integer,
    issued_at timestamp without time zone DEFAULT now() NOT NULL,
    redeemed_at timestamp without time zone,
    credited_at timestamp without time zone
);


--
-- Name: promo_redemptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_redemptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_redemptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_redemptions_id_seq OWNED BY public.promo_redemptions.id;


--
-- Name: report_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_verifications (
    id integer NOT NULL,
    hash_id character varying(64) NOT NULL,
    user_id integer NOT NULL,
    year_month character varying(7) NOT NULL,
    monthly_return numeric(10,4) NOT NULL,
    max_drawdown numeric(10,4) NOT NULL,
    win_rate numeric(10,4) NOT NULL,
    total_profit numeric(18,8) NOT NULL,
    trading_days integer NOT NULL,
    winning_days integer NOT NULL,
    start_equity numeric(18,8) NOT NULL,
    peak_equity numeric(18,8) NOT NULL,
    content_hash character varying(64) NOT NULL,
    generated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: report_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: report_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.report_verifications_id_seq OWNED BY public.report_verifications.id;


--
-- Name: signal_trade_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signal_trade_audit (
    id integer NOT NULL,
    trade_id integer NOT NULL,
    action character varying(30) NOT NULL,
    actor_user_id integer,
    details text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: signal_trade_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.signal_trade_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: signal_trade_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.signal_trade_audit_id_seq OWNED BY public.signal_trade_audit.id;


--
-- Name: signal_trade_distributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signal_trade_distributions (
    id integer NOT NULL,
    trade_id integer NOT NULL,
    user_id integer NOT NULL,
    share_basis numeric(18,8) NOT NULL,
    profit_amount numeric(18,8) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    swept_at timestamp without time zone
);


--
-- Name: signal_trade_distributions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.signal_trade_distributions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: signal_trade_distributions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.signal_trade_distributions_id_seq OWNED BY public.signal_trade_distributions.id;


--
-- Name: signal_trades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signal_trades (
    id integer NOT NULL,
    pair character varying(20) NOT NULL,
    direction character varying(4) NOT NULL,
    entry_price numeric(18,5) NOT NULL,
    pips_target numeric(12,2) NOT NULL,
    pip_size numeric(12,6) DEFAULT 0.0001 NOT NULL,
    exit_price numeric(18,5) NOT NULL,
    expected_profit_percent numeric(8,4) NOT NULL,
    realized_profit_percent numeric(8,4),
    realized_exit_price numeric(18,5),
    status character varying(20) DEFAULT 'running'::character varying NOT NULL,
    close_reason character varying(30),
    notes text,
    total_distributed numeric(18,8) DEFAULT '0'::numeric,
    affected_users integer DEFAULT 0,
    idempotency_key character varying(80) NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    closed_at timestamp without time zone,
    tp_price numeric(18,5),
    sl_price numeric(18,5),
    scheduled_at timestamp without time zone
);


--
-- Name: signal_trades_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.signal_trades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: signal_trades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.signal_trades_id_seq OWNED BY public.signal_trades.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: task_proofs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_proofs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    task_id integer NOT NULL,
    proof_type character varying(20) DEFAULT 'text'::character varying NOT NULL,
    proof_content text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_note text,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: task_proofs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_proofs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_proofs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.task_proofs_id_seq OWNED BY public.task_proofs.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    slug character varying(60) NOT NULL,
    title character varying(120) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    category character varying(20) DEFAULT 'daily'::character varying NOT NULL,
    point_reward integer DEFAULT 0 NOT NULL,
    requires_proof boolean DEFAULT false NOT NULL,
    requires_kyc boolean DEFAULT false NOT NULL,
    requires_deposit boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    icon_name character varying(40) DEFAULT 'Star'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: trades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trades (
    id integer NOT NULL,
    user_id integer NOT NULL,
    symbol character varying(20) NOT NULL,
    direction character varying(10) NOT NULL,
    entry_price numeric(18,8) NOT NULL,
    exit_price numeric(18,8) NOT NULL,
    profit numeric(18,8) NOT NULL,
    profit_percent numeric(10,4) NOT NULL,
    executed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: trades_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.trades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trades_id_seq OWNED BY public.trades.id;


--
-- Name: trading_desk_traders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trading_desk_traders (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    strategy_type character varying(20) NOT NULL,
    experience_years integer NOT NULL,
    win_rate_percent numeric(5,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    joined_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: trading_desk_traders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.trading_desk_traders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trading_desk_traders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trading_desk_traders_id_seq OWNED BY public.trading_desk_traders.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(50) NOT NULL,
    amount numeric(18,8) NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    description text,
    wallet_address character varying(255),
    tx_hash character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: user_task_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_task_completions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    task_id integer NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    points_awarded integer DEFAULT 0 NOT NULL,
    completed_at timestamp without time zone DEFAULT now() NOT NULL,
    period_key character varying(16) DEFAULT 'ALL'::character varying NOT NULL
);


--
-- Name: user_task_completions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_task_completions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_task_completions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_task_completions_id_seq OWNED BY public.user_task_completions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    full_name character varying(255) NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    admin_role character varying(30) DEFAULT 'user'::character varying NOT NULL,
    kyc_status character varying(30) DEFAULT 'not_submitted'::character varying NOT NULL,
    is_disabled boolean DEFAULT false NOT NULL,
    is_frozen boolean DEFAULT false NOT NULL,
    force_logout_after timestamp without time zone,
    referral_code character varying(20) NOT NULL,
    sponsor_id integer NOT NULL,
    tron_address character varying(64),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    kyc_document_url text,
    kyc_document_type character varying(30),
    kyc_submitted_at timestamp without time zone,
    kyc_reviewed_at timestamp without time zone,
    kyc_rejection_reason text,
    kyc_document_url_back text,
    kyc_personal_status character varying(30) DEFAULT 'not_submitted'::character varying NOT NULL,
    phone_number character varying(32),
    date_of_birth character varying(20),
    kyc_personal_submitted_at timestamp without time zone,
    kyc_address_status character varying(30) DEFAULT 'not_submitted'::character varying NOT NULL,
    address_line1 text,
    address_city character varying(100),
    address_state character varying(100),
    address_country character varying(100),
    address_postal_code character varying(20),
    kyc_address_doc_url text,
    kyc_address_submitted_at timestamp without time zone,
    kyc_address_reviewed_at timestamp without time zone,
    kyc_address_rejection_reason text
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: users_sponsor_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_sponsor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_sponsor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_sponsor_id_seq OWNED BY public.users.sponsor_id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    main_balance numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    trading_balance numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    profit_balance numeric(18,8) DEFAULT '0'::numeric NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    demo_equity_boost numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    demo_equity_last_at bigint DEFAULT 0 NOT NULL,
    daily_pnl_amount numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    daily_pnl_pct numeric(6,4) DEFAULT '0'::numeric NOT NULL,
    daily_pnl_day character varying(10) DEFAULT ''::character varying NOT NULL,
    daily_pnl_target_pct numeric(6,4) DEFAULT '0'::numeric NOT NULL,
    daily_pnl_chunks text DEFAULT '[]'::text NOT NULL,
    daily_pnl_increments_done integer DEFAULT 0 NOT NULL,
    trading_fund_boost numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    trading_fund_last_at bigint DEFAULT 0 NOT NULL,
    total_profit_boost numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    synth_win_rate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    synth_max_drawdown numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    synth_metrics_day character varying(10) DEFAULT ''::character varying NOT NULL,
    synth_avg_return numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    synth_risk_score character varying(10) DEFAULT 'Low'::character varying NOT NULL
);


--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallets_id_seq OWNED BY public.wallets.id;


--
-- Name: blockchain_deposits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blockchain_deposits ALTER COLUMN id SET DEFAULT nextval('public.blockchain_deposits_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: chat_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions ALTER COLUMN id SET DEFAULT nextval('public.chat_sessions_id_seq'::regclass);


--
-- Name: daily_profit_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_profit_runs ALTER COLUMN id SET DEFAULT nextval('public.daily_profit_runs_id_seq'::regclass);


--
-- Name: deposit_addresses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_addresses ALTER COLUMN id SET DEFAULT nextval('public.deposit_addresses_id_seq'::regclass);


--
-- Name: email_otps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_otps ALTER COLUMN id SET DEFAULT nextval('public.email_otps_id_seq'::regclass);


--
-- Name: equity_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equity_history ALTER COLUMN id SET DEFAULT nextval('public.equity_history_id_seq'::regclass);


--
-- Name: fraud_flags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_flags ALTER COLUMN id SET DEFAULT nextval('public.fraud_flags_id_seq'::regclass);


--
-- Name: gl_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gl_accounts ALTER COLUMN id SET DEFAULT nextval('public.gl_accounts_id_seq'::regclass);


--
-- Name: investments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments ALTER COLUMN id SET DEFAULT nextval('public.investments_id_seq'::regclass);


--
-- Name: ip_signups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_signups ALTER COLUMN id SET DEFAULT nextval('public.ip_signups_id_seq'::regclass);


--
-- Name: ledger_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries ALTER COLUMN id SET DEFAULT nextval('public.ledger_entries_id_seq'::regclass);


--
-- Name: login_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_events ALTER COLUMN id SET DEFAULT nextval('public.login_events_id_seq'::regclass);


--
-- Name: monthly_performance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_performance ALTER COLUMN id SET DEFAULT nextval('public.monthly_performance_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: pnl_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pnl_history ALTER COLUMN id SET DEFAULT nextval('public.pnl_history_id_seq'::regclass);


--
-- Name: points_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transactions ALTER COLUMN id SET DEFAULT nextval('public.points_transactions_id_seq'::regclass);


--
-- Name: promo_redemptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_redemptions ALTER COLUMN id SET DEFAULT nextval('public.promo_redemptions_id_seq'::regclass);


--
-- Name: report_verifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_verifications ALTER COLUMN id SET DEFAULT nextval('public.report_verifications_id_seq'::regclass);


--
-- Name: signal_trade_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signal_trade_audit ALTER COLUMN id SET DEFAULT nextval('public.signal_trade_audit_id_seq'::regclass);


--
-- Name: signal_trade_distributions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signal_trade_distributions ALTER COLUMN id SET DEFAULT nextval('public.signal_trade_distributions_id_seq'::regclass);


--
-- Name: signal_trades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signal_trades ALTER COLUMN id SET DEFAULT nextval('public.signal_trades_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: task_proofs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_proofs ALTER COLUMN id SET DEFAULT nextval('public.task_proofs_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: trades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trades ALTER COLUMN id SET DEFAULT nextval('public.trades_id_seq'::regclass);


--
-- Name: trading_desk_traders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_desk_traders ALTER COLUMN id SET DEFAULT nextval('public.trading_desk_traders_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: user_task_completions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_task_completions ALTER COLUMN id SET DEFAULT nextval('public.user_task_completions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: users sponsor_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN sponsor_id SET DEFAULT nextval('public.users_sponsor_id_seq'::regclass);


--
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


--
-- Data for Name: blockchain_deposits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.blockchain_deposits (id, user_id, tx_hash, from_address, to_address, amount, status, credited, block_timestamp, credited_at, created_at, swept, sweep_tx_hash, swept_at) FROM stdin;
1	0	ed6265411948ba1d2a2c430fb3c8d25caf8f37355574e0a6bf7b133d5fb8e78e	TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G	TWjfgDHy2VWqFAbFDD94vcyTR21yG74nNK	13.700000	unmatched	f	2026-04-22 09:20:09	\N	2026-04-22 10:19:30.545844	f	\N	\N
2	0	22a3902a0ccbe1a1a8198d9f3f39ea9e1123d20b8250e9966f1f14c7113d2695	TXo1FNiUpMRNkVs8PYSPyQjmbJmx7qkkW9	TWjfgDHy2VWqFAbFDD94vcyTR21yG74nNK	5.000000	unmatched	f	2026-04-22 10:23:03	\N	2026-04-22 10:23:19.246487	f	\N	\N
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_messages (id, session_id, sender_type, sender_id, content, created_at) FROM stdin;
\.


--
-- Data for Name: chat_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_sessions (id, user_id, status, expert_requested, last_message_at, created_at) FROM stdin;
\.


--
-- Data for Name: daily_profit_runs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_profit_runs (id, run_date, profit_percent, total_aum, total_profit_distributed, investors_affected, referral_bonus_paid, created_at) FROM stdin;
\.


--
-- Data for Name: deposit_addresses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deposit_addresses (id, user_id, trc20_address, created_at, private_key_enc) FROM stdin;
2	106	TNCQtYWna71JgqVD1dLCA48fjMLgAU87NW	2026-04-22 09:24:24.967258	v4vHu4R28PcrPvUsrL0KdPU7effRAYo1kd1pkUPVRDYRwVsLtjsr6blkNAvL1sLeCyqSanCRXYQWspx9oRLCS4cGu3PnNGb7RiYza+Gy/UbjhysBqch2WzfvqbI=
3	109	TTzAwsPm3Vs1LJZEy57iQ6oQM5Mpa2Hg2M	2026-04-23 17:34:46.24017	wwUIUOLp7mJY/ConF3EVwEVOVnQaw6DjV33WtxaFyr18ObvHAuXL+Q7jCzX8QY/Oy2Y3o/4ryuEhSjzLg19QMMbfiqTJOGwWbtvdqQuoD4Ya6tC+/Irqnv2jTZU=
\.


--
-- Data for Name: email_otps; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_otps (id, user_id, email, otp, purpose, is_used, expires_at, created_at) FROM stdin;
7	106	looxprem@gmail.com	474067	verify_email	t	2026-04-22 09:32:03.697	2026-04-22 09:22:03.708827
8	107	SAFEPAYU@GMAIL.COM	784050	verify_email	t	2026-04-23 08:53:55.988	2026-04-23 08:43:55.994931
9	107	SAFEPAYU@GMAIL.COM	419676	verify_email	f	2026-04-23 08:54:36.397	2026-04-23 08:44:36.40168
10	108	altradedevx@gmail.com	245897	verify_email	t	2026-04-23 08:55:07.129	2026-04-23 08:45:07.142032
11	109	safepayu@gmail.com	558031	verify_email	t	2026-04-23 16:17:49.207	2026-04-23 16:07:49.222024
\.


--
-- Data for Name: equity_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.equity_history (id, user_id, date, equity, profit, created_at) FROM stdin;
1643	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:09:46.447205
1644	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:09:57.304669
1645	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:10:01.837859
1646	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:10:17.351576
1647	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:10:22.648148
1648	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:10:23.820602
1649	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:10:25.107123
1650	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:10:27.267042
1651	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:10:34.71956
1652	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:10:50.031364
1653	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:10:53.057404
1654	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:11:06.771861
1655	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:11:22.882289
1656	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:11:23.415458
1657	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:11:41.287526
1658	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:11:53.810085
1659	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:11:56.627982
1660	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:12:11.996426
1661	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:12:24.135518
1662	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:12:27.362782
1663	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:12:42.755604
1664	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:12:54.451395
1665	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:12:58.113697
1666	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:13:13.451277
1667	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:13:25.395751
1668	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:13:28.77738
1669	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:13:44.096612
1670	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:13:55.740638
1671	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:14:00.276991
1672	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:14:15.715849
1673	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:14:30.368509
1674	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:14:31.024225
1675	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:14:46.352132
1676	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:15:00.697774
1677	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:15:01.661809
1678	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:15:17.668061
1679	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:15:31.035762
1680	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:15:33.002225
1681	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:15:48.370619
1682	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:16:01.45079
1683	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:16:03.752502
1684	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:16:19.056183
1685	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:16:33.103885
1686	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:16:34.489998
1687	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:16:49.803068
1688	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:17:03.413878
1689	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:17:05.143811
1690	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:17:20.485057
1691	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:17:34.436583
1692	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:17:35.778705
1693	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:17:51.128916
1694	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:18:04.732555
1695	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:18:06.426772
1696	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:18:21.739926
1697	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:18:35.029018
1698	106	2026-04-23	1077.00000000	1077.00000000	2026-04-23 11:18:37.836755
1699	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:18:53.164767
1700	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:19:05.375847
1701	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:19:08.515122
1702	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:19:23.845975
1703	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:19:36.497169
1704	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:19:39.853201
1705	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:19:55.166022
1706	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:20:07.369201
1707	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:20:10.468815
1708	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:20:25.821178
1709	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:20:38.284696
1710	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:20:41.121613
1711	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:20:56.696964
1712	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:21:08.608728
1713	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:21:12.017087
1714	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:21:21.716619
1715	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:21:22.938204
1716	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:21:37.032029
1717	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:21:40.744161
1718	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:21:41.207039
1719	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:21:48.649652
1720	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:21:49.311538
1721	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:21:57.893536
1722	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:22:00.746655
1723	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:22:04.322184
1724	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:22:04.45446
1725	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:22:19.751632
1726	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:22:35.083164
1727	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:22:50.446545
1728	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:23:05.751006
1729	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:23:15.967197
1730	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:23:21.18844
1731	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:23:36.63617
1732	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:23:40.354187
1733	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:23:40.712174
1734	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:23:40.993231
1735	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:23:47.067525
1736	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:23:47.0745
1737	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:23:47.333477
1738	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:24:06.028948
1739	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:24:17.366309
1740	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:24:21.450719
1741	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:24:37.0629
1742	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:24:47.714158
1743	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:24:52.733764
1744	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:25:08.031936
1745	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:25:18.129047
1746	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:25:23.417686
1747	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:25:38.79817
1748	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:25:48.816445
1749	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:25:54.161503
1750	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:26:10.21729
1751	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:26:19.142227
1752	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:26:19.319397
1753	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:26:25.558676
1754	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:26:31.828966
1755	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:26:40.928866
1756	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:26:56.831671
1757	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:27:03.381207
1758	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:27:12.202577
1759	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:27:27.519098
1760	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:27:33.717368
1761	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:27:42.837072
1762	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:27:58.229525
1763	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:28:04.124949
1764	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:28:13.567036
1765	106	2026-04-23	1298.00000000	1298.00000000	2026-04-23 11:28:47.373958
1766	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:28:47.698457
1767	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:28:50.418093
1768	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:29:04.048575
1769	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:29:04.741152
1770	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:29:19.462059
1771	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:29:35.05483
1772	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:29:35.423918
1773	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:29:51.343526
1774	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:30:05.416238
1775	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:30:06.66311
1776	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:30:21.980441
1777	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:30:35.793825
1778	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:30:38.4031
1779	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:30:45.008975
1780	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:30:45.049811
1781	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:30:45.089718
4283	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:19:45.322669
4284	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:19:50.659675
4285	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:19:55.989475
4296	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:23:16.79
4301	106	2026-04-23	12287.00000000	12287.00000000	2026-04-23 16:29:20.869871
4302	106	2026-04-23	12287.00000000	12287.00000000	2026-04-23 16:29:26.164297
4303	106	2026-04-23	12287.00000000	12287.00000000	2026-04-23 16:29:31.487931
4316	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:48.916437
4317	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:54.238829
4318	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:57.142237
4324	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:21.901264
4325	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:27.188165
4326	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:32.472914
4327	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:37.834928
4328	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:43.123783
4329	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:48.391903
4331	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:59.025717
4333	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:33:14.715488
4340	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:33:58.560614
4341	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:34:03.845999
4342	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:34:09.124395
4343	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:34:14.393473
4344	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:34:19.670135
4345	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:34:24.942616
4347	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:34:34.687597
4352	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:00.369436
4353	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:05.650234
4354	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:10.947238
4355	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:16.230578
4356	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:21.50081
4357	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:26.782698
4358	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:32.061501
4359	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:37.335568
4388	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:38:23.511716
4434	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:26.622679
4435	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:31.95076
4436	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:37.278865
4437	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:42.541871
4438	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:47.799725
4439	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:53.053299
4440	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:58.372545
4441	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:43:03.685749
4442	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:43:08.988943
4443	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:43:14.271207
4444	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:43:19.598275
4445	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:43:24.946591
4457	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:28.38364
4458	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:33.64363
4459	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:38.918562
4460	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:44.175853
4461	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:49.432294
4462	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:54.73257
4463	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:59.986305
4493	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:33.390884
4501	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:48:13.775363
4502	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:48:19.028801
4527	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:26.810386
4528	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:32.078781
4529	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:37.364411
4530	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:42.647916
4533	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:47.049826
4546	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:54.59343
4562	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:53:19.14402
4563	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:53:24.441252
4564	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:53:29.706115
4565	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:53:34.995418
4577	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:54:39.679059
4578	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:54:44.940199
4579	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:54:50.197488
4580	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:54:55.454824
4581	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:00.721268
4601	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:57:07.505693
4606	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:00:37.92583
4607	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:00:43.200526
4608	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:00:48.464236
4609	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:00:53.731866
4610	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:00:58.986334
4611	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:02.126743
4612	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:07.418819
4618	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:26.272626
4619	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:31.570411
4626	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:02:52.098465
4627	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:02:57.371454
4628	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:03:02.708028
4629	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:03:07.988043
4630	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:03:13.252146
4631	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:03:18.570516
4632	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:03:23.858553
4636	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:04:08.104397
4640	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:04:53.559343
4641	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:04:58.839942
4642	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:05:04.104519
4652	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:05:59.245049
4653	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:06:04.512482
4654	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:06:09.775001
4655	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:06:15.059766
4656	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:06:20.338861
4686	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:08.274516
4697	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:59.297204
4698	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:11:04.565239
4708	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:03.790027
4710	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:09.079483
4722	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:13:39.359445
4726	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:14:16.360177
4727	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:14:21.63395
4728	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:14:26.917306
4732	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:14:44.326234
4735	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:15:49.164852
4736	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:15:54.429895
4737	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:15:59.703483
4742	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:16:53.228907
4743	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:16:58.594641
4744	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:17:04.047502
4745	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:17:09.299095
4746	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:17:14.577982
4747	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:17:19.834844
4748	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:17:25.106622
4749	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:17:30.358216
4750	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:17:35.628817
4751	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:17:40.87575
4754	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:18:38.225715
4755	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:18:43.533015
4757	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:18:54.130842
4759	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:19:16.304212
4760	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:19:21.595658
4763	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:20:10.158928
4770	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:20:55.440618
4771	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:00.69394
4772	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:05.946532
4773	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:11.204235
4774	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:16.501002
4775	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:21.755298
1782	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:31:00.435354
1783	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:31:15.567286
1784	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:31:15.739988
1785	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:31:31.049133
1786	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:31:45.890404
1787	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:31:46.364412
1788	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:32:01.66537
1789	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:32:16.292017
1790	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:32:17.033162
1791	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:32:32.343871
1792	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:32:46.970639
1793	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:32:47.657135
1794	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:33:02.968411
1795	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:33:17.888789
1796	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:33:19.628721
1797	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:33:34.923826
1798	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:33:48.258781
1799	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:33:51.420331
1800	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:34:06.860819
1801	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:34:19.439432
1802	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:34:22.167955
1803	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:34:38.22458
1804	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:34:49.753995
1805	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:34:53.518953
1806	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:08.81791
1807	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:13.185412
1808	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:13.578639
1809	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:13.783627
1810	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:18.507108
1811	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:23.832937
1812	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:29.103037
1813	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:29.263488
1814	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:34.566593
1815	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:40.499349
1816	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:44.401925
1817	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:46.030586
1818	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:51.472294
1819	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:57.481316
1820	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:35:59.765145
1821	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:02.792935
1822	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:08.230869
1823	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:13.528755
1824	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:15.064739
1825	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:18.846461
1826	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:25.403594
1827	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:30.744441
1828	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:31.074185
1829	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:36.05183
1830	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:41.367242
1831	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:42.498894
1832	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:46.499182
1833	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:47.786528
1834	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:53.131241
1835	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:36:58.641592
1836	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:02.489391
1837	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:04.050476
1838	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:09.486966
1839	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:14.7902
1840	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:17.787532
1841	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:20.081455
1842	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:26.118221
1843	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:31.42217
1844	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:33.117214
1845	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:36.827917
1846	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:42.16358
1847	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:47.466376
1848	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:48.440408
1849	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:52.789111
1850	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:37:58.774307
1851	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:38:03.726812
1852	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:38:04.090622
1853	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:38:09.5181
1854	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:38:14.828388
1855	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:38:19.132132
1856	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:38:20.123037
1857	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:38:25.423187
1858	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:38:30.798457
1859	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:38:34.469655
1860	106	2026-04-23	1785.00000000	1785.00000000	2026-04-23 11:38:36.098345
1861	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:38:41.399396
1862	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:38:47.308339
1863	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:38:49.782406
1864	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:38:52.604098
1865	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:38:57.897252
1866	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:03.953975
1867	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:05.078535
1868	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:09.25713
1869	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:14.542614
1870	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:19.923429
1871	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:21.088908
1872	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:25.222313
1873	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:30.622649
1874	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:35.922044
1875	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:36.50127
1876	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:41.22327
1877	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:46.656863
1878	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:51.841719
1879	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:51.944531
1880	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:39:57.227298
1881	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:02.543389
1882	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:07.983527
1883	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:08.714315
1884	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:13.462556
1885	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:18.819091
1886	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:24.009723
1887	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:24.929705
1888	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:30.971706
1889	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:36.264824
1890	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:39.325925
1891	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:41.607688
1892	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:46.984197
1893	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:52.399869
1894	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:54.644998
1895	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:40:57.70017
1896	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:03.004001
1897	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:08.301706
1898	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:09.943957
1899	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:13.843685
1900	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:19.814061
1901	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:25.233371
1902	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:25.718105
1903	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:31.026765
1904	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:36.346577
1905	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:40.523373
1906	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:41.644476
1907	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:46.978198
1908	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:52.877764
1909	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:56.461898
1910	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:41:58.251607
1911	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:03.628194
1912	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:11.766624
1913	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:13.983056
1914	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:22.904676
1915	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:28.203665
1916	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:28.703571
1917	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:33.502645
1918	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:38.893429
1919	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:44.011072
1920	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:44.18923
1921	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:49.477173
1922	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:55.390091
1923	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:42:59.345485
1924	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:00.681056
1925	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:06.043231
1926	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:11.342336
1927	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:15.322028
1928	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:16.782426
1929	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:22.09898
1930	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:30.616961
1931	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:31.782089
1932	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:37.205686
1933	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:42.499449
1934	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:45.925895
1935	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:47.7802
1936	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:53.741217
1937	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:43:59.043699
1938	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:01.208799
1939	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:04.346645
1940	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:09.648473
1941	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:14.943991
1942	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:16.519789
1943	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:20.242986
1944	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:25.551223
1945	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:30.938661
1946	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:31.8225
1947	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:36.384795
1948	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:41.703042
1949	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:47.052038
1950	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:47.112644
1951	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:52.35096
1952	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:44:58.303934
1953	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:02.423913
1954	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:03.643479
1955	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:08.942902
1956	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:14.249126
1957	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:17.746789
1958	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:20.318134
1959	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:26.379636
1960	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:31.759517
1961	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:33.379471
1962	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:37.196927
1963	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:42.504277
1964	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:47.798012
1965	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:48.727707
1966	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:54.554991
1967	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:45:59.897748
1968	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:04.038359
1969	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:05.182063
1970	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:10.464818
1971	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:16.018962
1972	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:19.344252
1973	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:20.537592
1974	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:20.547605
1975	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:21.316883
1976	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:25.864707
1977	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:31.807588
1978	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:35.82667
1979	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:37.148294
1980	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:38.138686
1981	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:38.142337
1982	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:43.465567
1983	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:48.819882
1984	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:53.461001
1985	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:54.188783
1986	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:46:59.478091
1987	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:04.782707
1988	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:08.99987
1989	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:10.05923
1990	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:15.468248
1991	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:20.798603
1992	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:24.403504
1993	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:26.688328
1994	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:32.681418
1995	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:38.003894
1996	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:39.7244
1997	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:43.359214
1998	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:48.679144
1999	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:54.824528
2000	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:47:55.02379
2001	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:48:00.12317
2002	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:48:05.4045
2003	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:48:10.33995
2004	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:48:10.704052
2005	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:48:16.117493
2006	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:48:21.558044
2007	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:48:25.643438
2008	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:48:26.943079
2009	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:48:32.263087
2010	106	2026-04-23	2042.00000000	2042.00000000	2026-04-23 11:48:37.944047
2011	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:48:40.944167
2012	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:48:43.891689
2013	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:48:49.201377
2014	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:48:54.505853
2015	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:48:56.279266
2016	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:48:59.889111
2017	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:49:05.18471
2018	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:49:10.502556
2019	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:49:11.595133
2020	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:49:15.80452
2021	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:49:21.098228
2022	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:49:26.474904
2023	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:49:26.885536
2024	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:49:31.772591
2025	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:49:58.734946
2026	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:49:59.092221
2027	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:04.415056
2028	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:09.715741
2029	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:14.035097
2030	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:15.029381
2031	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:20.323931
2032	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:25.624127
2033	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:29.348868
2034	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:30.92401
2035	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:36.885148
2036	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:42.230539
2037	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:44.644381
2038	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:50:47.519022
2039	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:51:40.432796
2040	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:51:40.478585
2041	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:51:46.524566
2042	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:52:41.677743
2043	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:52:42.528569
2044	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:52:47.862522
2045	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:52:57.427019
2046	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:52:58.047756
2047	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:53:03.369746
2048	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:53:08.724892
2049	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:53:12.74917
2050	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:53:14.083204
2051	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:53:19.382838
2052	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:53:24.699563
2053	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:01.240575
2054	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:02.478686
4286	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:21:47.858631
4297	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:23:47.086237
4298	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:24:17.406042
4304	106	2026-04-23	12287.00000000	12287.00000000	2026-04-23 16:29:36.762663
4305	106	2026-04-23	12287.00000000	12287.00000000	2026-04-23 16:29:42.06156
4307	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:01.148596
4319	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:31:27.466942
4330	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:53.656377
4332	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:33:09.421007
4346	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:34:30.220684
4360	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:42.612335
4361	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:47.920197
4362	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:53.237106
4363	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:35:58.514873
4364	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:36:03.784312
4366	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:36:14.374319
4367	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:36:19.676486
4368	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:36:24.958168
4369	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:36:30.229469
4370	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:36:35.503205
4371	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:36:40.781274
4372	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:36:46.065762
4373	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:36:51.33697
4374	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:36:56.60541
4375	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:37:01.973165
4376	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:37:07.247487
4377	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:37:12.552381
4378	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:37:17.914435
4379	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:37:23.196918
4380	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:37:28.465976
4381	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:37:33.75054
4382	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:37:39.049264
4383	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:37:44.352847
4384	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:37:49.706584
4385	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:37:54.974993
4386	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:38:00.261249
4389	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:38:28.792673
4390	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:38:34.183674
4391	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:38:39.466752
4392	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:38:44.766355
4393	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:38:50.102779
4394	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:38:55.356146
4395	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:00.656342
4396	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:05.943924
4397	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:11.201958
4398	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:16.455685
4399	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:21.797548
4400	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:27.060272
4401	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:32.316516
4402	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:37.58547
4403	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:42.991446
4404	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:48.258486
4405	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:53.521858
4406	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:39:58.775874
4407	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:40:04.071291
4408	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:40:09.321768
4409	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:40:14.582676
4446	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:43:30.215138
4447	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:43:35.49024
4448	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:43:40.753646
4449	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:43:46.023701
4452	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:02.036947
4453	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:07.333614
4454	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:12.612481
4455	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:17.870571
4456	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:44:23.122779
4464	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:00.622837
4465	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:05.912312
4466	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:11.183488
4467	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:16.509367
4468	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:21.77314
4469	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:27.047298
4495	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:41.774946
4496	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:47.07732
4503	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:48:24.320792
4504	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:48:29.576619
4505	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:48:34.84055
4531	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:44.402414
4532	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:45.170333
4547	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:59.948209
4548	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:52:05.240918
4549	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:52:10.515502
4566	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:53:41.593896
4567	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:53:46.892915
4568	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:53:52.197189
4582	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:05.988706
4583	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:11.356586
4584	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:16.632337
4585	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:21.935302
4586	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:27.251414
4587	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:32.503924
4588	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:37.760424
4589	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:43.026933
4590	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:48.28783
4591	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:53.571516
4592	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:55:58.946372
4593	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:56:04.253607
4594	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:56:09.518563
4595	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:56:14.772615
4596	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:56:20.072928
4597	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:56:25.402409
4602	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 16:59:52.747512
4613	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:11.03344
4620	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:45.677935
4633	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:03:32.173575
4637	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:04:32.201301
4643	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:05:09.357356
4644	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:05:14.624294
4657	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:06:25.613161
4658	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:06:30.883024
4659	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:06:36.137491
4660	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:06:41.434417
4661	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:06:46.724798
4662	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:06:51.997397
4687	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:14.22778
4688	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:19.571166
4689	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:24.82254
4691	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:32.288281
4692	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:37.544609
4699	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:11:09.868605
4700	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:11:15.160123
4701	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:11:20.410928
4702	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:11:25.769852
4709	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:04.011954
4711	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:14.363191
4712	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:19.660275
4713	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:24.936456
4714	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:30.212946
4723	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:13:49.692287
4729	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:14:28.570928
4733	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:15:32.976708
4738	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:16:32.0542
4739	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:16:37.466148
4740	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:16:42.718418
2055	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:06.555141
2056	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:12.458972
2057	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:19.194971
2058	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:24.564356
2059	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:29.86115
2060	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:35.159454
2061	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:40.441238
2062	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:45.741512
2063	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:51.05642
2064	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:54:56.345451
2065	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:55:01.68044
2066	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:55:07.024067
2067	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:55:12.592887
2068	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:55:18.520032
2069	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:55:23.799035
2070	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:55:29.148288
2071	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:55:34.443605
2072	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:55:39.754185
2073	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:55:45.049586
2074	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:55:50.345039
2075	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:55:55.682823
2076	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:56:00.982678
2077	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:56:06.282501
2078	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:56:11.592056
2079	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:56:17.010987
2080	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:56:22.314611
2081	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:56:27.598409
2082	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:56:33.530042
2083	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:56:39.549556
2084	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:56:44.869793
2085	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:56:50.189269
2086	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:56:55.50775
2087	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:00.802913
2088	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:06.134325
2089	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:11.443613
2090	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:16.908762
2091	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:22.321819
2092	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:27.628213
2093	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:33.003097
2094	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:38.30392
2095	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:43.630337
2096	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:49.068658
2097	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:54.403959
2098	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:57:59.754057
2099	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:58:05.737594
2100	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:58:11.042932
2101	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:58:16.932896
2102	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:58:22.221648
2103	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:58:27.542771
2104	106	2026-04-23	2427.00000000	2427.00000000	2026-04-23 11:58:33.487703
2105	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:58:43.093649
2106	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:58:48.331065
2107	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:58:48.437556
2108	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:58:53.742817
2109	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:58:59.094843
2110	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:59:04.468245
2111	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:59:09.777169
2112	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:59:15.11273
2113	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:59:20.419786
2114	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:59:25.719576
2115	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:59:31.004139
2116	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:59:36.315368
2117	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:59:41.678784
2118	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:59:47.019126
2119	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:59:52.31847
2120	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 11:59:57.607212
2121	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:00:49.18214
2122	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:00:54.679528
2123	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:00.029139
2124	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:05.359185
2125	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:10.694385
2126	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:16.059519
2127	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:21.366726
2128	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:21.800125
2129	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:27.15319
2130	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:32.484437
2131	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:37.792902
2132	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:43.12122
2133	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:49.115873
2134	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:54.41357
2135	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:01:59.762728
2136	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:02:05.170643
2137	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:02:11.232835
2138	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:02:16.57479
2139	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:02:18.169724
2140	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:02:23.490385
2141	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:02:28.802347
2142	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:02:34.108551
2143	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:02:40.058313
2144	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:02:45.357767
2145	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:03:10.326633
2146	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:03:15.718981
2147	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:03:21.841249
2148	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:03:27.160103
2149	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:03:32.510564
2150	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:03:37.867895
2151	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:03:43.170855
2152	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:03:48.518187
2153	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:03:53.867243
2154	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:03:59.200771
2155	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:04:04.534115
2156	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:04:09.854196
2157	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:04:15.152867
2158	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:04:20.451092
2159	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:04:25.771023
2160	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:04:58.562064
2161	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:05:04.051167
2162	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:05:09.377532
2163	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:05:14.789152
2164	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:05:20.102467
2165	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:05:25.426028
2166	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:05:30.819983
2167	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:05:36.179135
2168	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:05:41.521616
2169	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:05:46.827524
2170	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:05:52.230079
2171	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:05:57.590459
2172	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:06:02.9044
2173	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:06:08.196361
2174	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:07:22.443795
2175	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:07:27.88663
2176	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:07:51.316979
2177	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:07:56.752279
2178	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:08:02.110805
2179	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:08:28.876907
2180	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:08:34.293538
2181	106	2026-04-23	2700.00000000	2700.00000000	2026-04-23 12:08:39.64506
2182	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:08:44.976506
2183	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:08:50.278447
2184	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:08:55.698862
2185	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:09:01.003898
2186	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:09:06.324639
2187	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:09:12.620853
2188	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:09:18.360529
2189	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:09:23.66298
2190	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:09:28.998367
2191	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:09:34.995551
2192	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:09:40.363983
2193	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:09:45.715867
2194	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:09:51.71003
2195	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:09:57.015707
2196	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:10:02.328917
2197	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:10:07.644047
2198	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:11:15.495653
2199	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:11:21.992848
2200	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:11:22.708287
2201	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:11:51.773368
2202	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:12:55.615957
2203	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:13:22.252276
2204	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:13:24.871556
2205	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:13:30.150747
2206	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:13:35.421081
2207	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:13:40.696298
2208	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:13:45.973329
2209	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:13:51.243659
2210	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:13:56.512457
2211	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:01.782938
2212	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:07.048547
2213	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:07.674407
2214	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:12.314113
2215	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:17.579722
2216	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:22.85324
2217	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:28.126868
2218	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:33.397898
2219	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:38.684568
2220	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:43.946554
2221	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:49.213819
2222	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:54.48264
2223	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:14:59.752714
2224	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:00.961539
2225	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:05.057437
2226	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:10.32898
2227	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:15.689109
2228	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:20.977899
2229	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:26.252051
2230	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:31.525545
2231	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:36.800812
2232	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:42.073903
2233	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:47.339871
2234	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:52.681972
2235	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:15:58.007342
2236	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:16:03.301943
2237	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:16:08.573818
2238	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:16:13.892202
2239	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:16:19.163822
2240	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:16:24.465425
2241	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:16:29.777025
2242	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:16:35.057024
2243	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:16:40.359708
2244	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:16:45.672082
2245	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:16:50.939874
2246	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:16:56.210085
2247	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:17:01.482997
2248	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:17:06.74494
2249	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:17:12.011464
2250	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:17:17.328466
2251	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:17:22.657752
2252	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:17:27.930387
2253	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:17:33.196689
2254	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:18:09.605584
2255	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:18:10.491956
2256	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:18:11.07055
2257	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:18:14.907193
2258	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:18:20.169636
2259	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:18:25.445267
2260	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:18:30.716863
2261	106	2026-04-23	3163.00000000	3163.00000000	2026-04-23 12:18:35.986504
2262	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:18:41.267114
2263	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:18:46.553226
2264	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:18:51.840719
2265	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:18:57.11911
2266	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:19:02.435363
2267	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:19:07.71061
2268	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:19:12.983716
2269	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:19:18.266521
2270	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:19:23.55223
2271	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:19:28.838401
2272	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:19:34.104473
2273	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:19:39.411876
2274	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:19:44.697446
2275	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:19:49.995583
2276	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:19:55.289125
2277	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:00.568354
2278	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:05.844591
2279	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:11.122105
2280	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:16.410151
2281	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:21.683096
2282	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:26.959968
2283	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:32.274747
2284	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:37.557834
2285	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:42.857268
2286	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:48.136324
2287	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:53.416311
2288	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:20:58.719173
2289	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:21:04.011508
2290	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:21:09.299138
2291	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:21:14.587076
2292	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:21:19.908194
2293	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:21:25.191677
2294	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:21:30.48087
2295	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:21:35.77295
2296	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:21:41.078967
2297	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:21:46.372858
2298	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:21:51.644557
2299	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:21:56.934017
2300	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:22:02.225487
2301	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:22:07.518534
2302	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:22:12.875979
2303	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:22:18.149617
2304	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:22:23.432581
2305	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:22:28.740194
2306	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:22:34.103303
2307	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:22:39.392631
2308	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:22:44.667488
2309	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:23:08.375497
2310	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:23:09.315778
2311	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:23:13.728902
2312	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:23:19.031124
2313	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:23:24.372323
2314	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:23:29.78575
2315	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:23:35.095712
2316	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:23:40.403247
2317	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:23:45.734638
2318	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:23:51.056703
2319	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:23:56.364521
2320	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:01.672006
2321	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:13.873979
2322	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:14.990466
2323	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:20.345131
2324	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:23.447626
2325	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:25.657443
2326	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:31.165481
2327	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:36.474995
2328	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:42.567552
2329	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:47.871083
2330	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:53.214781
2331	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:24:58.60653
2332	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:25:03.915956
2333	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:25:19.988792
2334	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:25:35.655497
2335	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:25:41.025177
2336	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:25:46.334402
2337	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:25:52.264527
2338	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:27:13.077798
2339	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:27:18.398003
2340	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:27:45.571959
2341	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:27:50.938888
2342	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:28:02.920574
2343	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:28:08.242068
2344	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:28:13.61663
2345	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:28:18.986172
2346	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:28:24.301668
2347	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:28:29.68575
2348	106	2026-04-23	3596.00000000	3596.00000000	2026-04-23 12:28:35.006109
2349	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:28:40.314609
2350	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:28:45.615924
2351	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:28:50.956637
2352	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:30:11.228942
2353	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:30:16.581278
2354	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:30:35.996462
2355	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:30:41.299478
2356	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:30:46.614857
2357	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:30:51.965404
2358	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:30:57.882738
2359	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:31:03.199136
2360	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:31:04.366525
2361	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:31:09.276384
2362	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:31:16.302089
2363	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:31:22.855536
2364	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:31:58.792431
2365	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:32:04.160999
2366	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:32:07.338958
2367	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:32:09.525857
2368	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:32:13.411042
2369	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:32:18.716721
2370	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:32:24.148005
2371	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:32:29.471153
2372	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:32:34.785001
2373	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:32:55.825151
2374	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:33:10.044952
2375	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:33:23.981597
2376	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:33:52.284272
2377	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:33:58.249268
2378	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:03.760052
2379	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:09.114947
2380	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:16.017751
2381	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:21.546892
2382	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:26.880898
2383	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:32.269206
2384	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:37.70409
2385	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:39.542249
2386	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:43.021368
2387	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:48.349614
2388	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:54.25812
2389	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:34:59.575161
2390	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:35:04.682562
2391	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:35:17.562005
2392	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:35:20.854684
2393	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:35:28.428785
2394	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:35:33.76605
2395	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:35:36.721925
2396	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:35:52.114678
2397	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:35:52.865455
2398	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:35:58.26604
2399	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:03.587138
2400	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:08.884924
2401	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:14.174523
2402	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:19.508451
2403	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:23.33473
2404	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:23.354833
2405	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:24.898719
2406	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:28.735578
2407	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:34.060614
2408	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:39.49733
2409	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:44.851247
2410	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:36:48.453752
2411	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:03.77447
2412	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:08.374823
2413	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:13.668662
2414	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:19.044055
2415	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:24.354876
2416	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:29.660439
2417	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:35.130625
2418	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:40.455155
2419	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:43.325643
2420	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:43.332837
2421	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:45.750054
2422	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:50.327694
2423	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:50.351561
2424	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:51.113668
2425	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:54.331094
2426	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:55.344287
2427	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:37:56.456244
2428	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:38:01.862842
2429	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:38:04.605457
2430	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:38:09.928037
2431	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:38:10.950418
2432	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:38:16.337186
2433	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:38:21.658023
2434	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:38:26.970868
2435	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:38:32.30693
2436	106	2026-04-23	3863.00000000	3863.00000000	2026-04-23 12:38:37.174603
2437	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:38:52.476458
2438	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:39:04.164905
2439	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:39:09.481119
2440	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:39:14.823855
2441	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:39:18.550688
2442	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:39:33.868008
2443	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:39:49.218418
2444	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:40:04.621384
2445	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:40:19.677106
2446	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:40:20.289997
2447	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:40:20.851565
2448	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:40:30.231345
2449	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:40:35.004665
2450	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:40:50.358335
2451	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:41:05.699223
2452	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:41:21.098224
2453	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:41:36.430801
2454	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:41:51.90502
2455	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:42:07.204865
2456	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:42:22.53851
2457	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:42:37.875713
2458	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:42:53.203802
2459	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:43:08.514941
2460	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:43:23.804983
2461	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:43:39.095996
2462	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:43:54.449392
2463	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:44:09.756075
2464	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:44:25.064526
2465	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:44:40.453559
2466	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:44:47.291379
2467	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:44:52.594621
2468	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:44:57.911965
2469	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:03.444453
2470	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:08.787994
2471	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:14.077412
2472	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:19.344674
2473	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:19.387881
2474	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:22.297916
2475	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:24.705436
2476	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:26.384589
2477	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:31.758738
2478	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:37.089732
2479	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:42.439603
2480	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:47.73849
2481	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:53.066226
2482	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:45:58.468379
2483	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:03.788561
2484	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:09.195422
2485	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:14.501116
2486	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:19.957667
2487	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:25.243808
2488	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:30.622517
2489	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:35.984711
2490	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:41.32785
2491	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:46.627938
2492	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:48.25399
2493	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:49.331204
2494	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:49.36909
2495	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:46:54.661098
2496	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:00.000929
2497	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:05.336639
2498	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:08.300202
2499	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:09.845494
2500	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:10.297157
2501	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:15.141856
2502	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:20.47597
2503	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:25.80101
2504	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:31.095434
2505	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:36.390039
2506	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:41.755129
2507	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:47.052505
2508	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:52.486236
2509	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:47:57.871845
2510	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:48:03.160388
2511	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:48:08.4812
2512	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:48:13.799705
2513	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:48:19.170333
2514	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:48:24.455514
2515	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:48:30.027592
2521	106	2026-04-23	4208.00000000	4208.00000000	2026-04-23 12:48:54.827772
2522	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:00.134421
2523	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:05.445305
2524	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:10.742952
2525	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:16.059031
2526	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:21.426038
2527	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:26.742124
2528	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:32.064935
2529	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:37.404925
2530	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:42.809933
2531	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:48.732003
2532	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:54.203979
2533	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:49:59.502721
2534	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:50:04.820563
2535	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:50:10.118
2536	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:50:15.410315
2537	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:50:20.794839
2538	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:50:26.142913
2554	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:55:38.344875
2555	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:55:43.105193
2556	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:55:47.873531
2557	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:55:48.487912
2558	106	2026-04-23	4430.00000000	4430.00000000	2026-04-23 12:59:58.965705
2559	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:00:04.332291
2560	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:00:09.647354
2561	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:00:14.943012
2562	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:00:30.422313
2563	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:00:31.50784
2564	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:00:36.925308
2565	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:00:42.298018
2566	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:00:47.601587
2567	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:00:52.921079
2568	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:00:58.259521
2569	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:03.811111
2570	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:09.180683
2571	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:14.505763
2572	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:19.806279
2573	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:25.12168
2574	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:30.410685
2575	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:35.68873
2576	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:41.05319
2577	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:44.683104
2578	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:45.247316
2579	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:50.007845
2580	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:01:55.320738
2581	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:00.611327
2582	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:05.926318
2583	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:11.242915
2584	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:16.53946
2585	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:21.869716
2586	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:27.219479
2587	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:32.530183
2588	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:37.83078
2589	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:43.146196
2590	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:48.54918
2591	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:54.036076
2592	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:02:59.345326
2593	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:03:04.755793
2594	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:03:10.073196
2595	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:03:15.445562
2596	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:03:20.835738
2597	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:03:26.132146
2598	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:03:31.511233
2599	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:03:36.8364
2600	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:03:42.271469
2601	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:03:47.598014
2602	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:03:52.886005
2603	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:03:58.203715
2604	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:04:00.406653
2605	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:04:01.220335
2606	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:04:05.737013
2607	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:04:11.059071
2608	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:04:16.417931
2609	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:04:21.74401
2610	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:04:27.627256
2611	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:05:06.903017
2612	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:05:12.305289
2613	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:05:17.601247
2614	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:05:22.835978
2615	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:05:28.141797
2616	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:05:35.484751
2617	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:05:40.851118
2618	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:05:44.332143
2619	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:05:48.843521
2620	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:05:54.171769
2621	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:06:16.114213
2622	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:06:21.475922
2623	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:06:26.783638
2624	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:06:32.09446
2625	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:06:37.400166
2647	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:07:27.19609
2648	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:07:39.556907
2649	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:07:41.752084
2650	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:07:48.996733
2651	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:07:50.321627
2652	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:07:54.299237
2653	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:07:59.654158
2654	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:08:04.93481
2655	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:08:10.237286
2656	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:08:15.538652
2657	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:08:20.843541
2658	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:08:26.144343
2659	106	2026-04-23	4873.00000000	4873.00000000	2026-04-23 13:08:31.439979
2660	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:08:36.757756
2661	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:08:48.292534
2662	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:08:53.606258
2663	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:08:59.022921
2664	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:11:19.62386
2665	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:11:24.95723
2666	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:11:30.248204
2667	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:11:35.55045
2668	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:11:40.847847
2669	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:11:46.127654
2670	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:11:51.419351
2671	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:11:56.760211
2672	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:12:02.054852
2673	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:12:07.336554
2674	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:12:12.624948
2675	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:12:18.147531
2676	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:12:23.455341
2677	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:12:28.856591
2678	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:12:34.201867
2679	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:12:39.536925
2680	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:12:44.835502
2681	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:12:50.141195
2682	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:12:55.442643
2683	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:13:00.906913
2684	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:13:06.218057
2685	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:13:11.517996
2686	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:13:16.977669
2687	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:13:22.27169
2688	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:13:36.3881
2689	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:13:39.892282
2690	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:13:45.409238
2691	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:13:50.700693
2692	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:13:56.244249
2693	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:14:01.581002
2694	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:14:06.983653
2695	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:14:12.393403
2696	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:14:17.74863
2697	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:14:23.031694
2698	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:14:29.312832
2699	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:14:34.712177
2700	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:15:07.145886
2701	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:15:12.558532
2702	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:15:17.892553
2703	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:15:23.204136
2704	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:15:28.498197
2705	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:15:33.822407
2706	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:15:39.119749
2707	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:15:44.457718
2708	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:15:49.826414
2709	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:16:02.605522
2710	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:16:02.896364
2711	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:16:26.14065
2712	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:16:31.597632
2713	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:16:36.915781
2714	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:16:42.218125
2715	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:16:47.610511
2716	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:16:52.898113
2717	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:16:58.203224
2718	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:17:03.50333
2719	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:17:12.846557
2720	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:17:18.153296
2721	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:17:23.482019
2722	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:17:28.875347
2723	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:17:34.230765
2724	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:17:39.554028
2725	106	2026-04-23	5365.00000000	5365.00000000	2026-04-23 13:17:44.968221
2752	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:18:45.377625
2753	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:18:50.733137
2754	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:18:56.051639
2755	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:19:01.335989
2756	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:19:06.633233
2757	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:19:11.923063
2758	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:19:17.270493
2759	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:19:44.719416
2760	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:19:50.017357
2761	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:19:55.311639
2762	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:00.648401
2763	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:05.969619
2764	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:11.427003
2765	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:16.79714
2766	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:18.672351
2767	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:23.97663
2768	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:29.338708
2769	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:34.728582
2770	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:40.071025
2771	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:45.505203
2772	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:50.782988
2773	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:20:56.105317
2774	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:21:01.413817
2775	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:21:06.777878
2776	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:21:12.211829
2777	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:21:18.015578
2778	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:21:23.311111
2779	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:21:28.612659
2780	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:21:34.22789
2781	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:21:39.755464
2782	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:21:45.057688
2785	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:22:31.336558
2786	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:22:36.642469
2787	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:22:41.943298
2788	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:22:47.275821
2789	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:22:52.59025
2818	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:27:51.966467
2819	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:27:53.561746
2820	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:27:58.855498
2821	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:28:04.151689
2822	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:28:09.602872
2823	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:28:14.926543
2824	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:28:20.236471
2825	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:28:25.577856
2826	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:28:30.905467
2827	106	2026-04-23	5472.00000000	5472.00000000	2026-04-23 13:28:36.209257
2828	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:29:06.225143
2829	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:29:20.457214
2830	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:29:36.518294
2831	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:29:45.259027
2832	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:30:30.504373
2833	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:30:35.822286
2834	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:30:41.170777
2835	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:30:46.640579
2836	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:30:51.936412
2837	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:30:57.264129
2838	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:31:02.582679
2839	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:31:07.865703
2840	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:31:13.201613
2841	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:31:18.484844
2842	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:31:23.776343
2843	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:31:29.114988
2844	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:31:34.397492
2845	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:31:40.291806
2846	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:31:50.555914
2847	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:31:55.836887
2848	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:32:01.130636
2849	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:32:06.433812
2850	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:32:11.752893
2851	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:32:17.198747
2852	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:32:22.522045
2853	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:32:27.874479
2854	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:32:33.275876
2855	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:32:38.57385
2856	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:32:43.878345
2857	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:35:13.314728
2858	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:35:18.695442
2859	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:35:23.985218
2860	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:35:29.305708
2861	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:37:32.621228
2862	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:37:37.980776
2863	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:37:43.354502
2864	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:38:22.237497
2865	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:38:27.597073
2866	106	2026-04-23	5863.00000000	5863.00000000	2026-04-23 13:38:32.926361
2867	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:38:38.211382
2868	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:38:43.549541
2869	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:38:48.854339
2870	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:38:54.142625
2871	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:38:59.475938
2872	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:39:04.806926
2873	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:39:10.324867
2874	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:39:15.663683
2875	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:39:20.966555
2876	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:39:26.300648
2877	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:39:31.585193
2878	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:39:36.912116
2879	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:39:42.339969
2880	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:39:47.716468
2881	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:39:53.031833
2882	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:39:58.343624
2883	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:40:03.635413
2884	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:40:08.917288
2885	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:40:14.212673
2886	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:40:19.502755
2887	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:40:24.805101
2888	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:40:30.102854
2889	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:40:35.387422
2890	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:40:40.6964
2891	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:40:46.00461
2892	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:40:51.318262
2893	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:40:56.598587
2894	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:41:02.02396
2895	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:41:07.342403
2896	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:41:12.625141
2897	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:41:17.948485
2898	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:41:23.286155
2899	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:41:28.604528
2900	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:41:33.925022
2901	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:41:39.308144
2902	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:41:44.68767
2903	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:41:50.017229
2904	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:41:55.340913
2905	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:00.64243
2906	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:05.938106
2907	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:11.394732
2908	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:16.719747
2909	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:22.097254
2910	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:27.499955
2911	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:32.816398
2912	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:38.117718
2913	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:43.439025
2914	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:48.744833
2915	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:54.067382
2916	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:42:59.393216
2917	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:43:04.714398
2918	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:43:10.020389
2919	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:43:15.448531
2920	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:43:20.737209
2921	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:43:26.058698
2922	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:43:31.379922
2923	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:43:36.836317
2924	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:43:42.142125
2925	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:43:48.497824
2926	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:43:53.809752
2927	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:44:19.089872
2928	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:44:30.25777
2929	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:44:33.229001
2930	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:45:07.218829
2931	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:45:12.524474
2932	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:45:17.83458
2933	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:45:23.122841
2934	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:45:28.453382
2935	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:45:33.757924
2936	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:45:39.07917
2937	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:45:44.418297
2938	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:45:49.747906
2939	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:45:55.063336
2940	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:46:00.82022
2941	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:46:11.491308
2942	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:46:16.79799
2943	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:46:22.199853
2944	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:46:27.50987
2945	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:46:32.811586
2946	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:46:38.103128
2947	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:46:43.389877
2948	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:46:48.839963
2949	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:46:54.243324
2950	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:46:59.689706
2951	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:47:04.994023
2952	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:47:10.309083
2953	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:47:15.594664
2954	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:47:20.898257
2955	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:47:26.236244
2956	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:47:31.791633
2957	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:47:37.117007
2958	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:47:42.436724
2959	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:47:47.724151
2960	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:47:53.070061
2961	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:47:58.375129
2962	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:48:03.65722
2963	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:48:08.964822
2964	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:48:14.265035
2965	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:48:19.554093
2966	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:48:24.851444
2967	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:48:30.159403
2968	106	2026-04-23	6120.00000000	6120.00000000	2026-04-23 13:48:35.481781
2969	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:48:40.753068
2970	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:48:46.052211
2971	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:48:51.480447
2972	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:48:56.840973
2973	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:49:02.291958
2974	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:49:07.583891
2975	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:49:12.880717
2976	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:49:18.17122
2977	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:49:23.573444
2978	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:49:29.037283
2979	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:49:34.456337
2980	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:49:39.913671
2981	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:49:45.236743
2982	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:49:50.531685
2983	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:49:55.824935
2984	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:01.136669
2985	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:06.455799
2986	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:11.773027
2987	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:17.13193
2988	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:22.551101
2989	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:27.834585
2990	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:33.246499
2991	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:38.556217
2992	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:43.970915
2993	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:49.27936
2994	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:54.604106
2995	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:50:59.976048
2996	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:05.280893
2997	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:07.425298
2998	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:07.662375
2999	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:12.723641
3000	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:14.269651
3001	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:18.007341
3002	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:22.723552
3003	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:28.060061
3004	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:33.436448
3005	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:38.77925
3006	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:44.089655
3007	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:49.502667
3008	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:51:54.852029
3009	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:52:00.178687
3010	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:52:05.59713
3011	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:52:10.897008
3012	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:52:20.964034
3013	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:52:26.269567
3014	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:52:31.578411
3015	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:52:36.866607
3016	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:52:42.234768
3017	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:52:47.592297
3018	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:52:52.895317
3019	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:52:58.193307
3020	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:53:03.499739
3021	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:53:08.862277
3022	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:53:14.171777
3023	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:53:19.480775
3024	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:53:24.797608
3025	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:53:30.092939
3026	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:53:35.387398
3027	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:53:40.706207
3028	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:53:46.022833
3029	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:53:51.31544
3030	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:53:56.691821
3031	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:00.528391
3032	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:01.989248
3033	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:05.877222
3034	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:08.628522
3035	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:14.037007
3036	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:19.362568
3037	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:24.751351
3038	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:30.092679
3039	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:35.606879
3040	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:41.033618
3041	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:46.379674
3042	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:51.737491
3043	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:54:57.050464
3044	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:02.371828
3045	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:07.667863
3046	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:12.980726
3047	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:18.423455
3048	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:23.926691
3049	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:29.217233
3050	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:34.526034
3051	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:39.816866
3052	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:45.106582
3053	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:48.65075
3054	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:48.946615
3055	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:54.24161
3056	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:55:59.671069
3057	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:56:05.024191
3058	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:56:10.38366
3059	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:56:15.704833
3060	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:56:21.22998
3061	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:56:26.673746
3062	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:56:31.985456
3063	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:56:37.431352
3064	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:56:42.710818
3065	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:56:48.012906
3066	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:56:53.311018
3067	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:56:58.620672
3068	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:57:03.977119
3069	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:57:09.336686
3070	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:57:14.657386
3071	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:57:20.021472
3072	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:57:25.338942
3073	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:57:30.640274
3074	106	2026-04-23	6611.00000000	6611.00000000	2026-04-23 13:57:35.967024
3075	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 13:59:37.676753
3076	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 13:59:42.970702
3077	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 13:59:48.314737
3078	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 13:59:53.761802
3079	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 13:59:59.067491
3080	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:04.447482
3081	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:05.208065
3082	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:06.714827
3083	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:12.036738
3084	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:17.504004
3085	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:23.120855
3086	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:28.456158
3087	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:33.761981
3088	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:39.101437
3089	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:44.423116
3090	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:49.785919
3091	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:00:55.122763
3092	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:01:00.550876
3093	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:01:05.909674
3094	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:01:11.357909
3095	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:01:16.671349
3096	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:01:21.986682
3097	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:01:27.278
3098	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:01:32.591346
3099	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:01:37.906286
3100	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:01:51.139623
3101	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:01:56.446176
3102	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:02:01.761102
3103	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:02:07.2634
3104	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:02:12.574403
3105	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:02:17.883913
3106	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:02:23.280279
3107	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:02:28.624317
3108	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:02:34.000561
3109	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:02:39.5031
3110	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:02:44.836757
3111	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:02:50.154364
3112	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:02:55.519965
3113	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:00.803494
3114	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:06.121314
3115	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:11.45106
3116	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:16.771693
3117	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:22.077344
3118	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:27.406217
3119	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:32.738704
3120	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:38.069511
3121	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:43.359871
3122	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:48.666768
3123	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:54.122418
3124	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:03:59.535159
3125	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:04:04.846207
3126	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:04:10.190026
3127	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:04:15.651869
3128	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:04:20.958727
3129	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:04:26.258065
3130	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:04:31.596533
3131	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:04:39.809222
3132	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:04:45.131536
3133	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:04:50.437108
3134	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:04:55.756543
3135	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:05:01.060903
3136	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:05:06.381313
3137	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:05:11.673791
3138	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:05:17.270393
3139	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:05:22.59072
3140	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:05:27.946141
3141	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:05:33.326508
3142	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:05:38.877121
3143	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:05:44.193392
3144	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:05:49.500218
3145	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:05:54.851232
3146	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:00.190009
3147	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:05.481714
3148	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:10.792846
3149	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:16.101409
3150	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:21.432602
3151	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:26.754828
3152	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:32.146616
3153	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:37.458784
3154	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:42.960404
3155	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:48.265494
3156	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:53.617599
3157	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:06:56.978826
3158	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:07:02.344956
3159	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:07:07.672117
3160	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:07:12.975365
3161	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:07:18.263598
3162	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:07:23.56063
3163	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:07:28.85312
3164	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:07:34.185781
3165	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:07:39.605092
3166	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:07:44.935494
3167	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:07:50.253351
3168	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:07:55.834984
3169	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:08:01.180386
3170	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:08:06.534371
3171	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:08:11.876576
3172	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:08:17.215296
3173	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:08:22.541709
3174	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:08:27.875471
3175	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:08:33.295638
3176	106	2026-04-23	7070.00000000	7070.00000000	2026-04-23 14:08:38.630855
3177	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:08:43.989357
3178	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:08:49.383944
3179	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:08:54.834055
3180	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:00.156974
3181	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:05.474459
3182	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:11.082241
3183	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:16.428368
3184	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:21.743827
3185	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:27.218423
3186	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:32.589814
3187	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:37.925554
3188	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:43.249258
3189	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:48.54973
3190	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:53.946505
3191	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:09:59.277416
3192	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:10:12.50807
3193	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:10:17.925624
3194	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:10:23.246738
3195	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:10:28.576953
3196	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:10:33.883347
3197	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:10:39.178979
3198	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:10:44.461545
3199	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:10:49.789882
3200	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:10:55.099357
3201	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:11:00.402715
3202	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:11:05.719669
3203	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:11:11.017381
3204	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:11:16.571643
3205	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:11:21.884943
3206	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:11:27.292824
3207	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:11:32.639128
3208	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:11:38.033589
3209	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:11:43.441056
3210	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:11:52.612563
3211	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:11:57.933674
3212	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:12:03.264694
3213	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:12:08.59177
3214	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:12:13.920288
3215	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:12:19.459652
3216	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:12:24.821558
3217	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:12:30.14174
3218	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:12:35.444012
3219	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:12:40.834357
3220	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:12:46.175235
3221	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:12:51.484598
3222	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:12:56.799581
3223	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:13:02.261746
3224	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:13:07.565636
3225	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:13:12.890331
3226	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:13:18.229577
3227	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:13:23.538259
3228	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:13:28.84843
3229	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:13:34.140908
3230	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:13:39.452216
3231	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:13:44.818735
3232	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:13:50.140034
3233	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:13:55.464159
3234	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:14:22.984654
3235	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:14:28.319068
3236	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:14:33.619704
3237	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:14:38.918736
3238	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:14:44.226053
3239	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:14:49.605776
3240	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:14:55.113578
3241	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:00.490901
3242	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:05.801216
3243	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:11.158872
3244	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:16.454667
3245	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:21.749929
3246	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:27.17627
3247	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:32.470312
3248	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:37.763312
3249	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:43.042139
3250	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:48.355947
3251	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:53.657305
3252	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:15:58.962016
3253	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:16:04.263325
3254	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:16:09.543596
3255	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:16:14.850848
3256	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:16:20.255876
3257	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:16:25.765577
3258	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:16:31.106555
3259	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:16:36.430173
3260	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:16:41.760545
3261	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:16:47.067091
3262	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:16:52.366654
3263	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:16:57.655841
3264	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:17:02.960317
3265	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:17:08.319965
3266	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:17:13.620984
3267	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:17:18.905953
3268	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:17:24.230564
3269	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:17:29.576269
3270	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:17:34.891424
3271	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:17:40.336869
3272	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:17:45.675591
3273	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:17:51.00888
3274	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:17:56.313544
3275	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:18:01.599907
3276	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:18:06.890136
3277	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:18:12.200308
3278	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:18:17.505739
3279	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:18:22.877288
3280	106	2026-04-23	7457.00000000	7457.00000000	2026-04-23 14:18:27.294854
3281	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:18:42.629452
3282	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:18:57.973406
3283	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:18:59.039596
3284	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:19:04.343707
3285	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:19:09.654086
3286	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:19:14.965874
3287	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:19:20.261755
3288	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:19:25.590946
3289	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:19:30.926404
3290	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:19:36.236241
3291	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:19:41.585911
3292	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:19:46.886144
3293	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:19:52.382811
3294	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:19:57.697069
3295	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:20:02.984333
3296	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:20:08.306601
3297	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:20:13.594976
3298	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:20:18.88565
3299	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:20:24.278897
3300	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:20:29.605137
3301	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:20:35.025143
3302	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:20:40.40882
3303	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:20:45.735954
3304	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:23:40.1329
3305	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:23:45.461601
3306	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:23:45.858399
3307	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:23:50.774026
3308	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:23:53.097634
3309	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:24:08.413693
3310	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:24:13.767229
3311	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:24:29.100405
3312	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:24:44.433564
3313	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:24:52.245148
3314	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:25:07.547359
3315	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:25:22.934162
3316	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:25:38.245746
3317	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:25:53.54279
3318	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:26:08.90461
3319	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:26:24.274343
3320	106	2026-04-23	7787.00000000	7787.00000000	2026-04-23 14:29:12.425777
3321	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:29:27.754689
3322	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:29:43.296454
3323	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:29:58.599103
3324	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:30:13.911358
3325	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:30:29.259131
3326	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:30:54.457691
3327	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:31:09.788695
3328	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:31:33.795796
3329	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:31:49.115388
3330	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:32:04.442572
3331	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:32:14.770034
3332	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:32:30.314671
3333	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:32:32.147218
3334	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:32:33.761197
3335	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:32:49.109436
3336	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:33:04.399685
3337	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:33:22.90303
3338	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:33:50.27941
3339	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:34:05.657532
3340	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:34:21.012838
3341	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:34:21.873279
3342	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:34:24.472146
3343	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:34:39.767036
3344	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:34:55.128783
3345	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:35:10.548803
3346	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:35:25.831444
3347	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:35:40.930915
3348	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:35:56.226112
3349	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:36:11.559335
3350	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:36:26.887237
3351	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:36:42.272962
3352	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:36:57.596911
3353	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:37:07.638126
3354	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:37:08.996883
3355	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:37:24.331665
3356	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:37:58.625687
3357	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:38:09.443064
3358	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:38:14.154146
3359	106	2026-04-23	8206.00000000	8206.00000000	2026-04-23 14:38:29.441062
3360	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:38:44.951259
3361	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:39:00.28866
3362	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:39:07.669335
3363	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:39:22.978709
3364	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:39:38.306457
3365	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:39:53.940597
3366	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:40:09.26033
3367	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:40:22.507725
3368	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:40:27.915211
3369	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:40:33.301447
3370	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:40:38.63572
3371	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:40:44.067629
3372	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:40:49.385407
3373	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:40:54.794091
3374	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:00.111435
3375	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:05.402956
3376	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:10.788224
3377	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:16.202523
3378	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:21.647921
3379	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:26.942325
3380	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:32.287849
3381	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:37.586275
3382	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:42.909543
3383	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:48.197857
3384	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:53.531805
3385	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:41:58.841458
3386	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:04.138055
3387	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:06.6969
3388	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:11.599729
3389	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:16.931589
3390	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:21.998441
3391	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:22.25654
3392	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:27.571858
3393	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:32.85469
3394	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:37.321876
3395	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:38.033929
3396	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:43.320748
3397	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:46.365643
3398	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:49.05172
3399	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:51.730446
3400	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:42:57.064286
3401	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:02.375554
3402	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:07.701532
3403	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:13.030686
3404	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:18.351112
3405	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:22.566775
3406	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:27.885926
3407	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:33.191085
3408	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:38.473425
3409	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:43.818134
3410	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:49.136264
3411	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:54.464792
3412	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:43:59.790226
3413	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:44:05.103026
3414	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:44:10.422658
3415	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:44:15.753417
3416	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:44:21.066836
3417	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:44:26.414043
3418	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:44:31.762495
3419	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:44:35.31437
3420	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:44:40.602857
3421	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:44:45.938596
3422	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:44:51.326107
3423	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:44:56.698608
3424	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:45:02.088497
3425	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:45:07.539674
3426	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:45:12.846348
3427	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:45:18.212597
3428	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:45:23.521039
3429	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:45:28.826853
3430	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:45:34.121583
3431	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:45:39.401858
3432	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:45:44.704408
3433	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:45:50.181583
3434	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:45:55.600984
3435	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:00.905379
3436	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:06.227623
3437	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:11.566861
3438	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:16.890869
3439	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:22.205096
3440	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:27.534496
3441	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:32.84016
3442	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:38.158127
3443	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:43.450607
3444	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:48.77041
3445	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:54.047486
3446	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:46:54.750578
3447	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:47:00.071391
3448	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:47:05.388012
3449	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:47:08.555726
3450	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:47:13.904499
3451	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:47:19.293213
3452	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:47:24.679045
3453	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:47:30.000936
3454	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:47:35.307523
3455	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:47:40.66191
3456	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:47:45.99572
3457	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:47:51.323984
3458	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:48:00.897966
3459	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:48:06.211762
3460	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:48:11.525027
3461	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:48:14.250267
3462	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:48:19.626255
3463	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:48:25.031152
3464	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:48:29.19719
3465	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:48:34.489863
3466	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:48:35.935773
3467	106	2026-04-23	8698.00000000	8698.00000000	2026-04-23 14:48:39.154819
3468	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:48:44.46163
3469	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:48:49.818168
3470	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:48:55.130493
3471	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:00.422447
3472	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:05.7367
3473	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:11.058874
3474	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:16.424786
3475	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:21.75418
3476	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:27.062478
3477	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:32.359976
3478	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:37.656871
3479	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:39.000658
3480	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:44.320424
3481	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:49.64171
3482	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:49:54.959834
3483	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:00.256491
3484	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:05.571885
3485	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:10.861947
3486	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:16.166479
3487	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:21.456236
3488	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:26.78734
3489	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:32.073943
3490	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:37.387592
3491	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:42.712859
3492	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:48.023254
3493	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:53.340712
3494	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:50:58.755137
3495	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:51:04.126233
3496	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:51:09.440358
3497	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:51:14.781903
3498	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:51:20.100355
3499	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:51:25.404759
3500	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:51:30.727243
3501	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:51:36.055959
3502	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:51:41.381819
3503	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:51:46.721446
3504	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:51:52.018315
3505	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:51:57.349932
3506	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:52:02.695402
3507	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:52:08.089198
3508	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:52:13.413857
3509	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:53:15.201822
3510	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:53:19.455806
3511	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:53:23.530964
3512	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:53:28.95232
3513	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:53:34.289409
3514	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:53:39.603501
3515	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:53:44.972783
3516	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:53:50.289567
3517	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:53:55.853807
3518	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:01.183836
3519	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:06.583754
3520	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:11.92801
3521	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:17.276705
3522	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:22.592995
3523	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:27.939763
3524	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:33.224421
3525	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:38.530753
3526	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:43.357448
3527	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:48.708252
3528	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:54.030047
3529	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:56.206918
3530	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:54:56.906247
3531	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:55:02.244541
3532	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:55:07.582703
3533	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:55:12.865199
3534	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:55:18.168444
3535	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:55:23.490512
3536	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:55:28.776574
3537	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:55:34.075537
3538	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:55:39.378881
3539	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:55:44.670739
3540	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:55:49.973807
3541	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:55:55.33477
3542	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:56:00.662327
3543	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:56:05.969047
3544	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:56:15.547739
3545	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:56:20.88348
3546	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:56:26.245231
3547	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:56:31.531904
3548	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:56:36.826166
3549	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:56:42.117012
3550	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:56:47.421674
3551	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:56:52.758851
3552	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:56:58.144349
3553	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:57:03.447846
3554	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:57:08.921395
3555	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:57:14.261252
3556	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:57:19.655636
3557	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:57:24.972174
3558	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:57:30.270461
3559	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:57:35.807724
3560	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:57:41.141311
3561	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:57:46.497847
3562	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:57:51.819694
3563	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:57:57.189904
3564	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:58:02.490592
3565	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:58:06.366667
3566	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:58:11.689336
3567	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:58:18.04225
3568	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:58:23.357887
3569	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:58:28.652533
3570	106	2026-04-23	9079.00000000	9079.00000000	2026-04-23 14:58:33.968118
3571	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:58:39.253672
3572	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:58:44.621094
3573	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:58:49.91172
3574	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:59:10.011743
3575	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:59:15.344564
3576	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:59:22.559571
3577	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:59:27.933488
3578	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:59:33.325563
3579	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:59:38.656881
3580	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:59:44.117024
3581	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:59:49.428521
3582	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 14:59:54.924321
3583	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:00.261333
3584	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:05.703325
3585	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:11.171361
3586	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:16.489983
3587	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:21.793473
3588	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:27.261197
3589	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:32.596599
3590	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:37.891166
3591	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:43.346843
3592	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:48.651414
3593	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:54.008154
3594	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:00:59.44753
3595	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:01:04.827733
3596	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:01:10.122147
3597	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:01:15.460961
3598	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:01:20.749688
3599	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:01:26.060149
3600	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:01:31.413123
3601	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:01:36.702194
3602	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:01:42.067526
3603	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:01:47.356835
3604	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:01:52.663705
3605	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:01:57.965231
3606	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:03.499906
3607	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:08.817493
3608	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:14.111662
3609	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:19.416564
3610	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:24.726972
3611	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:30.116365
3612	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:35.574541
3613	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:40.871559
3614	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:42.590379
3615	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:47.911504
3616	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:53.258951
3617	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:02:58.591982
3618	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:03.891985
3619	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:06.047908
3620	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:11.372934
3621	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:16.653783
3622	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:21.97351
3623	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:23.308368
3624	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:27.106756
3625	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:27.951066
3626	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:32.688277
3627	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:35.535878
3628	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:40.887439
3629	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:46.207595
3630	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:51.505139
3631	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:03:56.805717
3632	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:04:02.10747
3633	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:04:07.439492
3634	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:04:12.757932
3635	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:04:18.041704
3636	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:04:23.362747
3637	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:04:28.660764
3638	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:04:33.994033
3639	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:04:39.28532
3640	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:04:44.584352
3641	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:04:49.941114
3642	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:04:55.241315
3643	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:00.584736
3644	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:05.095139
3645	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:10.415396
3646	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:15.844756
3647	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:21.175649
3648	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:26.481271
3649	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:31.797968
3650	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:37.157266
3651	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:40.061257
3652	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:45.434391
3653	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:50.721031
3654	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:05:56.051993
3655	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:00.058876
3656	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:06.20933
3657	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:11.564725
3658	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:16.886798
3659	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:19.196976
3660	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:29.512451
3661	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:34.816307
3662	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:40.140361
3663	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:45.459931
3664	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:47.259217
3665	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:52.568373
3666	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:06:57.875046
3667	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:07:03.169342
3668	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:07:08.492032
3669	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:07:13.801892
3670	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:07:19.118926
3671	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:07:24.411213
3672	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:07:32.97797
3673	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:07:41.398669
3674	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:07:49.979858
3675	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:07:58.286117
3676	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:08:03.655484
3677	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:08:08.952944
3678	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:08:14.333015
3679	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:08:19.656978
3680	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:08:25.04062
3681	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:08:30.359219
3682	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:08:35.676181
3683	106	2026-04-23	9496.00000000	9496.00000000	2026-04-23 15:08:41.026799
3684	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:08:46.330964
3685	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:08:51.641839
3686	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:08:56.985344
3687	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:02.399059
3688	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:07.685712
3689	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:13.00562
3690	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:18.324569
3691	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:23.668193
3692	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:29.002279
3693	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:32.107925
3694	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:37.476393
3695	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:42.788926
3696	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:44.425521
3697	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:49.612228
3698	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:09:53.970736
3699	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:10:09.293052
3700	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:10:24.604545
3701	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:11:13.908343
3702	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:11:29.227593
3703	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:11:44.527384
3704	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:11:59.857658
3705	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:12:15.183769
3706	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:12:30.478231
3707	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:12:45.768615
3708	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:00.670928
3709	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:05.998268
3710	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:11.36254
3711	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:16.69548
3712	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:22.001748
3713	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:27.336571
3714	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:32.751802
3715	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:38.032924
3716	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:43.35154
3717	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:48.669743
3718	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:53.971072
3719	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:13:58.659813
3720	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:14:04.0684
3721	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:14:09.417799
3722	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:14:14.753274
3723	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:14:24.858895
3724	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:14:30.276324
3725	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:14:40.456813
3726	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:14:45.804705
3727	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:14:51.112954
3728	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:15:27.060333
3729	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:15:32.687984
3730	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:15:38.030116
3731	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:15:43.322688
3732	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:15:48.617536
3733	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:15:53.909833
3734	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:15:59.237821
3735	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:16:04.629114
3736	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:16:09.919528
3737	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:16:15.23942
3738	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:16:20.544194
3739	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:16:26.062196
3740	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:16:31.373115
3741	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:16:36.673356
3742	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:16:42.002201
3743	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:16:47.456985
3744	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:16:52.792828
3745	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:16:58.112342
3746	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:03.426365
3747	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:08.719258
3748	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:09.259125
3749	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:14.572132
3750	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:19.901936
3751	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:25.256393
3752	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:30.623826
3753	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:35.942234
3754	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:41.388316
3755	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:46.697325
3756	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:52.207728
3757	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:17:57.528192
3758	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:18:02.822684
3759	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:18:18.758101
3760	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:18:22.423927
3761	106	2026-04-23	9821.00000000	9821.00000000	2026-04-23 15:18:30.480842
3762	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:01.108338
3763	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:06.453233
3764	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:11.752354
3765	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:17.030645
3766	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:22.348072
3767	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:27.756544
3768	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:33.061158
3769	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:38.400524
3770	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:43.882272
3771	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:49.174046
3772	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:54.495746
3773	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:19:59.877201
3774	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:20:05.179298
3775	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:20:10.506162
3776	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:20:15.818052
3777	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:20:21.198538
3778	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:20:26.521808
3779	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:20:31.921062
3780	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:20:37.232002
3781	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:20:42.606625
3782	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:20:47.937657
3783	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:20:53.260842
3784	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:20:58.931967
3785	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:21:04.254819
3786	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:21:09.560425
3787	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:21:14.851709
3788	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:21:20.205844
3789	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:21:25.500232
3790	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:21:30.795055
3791	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:21:36.093999
3792	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:21:41.396494
3793	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:21:46.6917
3794	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:21:52.014823
3795	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:21:57.315
3796	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:02.619803
3797	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:07.923005
3798	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:13.234131
3799	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:17.544886
3800	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:22.854477
3801	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:28.234372
3802	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:33.622906
3803	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:38.940509
3804	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:39.589521
3805	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:44.937166
3806	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:45.349701
3807	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:47.680223
3808	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:53.017497
3809	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:22:58.376504
3810	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:23:03.734129
3811	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:23:09.042775
3812	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:23:14.332493
3813	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:23:14.754811
3814	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:23:20.218459
3815	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:23:25.590256
3816	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:23:31.000608
3817	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:23:36.377113
3818	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:23:40.049267
3819	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:23:45.367812
3820	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:23:50.581875
3821	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:24:02.497525
3822	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:24:07.884977
3823	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:24:13.218917
3824	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:24:18.576759
3825	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:24:23.861001
3826	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:24:29.154312
3827	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:24:34.490656
3828	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:24:39.833756
3829	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:24:45.146764
3830	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:24:50.450119
3831	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:24:55.743884
3832	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:01.056642
3833	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:06.340601
3834	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:11.687173
3835	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:17.076338
3836	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:22.381223
3837	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:27.676281
3838	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:32.966473
3839	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:38.286326
3840	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:43.599897
3841	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:45.500479
3842	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:50.828284
3843	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:25:56.138143
3844	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:26:01.435032
3845	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:26:06.735969
3846	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:26:12.13407
3847	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:26:17.455859
3848	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:26:22.933694
3849	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:26:28.294802
3850	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:26:33.664128
3851	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:26:39.018863
3852	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:26:44.345581
3853	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:26:49.654874
3854	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:26:54.998017
3855	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:00.28903
3856	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:05.61348
3857	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:10.940651
3858	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:16.36021
3859	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:21.75112
3860	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:25.08092
3861	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:30.376791
3862	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:35.69798
3863	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:41.026946
3864	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:46.38395
3865	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:51.708747
3866	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:27:57.020009
3867	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:28:02.316789
3868	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:28:07.76356
3869	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:28:13.184913
3870	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:28:18.603197
3871	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:28:23.921389
3872	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:28:29.289349
3873	106	2026-04-23	10191.00000000	10191.00000000	2026-04-23 15:28:34.624848
3874	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:28:39.950398
3875	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:28:55.29146
3876	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:29:10.618594
3877	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:29:22.991837
3878	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:29:28.32685
3879	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:29:33.663092
3880	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:29:39.034036
3881	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:29:44.322475
3882	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:29:49.631943
3883	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:29:54.998854
3884	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:30:00.375155
3885	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:30:05.688569
3886	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:30:10.979991
3887	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:30:16.26944
3888	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:30:21.6988
3889	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:30:24.305051
3890	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:30:39.664786
3891	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:30:54.955573
3892	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:30:56.756759
3893	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:31:02.059607
3894	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:31:07.499243
3895	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:31:12.872409
3896	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:31:18.196814
3897	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:31:23.510137
3898	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:31:28.809414
3899	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:31:37.01828
3900	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:31:42.382948
3901	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:31:47.696982
3902	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:31:53.034875
3903	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:31:58.466697
3904	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:32:03.795873
3905	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:32:09.093522
3906	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:32:14.377604
3907	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:32:19.662409
3908	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:32:24.957092
3909	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:32:30.497551
3910	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:32:35.816372
3911	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:32:38.570657
3912	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:32:53.949185
3913	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:33:09.245262
3914	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:33:24.585633
3915	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:33:39.897211
3916	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:33:55.182456
3917	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:34:10.495791
3918	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:34:25.802129
3919	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:34:41.101707
3920	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:34:49.475697
3921	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:34:57.232752
3922	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:35:35.7749
3923	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:35:41.119133
3924	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:35:45.848211
3925	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:35:46.10935
3926	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:35:47.618988
3927	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:35:52.957625
3928	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:35:55.542345
3929	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:35:58.29769
3930	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:35:59.177908
3931	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:36:04.477127
3932	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:36:09.798014
3933	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:36:15.093714
3934	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:36:20.377824
3935	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:36:25.663035
3936	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:36:31.073752
3937	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:36:36.400443
3938	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:36:41.686713
3939	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:36:47.414486
3940	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:36:52.733408
3941	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:36:58.063767
3942	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:37:03.405149
3943	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:37:08.752223
3944	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:37:22.96666
3945	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:37:28.279401
3946	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:37:33.616609
3947	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:37:38.943655
3948	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:37:44.239098
3949	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:37:49.537955
3950	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:37:54.845698
3951	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:38:00.147649
3952	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:38:05.462354
3953	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:38:10.780431
3954	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:38:16.095655
3955	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:38:21.408116
3956	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:38:26.707506
3957	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:38:27.158136
3958	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:38:27.249256
3959	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:38:27.452771
3960	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:38:32.581293
3961	106	2026-04-23	10312.00000000	10312.00000000	2026-04-23 15:38:37.896818
3962	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:38:43.215981
3963	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:38:48.516363
3964	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:38:54.003456
3965	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:38:59.302283
3966	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:39:04.73916
3967	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:39:10.047821
3968	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:39:15.352245
3969	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:39:20.647529
3970	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:39:26.17793
3971	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:39:31.560338
3972	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:39:36.857541
3973	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:39:42.274909
3974	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:39:47.643311
3975	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:39:52.958477
3976	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:39:58.252375
3977	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:40:12.178407
3978	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:40:12.762474
3979	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:41:30.191471
3980	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:41:30.529816
3981	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:41:33.284727
3982	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:41:38.609382
3983	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:41:43.592348
3984	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:41:44.121434
3985	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:41:44.413178
3986	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:41:48.977322
3987	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:04.586289
3988	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:05.075937
3989	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:05.453465
3990	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:21.7594
3991	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:27.131184
3992	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:29.426307
3993	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:30.156495
3994	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:37.174905
3995	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:43.410378
3996	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:43.933277
3997	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:44.15584
3998	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:46.142478
3999	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:49.340517
4000	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:50.110996
4001	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:50.400888
4002	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:54.6532
4003	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:42:59.952101
4004	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:05.277582
4005	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:10.59752
4006	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:15.909951
4007	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:21.290057
4008	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:26.814428
4009	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:32.102878
4010	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:37.41061
4011	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:42.690056
4012	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:50.173843
4013	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:52.988839
4014	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:53.126698
4015	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:54.148066
4016	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:43:59.461379
4017	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:04.785389
4018	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:10.102324
4019	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:15.432264
4020	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:18.992039
4021	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:19.137935
4022	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:19.431952
4023	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:24.284331
4287	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:21:53.18528
4288	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:21:58.480968
4289	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:22:03.773267
4290	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:22:09.070085
4291	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:22:22.780306
4292	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:22:28.069425
4294	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:22:38.664512
4295	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:22:46.520606
4299	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:28:20.097505
4306	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:29:58.055253
4308	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:06.486089
4309	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:11.815142
4310	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:17.136851
4311	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:22.427654
4312	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:27.70192
4320	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:00.7118
4334	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:33:26.837564
4336	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:33:37.461801
4337	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:33:42.742959
4338	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:33:48.01105
4339	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:33:53.292656
4348	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:34:39.202509
4365	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:36:09.087012
4410	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:40:19.845744
4450	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:43:52.350736
4470	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:32.350505
4471	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:37.61549
4472	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:42.872587
4473	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:48.12577
4474	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:53.429738
4475	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:45:58.681569
4497	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:52.358252
4498	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:57.61999
4499	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:48:02.88553
4506	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:48:40.093229
4507	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:48:45.343119
4508	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:48:50.591792
4509	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:48:55.840475
4510	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:01.108228
4511	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:06.377013
4512	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:11.635299
4513	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:16.936409
4514	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:22.236653
4515	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:27.542018
4516	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:32.810722
4517	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:38.08466
4518	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:43.359807
4519	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:48.634693
4520	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:53.909481
4521	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:49:59.212248
4522	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:04.467749
4523	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:09.737851
4525	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:16.227469
4526	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:21.54487
4534	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:53.228073
4538	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:14.355675
4550	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:52:15.789382
4551	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:52:21.091646
4552	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:52:26.37487
4553	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:52:31.644815
4554	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:52:36.899298
4555	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:52:42.226203
4556	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:52:47.500728
4557	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:52:52.784901
4569	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:53:57.47872
4570	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:54:02.752366
4571	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:54:08.034734
4572	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:54:13.288836
4573	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:54:18.606665
4574	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:54:23.885004
4598	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:56:51.666696
4603	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 16:59:58.007236
4604	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:00:03.261441
4614	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:14.268549
4617	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:20.987243
4621	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:50.962206
4622	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:56.246777
4623	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:02:01.50634
4624	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:02:06.776159
4634	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:03:34.352575
4638	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:04:40.68151
4645	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:05:23.470822
4663	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:06:57.286678
4664	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:07:02.542149
4665	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:07:07.807023
4690	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:30.083089
4703	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:11:32.288738
4705	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:11:42.820983
4706	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:11:48.085932
4707	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:11:53.403189
4715	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:35.489641
4716	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:40.756311
4717	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:46.076861
4718	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:51.339378
4719	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:12:56.596154
4720	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:13:01.897582
4724	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:14:06.117939
4730	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:14:33.821663
4731	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:14:39.078896
4734	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:15:38.368776
4741	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:16:47.967356
4752	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:17:55.889575
4753	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:18:01.166492
4756	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:18:48.81524
4758	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:19:07.483242
4761	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:20:00.482827
4762	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:20:05.893497
4764	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:20:23.872566
4765	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:20:29.141563
4766	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:20:34.39354
4767	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:20:39.642351
4768	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:20:44.897816
4769	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:20:50.175203
4776	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:27.025483
4777	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:32.294392
4778	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:37.576693
4779	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:42.84112
4780	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:48.110693
4781	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:53.382779
4782	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:21:58.645952
4783	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:22:03.93649
4784	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:22:09.193719
4785	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:22:14.453019
4786	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:22:19.745805
4787	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:22:25.198706
4788	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:22:30.491109
4789	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:22:35.761554
4790	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:22:41.145222
4791	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:22:46.414651
4792	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:22:51.685412
4793	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:22:56.960127
4024	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:28.125244
4025	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:28.235046
4026	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:28.432922
4027	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:29.608539
4028	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:45.122851
4029	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:48.817262
4030	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:54.225289
4031	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:57.792704
4032	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:58.1493
4033	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:44:58.430018
4034	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:03.197692
4035	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:08.52909
4036	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:13.854541
4037	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:19.179307
4038	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:24.47464
4039	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:29.758022
4040	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:35.060636
4041	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:40.35904
4042	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:45.663379
4043	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:49.562119
4044	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:50.141044
4045	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:50.445463
4046	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:45:54.855469
4047	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:00.216514
4048	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:05.594018
4049	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:10.895346
4050	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:16.25746
4051	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:21.54329
4052	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:26.83014
4053	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:32.116369
4054	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:36.68867
4055	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:37.122131
4056	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:37.409875
4057	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:41.985045
4058	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:47.28185
4059	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:52.633388
4060	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:46:57.969587
4061	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:03.263282
4062	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:08.632405
4063	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:14.137913
4064	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:19.471132
4065	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:24.904002
4066	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:26.74679
4067	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:27.116893
4068	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:27.565053
4069	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:32.215228
4070	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:37.69267
4071	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:43.049475
4072	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:48.347425
4073	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:53.662876
4074	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:47:58.966523
4075	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:48:04.328814
4076	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:48:10.111069
4077	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:48:15.434311
4078	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:48:20.769085
4079	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:48:26.08884
4080	106	2026-04-23	10605.00000000	10605.00000000	2026-04-23 15:48:31.463207
4081	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:48:37.659223
4082	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:48:43.049862
4083	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:48:48.37371
4084	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:48:53.784248
4085	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:48:59.131973
4086	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:49:04.486873
4087	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:49:09.767837
4088	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:49:15.124192
4089	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:49:20.442114
4090	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:49:25.832918
4091	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:49:31.261941
4092	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:49:36.710422
4093	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:49:41.993598
4094	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:49:47.298361
4095	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:49:52.637805
4096	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:49:57.950365
4097	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:50:03.24284
4098	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:50:08.531973
4099	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:50:13.847755
4100	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:50:19.15141
4101	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:50:24.453376
4102	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:50:29.765658
4103	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:50:35.079396
4104	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:50:40.36848
4105	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:50:45.658162
4106	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:50:50.988004
4107	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:50:56.30691
4108	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:01.627144
4109	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:06.956283
4110	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:11.953788
4111	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:13.122282
4112	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:13.587063
4113	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:17.327138
4114	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:22.77997
4115	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:28.103925
4116	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:33.482453
4117	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:38.790014
4118	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:44.086998
4119	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:49.369209
4120	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:54.652879
4121	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:51:59.930544
4122	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:01.745705
4123	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:02.104545
4124	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:02.38314
4125	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:07.168774
4126	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:12.539495
4127	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:17.908368
4128	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:23.200215
4129	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:28.523754
4130	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:33.928053
4131	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:39.240627
4132	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:44.557469
4133	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:49.917375
4134	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:55.230496
4135	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:57.748766
4136	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:58.117198
4137	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:52:58.423502
4138	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:53:03.16342
4139	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:53:08.640028
4140	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:53:13.962375
4141	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:53:19.258538
4142	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:53:23.820328
4143	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:53:39.122935
4144	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:53:54.480567
4145	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:54:09.832361
4146	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:54:25.154007
4147	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:54:40.457006
4148	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:54:46.549409
4149	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:54:47.477777
4150	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:55:31.055852
4151	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:55:36.473489
4152	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:55:41.830637
4153	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:55:47.290382
4154	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:55:52.698256
4155	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:55:58.118854
4156	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:56:03.418225
4157	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:56:08.730545
4158	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:56:14.042657
4159	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:56:19.337898
4160	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:56:24.645485
4161	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:56:28.066474
4162	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:56:30.782303
4163	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:56:34.076489
4164	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:56:37.096611
4165	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:56:42.463357
4166	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:56:54.949191
4167	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:57:00.274336
4168	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:57:05.562911
4169	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:57:10.837326
4170	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:57:16.178348
4171	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:57:21.494922
4172	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:58:00.500456
4173	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:58:05.874755
4174	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:58:11.189091
4175	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:58:16.517739
4176	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:58:21.8379
4177	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:58:27.195553
4178	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:58:32.509313
4179	106	2026-04-23	10930.00000000	10930.00000000	2026-04-23 15:58:37.881381
4180	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 15:58:43.175702
4181	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 15:58:48.527528
4182	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 15:58:53.816149
4183	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 15:58:59.118322
4184	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 15:59:04.419368
4185	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 15:59:09.72296
4186	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 15:59:15.113739
4187	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 15:59:16.402589
4188	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 15:59:21.742538
4189	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:00:56.001027
4190	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:00.241106
4191	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:05.560757
4192	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:10.861908
4193	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:16.149031
4194	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:21.456207
4195	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:26.763802
4196	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:32.090065
4197	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:37.378616
4198	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:42.822286
4199	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:48.1415
4200	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:53.438471
4201	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:01:58.784555
4202	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:05:40.746572
4203	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:05:46.051702
4204	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:05:51.359822
4205	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:05:56.655559
4206	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:06:01.947006
4207	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:06:07.295691
4208	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:06:12.614793
4209	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:06:18.597699
4210	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:06:24.011122
4211	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:06:29.430937
4212	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:06:39.751394
4213	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:06:45.074788
4214	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:06:50.447556
4215	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:06:55.832749
4216	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:07:01.121094
4217	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:07:06.4506
4218	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:07:11.928434
4219	106	2026-04-23	11272.00000000	11272.00000000	2026-04-23 16:07:14.175562
4220	109	2026-04-23	1.00000000	1.00000000	2026-04-23 16:08:26.074931
4221	109	2026-04-23	1.00000000	1.00000000	2026-04-23 16:08:41.404847
4222	109	2026-04-23	1.00000000	1.00000000	2026-04-23 16:08:56.815043
4223	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:09:12.108761
4224	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:09:20.42138
4225	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:09:25.758967
4226	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:09:31.070406
4227	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:09:36.53258
4228	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:09:41.862917
4229	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:09:47.401352
4230	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:09:52.698593
4231	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:09:57.993808
4232	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:10:03.340685
4233	109	2026-04-23	1.00000000	1.00000000	2026-04-23 16:10:08.626819
4234	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:10:10.020787
4235	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:10:15.337014
4236	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:10:20.675265
4237	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:10:26.073011
4238	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:10:31.375372
4239	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:14:14.411018
4240	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:15:57.530745
4241	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:16:02.874497
4242	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:16:08.183746
4243	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:16:13.503487
4244	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:16:18.777609
4245	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:16:24.046471
4246	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:16:29.321329
4247	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:16:34.593766
4248	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:16:39.859398
4249	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:16:45.134279
4250	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:16:50.414114
4251	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:16:55.761448
4252	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:01.034898
4253	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:06.340667
4254	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:11.613817
4255	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:16.893295
4256	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:22.172289
4257	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:27.467585
4258	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:32.754429
4259	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:38.054365
4260	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:43.3301
4261	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:48.61732
4262	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:53.895495
4263	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:17:59.178813
4264	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:18:04.505729
4265	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:18:09.81504
4266	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:18:15.094196
4267	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:18:20.414889
4268	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:18:25.725073
4269	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:18:31.007714
4270	106	2026-04-23	11727.00000000	11727.00000000	2026-04-23 16:18:36.283551
4271	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:18:41.587404
4272	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:18:46.868069
4273	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:18:52.226534
4274	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:18:57.519369
4275	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:19:02.808373
4276	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:19:08.103559
4277	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:19:13.522614
4278	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:19:18.79941
4279	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:19:24.097547
4280	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:19:29.396204
4281	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:19:34.671248
4282	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:19:39.955784
4293	106	2026-04-23	12121.00000000	12121.00000000	2026-04-23 16:22:33.385739
4300	106	2026-04-23	12287.00000000	12287.00000000	2026-04-23 16:29:15.528059
4313	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:32.98862
4314	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:38.27184
4315	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:30:43.569974
4321	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:06.009423
4322	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:11.300057
4323	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:32:16.586366
4335	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:33:32.120678
4349	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:34:44.528356
4350	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:34:49.811265
4351	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:34:55.083382
4387	109	2026-04-23	764.00000000	764.00000000	2026-04-23 16:38:13.262465
4411	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:40:25.160095
4412	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:40:30.415444
4413	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:40:35.679814
4414	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:40:41.052131
4415	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:40:46.329979
4416	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:40:51.589914
4417	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:40:56.927594
4418	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:41:02.205452
4419	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:41:07.523912
4420	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:41:12.775602
4421	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:41:18.037741
4422	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:41:23.288905
4423	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:41:28.539878
4424	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:41:33.791965
4425	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:41:39.046343
4426	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:41:44.312211
4427	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:41:49.565684
4428	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:41:54.823973
4429	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:00.10635
4430	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:05.380546
4431	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:10.753602
4432	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:16.082501
4433	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:42:21.361268
4451	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:43:56.762953
4476	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:46:03.937006
4477	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:46:09.186208
4478	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:46:14.438851
4479	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:46:19.696738
4480	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:46:24.982766
4481	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:46:30.231395
4482	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:46:35.496202
4483	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:46:40.752256
4484	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:46:46.012674
4485	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:46:51.276992
4486	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:46:56.53391
4487	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:01.802659
4488	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:07.067927
4489	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:12.316922
4490	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:17.570303
4491	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:22.844973
4492	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:28.095691
4494	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:47:36.515636
4500	109	2026-04-23	1214.00000000	1214.00000000	2026-04-23 16:48:08.519295
4524	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:10.960134
4535	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:50:58.518407
4536	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:03.801289
4537	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:09.077503
4539	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:19.642837
4540	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:25.12504
4541	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:30.406665
4542	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:35.68237
4543	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:40.947313
4544	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:46.204988
4545	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:51:51.463921
4558	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:52:58.062511
4559	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:53:03.348052
4560	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:53:08.618774
4561	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:53:13.887796
4575	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:54:29.15792
4576	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:54:34.420311
4599	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:56:56.95688
4600	109	2026-04-23	1697.00000000	1697.00000000	2026-04-23 16:57:02.248747
4605	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:00:32.599002
4615	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:14.660373
4616	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:01:15.672893
4625	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:02:46.770785
4635	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:03:59.924238
4639	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:04:46.17667
4646	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:05:28.744648
4647	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:05:34.015604
4648	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:05:39.287643
4649	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:05:44.627579
4650	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:05:49.885284
4651	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:05:53.948271
4666	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:07:47.517555
4667	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:07:52.793336
4668	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:07:58.064056
4669	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:08:03.322661
4670	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:08:08.702443
4671	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:08:13.974505
4672	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:08:19.230253
4673	109	2026-04-23	2099.00000000	2099.00000000	2026-04-23 17:08:24.493114
4674	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:08:29.759029
4675	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:08:35.030978
4676	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:08:40.304475
4677	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:08:45.599226
4678	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:08:50.870318
4679	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:08:56.124644
4680	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:09:01.383422
4681	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:09:06.669755
4682	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:09:11.938464
4683	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:09:17.262687
4684	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:09:22.529682
4685	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:09:27.825344
4693	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:38.198072
4694	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:43.467365
4695	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:48.726705
4696	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:10:54.03377
4704	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:11:37.560757
4721	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:13:33.874385
4725	109	2026-04-23	2385.00000000	2385.00000000	2026-04-23 17:14:11.067385
4794	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:02.209454
4795	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:07.508363
4796	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:12.754856
4797	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:18.137552
4798	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:23.48798
4799	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:28.750284
4800	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:32.564578
4801	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:37.8486
4802	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:43.18832
4803	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:48.44841
4804	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:53.711354
4805	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:23:58.974591
4806	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:04.245621
4807	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:06.589247
4808	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:11.990351
4809	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:17.247723
4810	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:22.169271
4811	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:27.599372
4812	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:32.852832
4813	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:38.169834
4814	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:43.427376
4815	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:48.702259
4816	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:52.507929
4817	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:24:58.035464
4818	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:01.639608
4819	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:06.960876
4820	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:12.229663
4821	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:17.485659
4822	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:22.758998
4823	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:28.079827
4824	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:33.342029
4825	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:38.61393
4826	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:43.883967
4827	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:49.148742
4828	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:54.41305
4829	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:25:59.681806
4830	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:26:04.929892
4831	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:26:09.716515
4832	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:26:14.978355
4833	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:26:20.364138
4834	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:26:25.068358
4835	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:26:30.333965
4836	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:26:35.583943
4837	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:26:40.83478
4838	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:26:46.133804
4839	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:26:51.386197
4840	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:26:56.742925
4841	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:02.153057
4842	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:07.40849
4843	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:12.67125
4844	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:17.937866
4845	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:23.214547
4846	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:25.259801
4847	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:29.862327
4848	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:35.270341
4849	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:37.420672
4850	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:44.283045
4851	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:48.678375
4852	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:49.580719
4853	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:27:54.853726
4854	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:28:00.123009
4855	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:28:05.40692
4856	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:28:10.680132
4857	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:28:15.95373
4858	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:28:21.236952
4859	109	2026-04-23	2684.00000000	2684.00000000	2026-04-23 17:28:26.571262
4860	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:28:31.833022
4861	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:28:37.136294
4862	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:28:42.397285
4863	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:28:47.683713
4864	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:28:52.951833
4865	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:28:58.209967
4866	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:03.482543
4867	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:08.747611
4868	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:14.157248
4869	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:19.429914
4870	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:22.270482
4871	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:26.874393
4872	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:32.407989
4873	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:37.678659
4874	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:42.94573
4875	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:48.192571
4876	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:53.450435
4877	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:29:58.711371
4878	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:30:03.968272
4879	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:30:09.229305
4880	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:30:14.489324
4881	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:30:19.749006
4882	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:30:25.164165
4883	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:30:30.412427
4884	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:30:35.663258
4885	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:30:40.927063
4886	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:30:46.185247
4887	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:30:51.472691
4888	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:30:56.766674
4889	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:02.152831
4890	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:07.426234
4891	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:12.678806
4892	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:13.501061
4893	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:18.77573
4894	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:24.053474
4895	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:26.193769
4896	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:31.46142
4897	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:36.792216
4898	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:42.150247
4899	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:47.404162
4900	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:52.690593
4901	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:31:57.949492
4902	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:32:03.224969
4903	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:32:08.496332
4904	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:32:13.757849
4905	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:32:19.027962
4906	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:32:24.296887
4907	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:32:29.61775
4908	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:32:34.893866
4909	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:32:40.173374
4910	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:32:45.439846
4911	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:32:50.696784
4912	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:32:55.969994
4913	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:01.225868
4914	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:06.482776
4915	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:11.766001
4916	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:17.152136
4917	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:22.448496
4918	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:27.740584
4919	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:33.163862
4920	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:38.458932
4921	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:43.720069
4922	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:49.175242
4923	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:54.475267
4924	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:33:59.739709
4925	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:34:05.160368
4926	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:34:05.614739
4927	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:34:12.731742
4928	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:34:18.247083
4929	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:34:23.526191
4930	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:34:28.780002
4931	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:34:34.17565
4932	109	2026-04-23	2979.00000000	2979.00000000	2026-04-23 17:37:43.763861
4933	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:44:38.556693
4934	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:44:43.827896
4935	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:44:49.254154
4936	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:44:54.589875
4937	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:44:59.869148
4938	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:45:05.243637
4939	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:45:10.496577
4940	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:45:15.761593
4941	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:45:21.378214
4942	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:45:26.644338
4943	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:45:31.899384
4944	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:45:37.212241
4945	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:45:42.477465
4946	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:45:47.75309
4947	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:45:53.21468
4948	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:45:58.513013
4949	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:46:03.773737
4950	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:46:09.225933
4951	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:46:14.477283
4952	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:46:19.734257
4953	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:46:25.248324
4954	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:46:30.538729
4955	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:46:35.806466
4956	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:46:41.223069
4957	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:46:46.50978
4958	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:46:51.761175
4959	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:46:57.222108
4960	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:47:02.49104
4961	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:47:07.742512
4962	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:47:13.221098
4963	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:47:18.484715
4964	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:47:23.731718
4965	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:47:29.228457
4966	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:47:34.493353
4967	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:47:39.741507
4968	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:47:45.217016
4969	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:47:50.479123
4970	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:47:55.866026
4971	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:48:01.243133
4972	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:48:06.492013
4973	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:48:09.392326
4974	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:48:14.712828
4975	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:48:20.042547
4976	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:48:25.315951
4977	109	2026-04-23	3117.00000000	3117.00000000	2026-04-23 17:48:30.591933
4978	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:48:31.065439
4979	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:48:38.570874
4980	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:48:43.836003
4981	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:48:49.241611
4982	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:48:54.498457
4983	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:48:59.755448
4984	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:05.268847
4985	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:10.548456
4986	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:15.815837
4987	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:21.246734
4988	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:26.594888
4989	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:31.845687
4990	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:37.228172
4991	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:38.405805
4992	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:43.692666
4993	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:48.826832
4994	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:54.244467
4995	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:49:59.498385
4996	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:50:04.754924
4997	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:50:10.26245
4998	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:50:15.563343
4999	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:50:20.835697
5000	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:50:26.251617
5001	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:50:31.587983
5002	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:11.799207
5003	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:17.269587
5004	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:22.557172
5005	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:23.953135
5006	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:29.229473
5007	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:34.506429
5008	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:37.820102
5009	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:39.872054
5010	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:45.245014
5011	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:50.517012
5012	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:53.227552
5013	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:51:56.075751
5014	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:01.406914
5015	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:06.703346
5016	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:08.483783
5017	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:11.974666
5018	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:17.251978
5019	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:22.546974
5020	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:23.979633
5021	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:27.973615
5022	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:33.249804
5023	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:38.516967
5024	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:39.243514
5025	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:43.782247
5026	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:52:49.263571
5027	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:55:20.927047
5028	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:58:19.89686
5029	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:58:23.600597
5030	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:58:25.183735
5031	109	2026-04-23	3231.00000000	3231.00000000	2026-04-23 17:58:29.626048
5032	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:58:34.968641
5033	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:58:40.257112
5034	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:58:45.528244
5035	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:58:50.803041
5036	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:58:56.105414
5037	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:59:03.528654
5038	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:59:15.152271
5039	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:59:20.4145
5040	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:59:25.700756
5041	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:59:30.988056
5042	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:59:36.250508
5043	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:59:41.512544
5044	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:59:46.770207
5045	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:59:52.249216
5046	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 17:59:57.537336
5047	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:00:02.829201
5048	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:00:08.080812
5049	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:00:13.332413
5050	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:00:18.597751
5051	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:00:23.860543
5052	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:00:29.120247
5053	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:00:34.423511
5054	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:00:39.68954
5055	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:00:44.97114
5056	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:00:52.847394
5057	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:00:55.102759
5058	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:02:11.474735
5059	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:02:16.750048
5060	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:02:22.035178
5061	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:02:27.296144
5062	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:02:33.096141
5063	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:02:38.378269
5064	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:02:42.769814
5065	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:03:08.698735
5066	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:03:13.95452
5067	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:03:19.214355
5068	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:03:24.518262
5069	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:03:29.792684
5070	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:03:35.067143
5071	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:03:40.32131
5072	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:03:45.575023
5073	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:03:50.869061
5074	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:03:56.118722
5075	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:01.377275
5076	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:06.654394
5077	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:11.941461
5078	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:17.231829
5079	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:22.542779
5080	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:22.91376
5081	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:24.658717
5082	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:28.200204
5083	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:33.539796
5084	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:37.863359
5085	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:38.844319
5086	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:44.115239
5087	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:49.390695
5088	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:53.126808
5089	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:54.656033
5090	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:04:56.355963
5091	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:01.667529
5092	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:06.982758
5093	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:12.283327
5094	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:17.542447
5095	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:22.906935
5096	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:28.1697
5097	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:33.433353
5098	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:38.712672
5099	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:44.003461
5100	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:49.298239
5101	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:54.605793
5102	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:05:59.859957
5103	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:06:05.129926
5104	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:06:10.400398
5105	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:06:15.654586
5106	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:06:20.912677
5107	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:06:26.208731
5108	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:06:31.472109
5109	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:06:36.727347
5110	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:06:41.993696
5111	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:06:47.273419
5112	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:06:52.546524
5113	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:06:57.799899
5114	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:03.076376
5115	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:08.353891
5116	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:13.611753
5117	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:18.648435
5118	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:27.7521
5119	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:29.935438
5120	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:33.999696
5121	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:38.341274
5122	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:42.516118
5123	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:42.944438
5124	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:48.006661
5125	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:53.285634
5126	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:07:58.572409
5127	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:08:00.607361
5128	109	2026-04-23	3420.00000000	3420.00000000	2026-04-23 18:08:24.832992
5129	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:08:30.09281
5130	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:09:27.881834
5131	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:09:33.149265
5132	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:09:38.423095
5133	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:09:43.724836
5134	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:09:48.985376
5135	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:09:54.255858
5136	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:09:59.50865
5137	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:10:04.806927
5138	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:10:10.090992
5139	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:10:15.401199
5140	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:10:20.66673
5141	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:10:25.946781
5142	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:10:31.2013
5143	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:10:36.457817
5144	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:10:41.74339
5145	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:10:47.000481
5146	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:10:52.269593
5147	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:10:57.615157
5148	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:11:02.952004
5149	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:11:08.219993
5150	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:11:13.50342
5151	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:11:18.821775
5152	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:11:24.181375
5153	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:11:29.436291
5154	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:11:34.847986
5155	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:11:40.114971
5156	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:11:45.372207
5157	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:11:50.641802
5158	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:11:55.891737
5159	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:12:01.144045
5160	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:12:06.397128
5161	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:12:11.665386
5162	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:12:16.93853
5163	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:12:22.226807
5164	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:12:27.493279
5165	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:12:32.826442
5166	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:12:38.084232
5167	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:12:43.345995
5168	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:12:49.337037
5169	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:12:54.767896
5170	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:00.216407
5171	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:05.480865
5172	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:10.76672
5173	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:16.035608
5174	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:21.303753
5175	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:26.576558
5176	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:31.851643
5177	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:37.125947
5178	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:42.448354
5179	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:47.930504
5180	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:53.188658
5181	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:13:58.455545
5182	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:14:03.709122
5183	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:14:08.972158
5184	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:14:14.23248
5185	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:14:19.491413
5186	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:14:24.759765
5187	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:14:30.021032
5188	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:14:35.284025
5189	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:14:40.551032
5190	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:14:45.81594
5191	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:14:51.096148
5192	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:14:56.352225
5193	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:01.643735
5194	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:06.93039
5195	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:12.228713
5196	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:17.486725
5197	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:22.738735
5198	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:28.003501
5199	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:33.287239
5200	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:38.545467
5201	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:43.800136
5202	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:49.09402
5203	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:54.360399
5204	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:15:59.649007
5205	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:16:04.958155
5206	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:16:10.233135
5207	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:16:15.501443
5208	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:16:20.751745
5209	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:16:26.169236
5210	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:16:31.425806
5211	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:16:36.684805
5212	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:16:41.94698
5213	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:16:47.198172
5214	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:16:52.463145
5215	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:16:57.793397
5216	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:17:03.078618
5217	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:17:08.350519
5218	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:17:13.631191
5219	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:17:18.892496
5220	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:17:24.217285
5221	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:17:29.478575
5222	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:17:34.734712
5223	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:17:40.035979
5224	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:17:45.299304
5225	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:17:50.554233
5226	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:17:55.814156
5227	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:18:01.20192
5228	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:18:06.496358
5229	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:18:11.749174
5230	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:18:17.004948
5231	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:18:22.254805
5232	109	2026-04-23	3592.00000000	3592.00000000	2026-04-23 18:18:27.520795
5233	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:18:32.781181
5234	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:18:38.039334
5235	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:18:43.352367
5236	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:18:48.617771
5237	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:18:53.87506
5238	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:18:59.138044
5239	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:19:04.46044
5240	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:19:09.74933
5241	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:19:15.004929
5242	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:19:20.343606
5243	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:19:25.668566
5244	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:19:30.925497
5245	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:19:36.237549
5246	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:19:41.49557
5247	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:19:46.772569
5248	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:19:52.033453
5249	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:19:57.32041
5250	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:20:02.577569
5251	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:20:07.852188
5252	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:20:13.183721
5253	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:20:18.457506
5254	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:20:23.717744
5255	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:20:28.981659
5256	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:20:34.281243
5257	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:20:39.538323
5258	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:20:44.797135
5259	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:20:50.054048
5260	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:20:55.383185
5261	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:00.694888
5262	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:06.027541
5263	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:11.279425
5264	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:16.553524
5265	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:21.826541
5266	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:27.08936
5267	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:32.346314
5268	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:37.613028
5269	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:42.887943
5270	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:48.147511
5271	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:53.408933
5272	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:21:58.67556
5273	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:22:03.934215
5274	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:22:09.30038
5275	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:22:14.615071
5276	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:22:19.934615
5277	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:22:25.199402
5278	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:22:30.490899
5279	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:22:35.785872
5280	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:22:41.043584
5281	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:22:46.313424
5282	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:22:51.570878
5283	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:22:56.827257
5284	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:23:02.092969
5285	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:23:07.352826
5286	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:23:12.61333
5287	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:23:17.877302
5288	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:23:23.238826
5289	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:23:28.557393
5290	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:23:33.819509
5291	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:23:39.077686
5292	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:23:44.370684
5293	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:23:49.664634
5294	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:23:54.927137
5295	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:00.194296
5296	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:05.462226
5297	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:10.750594
5298	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:16.007809
5299	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:21.27148
5300	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:26.542873
5301	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:31.807536
5302	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:37.067547
5303	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:42.328176
5304	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:47.614809
5305	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:52.901703
5306	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:24:58.160968
5307	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:25:03.425298
5308	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:25:08.723117
5309	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:25:13.984283
5310	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:25:19.260877
5311	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:25:24.664214
5312	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:25:29.926365
5313	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:25:35.183156
5314	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:25:40.454486
5315	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:25:45.777943
5316	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:25:51.095503
5317	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:25:56.433903
5318	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:01.728618
5319	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:07.083863
5320	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:12.370203
5321	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:17.638256
5322	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:22.899809
5323	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:28.19755
5324	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:33.493274
5325	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:38.760533
5326	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:44.020309
5327	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:49.369687
5328	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:54.697601
5329	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:26:59.956983
5330	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:27:05.258604
5331	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:27:10.576429
5332	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:27:15.932533
5333	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:27:21.223366
5334	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:27:26.503285
5335	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:27:31.764215
5336	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:27:37.037618
5337	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:27:42.323789
5338	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:27:47.585324
5339	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:27:52.844603
5340	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:27:58.108194
5341	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:28:03.372933
5342	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:28:08.628964
5343	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:28:13.890631
5344	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:28:19.171407
5345	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:28:24.439577
5346	109	2026-04-23	4012.00000000	4012.00000000	2026-04-23 18:28:29.697719
5347	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:28:34.958736
5348	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:28:40.231614
5349	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:28:45.495353
5350	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:28:50.819468
5351	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:28:56.08661
5352	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:01.356293
5353	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:06.617144
5354	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:11.908712
5355	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:17.245778
5356	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:22.504468
5357	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:27.794897
5358	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:33.061986
5359	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:38.368302
5360	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:43.627378
5361	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:48.885562
5362	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:54.196629
5363	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:29:59.455631
5364	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:30:04.71021
5365	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:30:09.969644
5366	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:30:15.271151
5367	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:30:20.623291
5368	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:30:25.888844
5369	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:30:31.150417
5370	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:30:36.467796
5371	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:30:41.72993
5372	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:30:46.990727
5373	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:30:52.265925
5374	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:30:57.539289
5375	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:31:02.796052
5376	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:31:08.053066
5377	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:31:13.355692
5378	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:31:18.643596
5379	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:31:23.90034
5380	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:31:29.175639
5381	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:31:34.458151
5382	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:31:39.721069
5383	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:31:44.974768
5384	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:31:50.238742
5385	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:31:55.558519
5386	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:00.871008
5387	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:06.125503
5388	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:11.388285
5389	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:16.671761
5390	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:21.965567
5391	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:27.260028
5392	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:32.634225
5393	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:37.892618
5394	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:43.157938
5395	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:48.482277
5396	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:53.748948
5397	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:32:59.007119
5398	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:33:04.301149
5399	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:33:09.590413
5400	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:33:14.881193
5401	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:33:20.139181
5402	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:33:25.435239
5403	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:33:30.769221
5404	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:33:36.020662
5405	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:33:41.274016
5406	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:33:46.529306
5407	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:33:53.141002
5408	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:33:58.398129
5409	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:34:03.660625
5410	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:34:08.919271
5411	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:34:14.173057
5412	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:34:19.523361
5413	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:34:24.779166
5414	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:34:30.056362
5415	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:34:35.333237
5416	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:34:40.61982
5417	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:34:45.877045
5418	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:34:51.147872
5419	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:34:56.406715
5420	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:01.665577
5421	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:06.925268
5422	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:12.18563
5423	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:17.437492
5424	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:22.704784
5425	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:27.96751
5426	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:33.225944
5427	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:38.492551
5428	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:43.748048
5429	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:49.010958
5430	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:54.273298
5431	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:35:59.56894
5432	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:36:04.825035
5433	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:36:10.079923
5434	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:36:15.334811
5435	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:36:20.625563
5436	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:36:25.990382
5437	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:36:31.24877
5438	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:36:36.538418
5439	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:36:41.791795
5440	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:36:47.055327
5441	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:36:52.315708
5442	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:36:57.679933
5443	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:02.934529
5444	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:08.211662
5445	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:13.468255
5446	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:18.718867
5447	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:23.974828
5448	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:29.240349
5449	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:34.506698
5450	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:36.764735
5451	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:42.019905
5452	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:47.289892
5453	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:52.540772
5454	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:37:57.803511
5455	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:38:03.068941
5456	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:38:08.32637
5457	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:38:13.580127
5458	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:38:18.834873
5459	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:38:24.083021
5460	109	2026-04-23	4401.00000000	4401.00000000	2026-04-23 18:38:29.343479
5461	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:38:34.606671
5462	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:38:39.883673
5463	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:38:45.133844
5464	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:38:50.396617
5465	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:38:55.651711
5466	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:01.042357
5467	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:06.311174
5468	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:11.565525
5469	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:16.823323
5470	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:22.103919
5471	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:27.393355
5472	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:29.531056
5473	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:34.790431
5474	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:40.045457
5475	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:45.345609
5476	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:50.60751
5477	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:39:55.865083
5478	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:40:01.135527
5479	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:40:06.128199
5480	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:40:11.379895
5481	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:40:16.742364
5482	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:40:22.027239
5483	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:40:27.301622
5484	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:40:32.558875
5485	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:40:37.834448
5486	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:40:43.088382
5487	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:40:48.383727
5488	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:01.768966
5489	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:07.025743
5490	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:12.289174
5491	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:12.936033
5492	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:18.190553
5493	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:23.441173
5494	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:28.785709
5495	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:34.046273
5496	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:39.361328
5497	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:44.615453
5498	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:49.926743
5499	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:41:55.188606
5500	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:00.464272
5501	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:05.748473
5502	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:11.030062
5503	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:16.308666
5504	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:21.572852
5505	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:26.840277
5506	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:32.095704
5507	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:37.36815
5508	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:40.256528
5509	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:45.656099
5510	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:51.710362
5511	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:42:56.986579
5512	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:02.279186
5513	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:07.55998
5514	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:12.83038
5515	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:18.574391
5516	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:31.218767
5517	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:33.365232
5518	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:38.671722
5519	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:43.98082
5520	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:49.235489
5521	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:54.487326
5522	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:58.016121
5523	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:43:59.913874
5524	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:00.553237
5525	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:05.709806
5526	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:10.974158
5527	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:16.236047
5528	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:21.501216
5529	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:26.76486
5530	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:32.027913
5531	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:35.0308
5532	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:40.313298
5533	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:45.853165
5534	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:51.116704
5535	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:44:56.405608
5536	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:01.67017
5537	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:06.93715
5538	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:12.210664
5539	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:17.492563
5540	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:22.757364
5541	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:28.075535
5542	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:33.340416
5543	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:38.592638
5544	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:43.857886
5545	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:49.124897
5546	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:54.414657
5547	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:45:59.682731
5548	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:46:04.983569
5549	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:46:10.286205
5550	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:46:15.540509
5551	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:46:20.817474
5552	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:46:26.091242
5553	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:46:26.859143
5554	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:46:32.153209
5555	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:47:02.530288
5556	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:47:07.958624
5557	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:47:13.234162
5558	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:47:18.518096
5559	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:47:23.833297
5560	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:47:29.118784
5561	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:47:34.440393
5562	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:47:39.795507
5563	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:47:45.061422
5564	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:47:50.333095
5565	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:47:56.19388
5566	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:48:07.378145
5567	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:48:12.713033
5568	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:48:18.012578
5569	109	2026-04-23	4681.00000000	4681.00000000	2026-04-23 18:48:23.307557
5570	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:48:28.595526
5571	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:48:33.893287
5572	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:48:39.154849
5573	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:48:44.470376
5574	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:48:49.927494
5575	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:48:55.201032
5576	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:49:00.468979
5577	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:49:05.761149
5578	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:49:11.024527
5579	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:49:16.299485
5580	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:49:29.230531
5581	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:49:50.289988
5582	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:50:03.082747
5583	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:50:08.369626
5584	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:50:13.661033
5585	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:50:18.972214
5586	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:50:24.301113
5587	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:50:29.56645
5588	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:50:34.986586
5589	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:50:40.26277
5590	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:50:45.55077
5591	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:50:50.854214
5592	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:50:56.135307
5593	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:01.407628
5594	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:06.673786
5595	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:11.950048
5596	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:17.219985
5597	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:22.514204
5598	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:27.785554
5599	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:33.035606
5600	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:38.292514
5601	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:43.613495
5602	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:48.919488
5603	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:54.191865
5604	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:51:54.85651
5605	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:00.126504
5606	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:02.35409
5607	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:07.642645
5608	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:09.003564
5609	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:14.288688
5610	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:19.620698
6106	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:49.336427
6107	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:50.444411
6108	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:51.041987
6110	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:56.33644
6111	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:01.625545
6114	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:06.483792
6115	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:06.488724
6118	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:24.136401
6120	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:34.6382
6121	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:39.899961
6122	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:45.161193
6123	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:50.425299
6124	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:55.678418
6125	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:00.947264
6127	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:11.624717
6128	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:16.880281
6134	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:44.378162
6135	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:49.637522
6136	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:54.935224
6154	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:48:29.820325
6155	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:48:35.075393
6156	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:48:40.355239
6157	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:48:45.664281
6158	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:48:50.935973
6167	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:49:38.410091
6168	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:49:39.872511
6170	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:49:55.939375
6171	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:01.224937
6175	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:19.747145
6176	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:25.022615
6178	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:32.983328
6179	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:38.26102
6180	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:43.52181
6181	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:48.776304
6182	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:54.050484
6184	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:04.593569
6186	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:15.124094
6187	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:20.394857
6188	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:25.707039
6189	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:26.127625
6191	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:41.629067
6192	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:46.940978
6193	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:52.230297
6196	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:00.223732
6198	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:08.573645
6200	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:19.118931
6201	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:22.83584
6202	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:24.378583
6203	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:29.642118
6204	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:34.906971
6205	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:38.109754
6206	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:40.188288
6207	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:45.449858
6208	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:50.713804
6209	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:53.374393
6210	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:55.993869
6211	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:01.255729
6212	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:06.5335
6213	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:08.6336
6214	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:11.808372
6215	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:17.063676
6216	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:22.33398
6217	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:23.895941
6218	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:27.618882
6219	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:32.911762
6220	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:38.183345
6221	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:39.168024
6222	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:53:43.451829
6223	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:54:32.121586
6224	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:54:32.64141
6225	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:54:37.424961
6226	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:54:42.694088
6227	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:54:47.958989
6228	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:54:47.998214
6229	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:54:53.231041
6230	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:54:58.504281
6231	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:55:03.309237
6232	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:55:03.761506
6233	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:55:09.0467
6234	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:55:14.329572
6235	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:55:18.984229
6236	106	2026-04-23	12287.00000000	12287.00000000	2026-04-23 19:56:00.052848
6237	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:08.868951
6238	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:14.134559
6239	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:19.395946
6240	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:24.680412
6241	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:29.942148
6242	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:35.207097
6243	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:36.952507
6244	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:40.465006
6245	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:40.654958
6246	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:45.720664
6247	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:47.641118
6248	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:50.983774
6249	106	2026-04-23	17780.00000000	17780.00000000	2026-04-23 19:57:56.241197
6250	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:58:28.578426
6251	109	2026-04-23	7099.00000000	7099.00000000	2026-04-23 19:58:44.00766
6252	109	2026-04-23	7099.00000000	7099.00000000	2026-04-23 19:58:46.870251
6253	109	2026-04-23	7099.00000000	7099.00000000	2026-04-23 19:58:52.213687
6254	109	2026-04-23	7099.00000000	7099.00000000	2026-04-23 19:58:57.479836
6255	109	2026-04-23	7099.00000000	7099.00000000	2026-04-23 19:59:46.295297
6256	109	2026-04-23	7099.00000000	7099.00000000	2026-04-23 19:59:49.18968
6257	109	2026-04-23	7099.00000000	7099.00000000	2026-04-23 20:08:33.81689
6258	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:08:39.11143
6259	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:08:44.379162
6260	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:08:49.633883
6261	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:08:54.903503
6262	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:00.192791
6263	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:05.457899
6264	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:10.742971
6265	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:16.000756
6266	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:21.277508
6267	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:26.531316
6268	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:31.840133
6269	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:37.145685
6270	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:42.458702
6271	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:47.721498
6272	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:53.160264
6273	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:09:58.417887
6274	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:10:03.674112
6275	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:10:08.938523
6276	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:10:14.204628
6277	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:10:19.468449
6278	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:10:24.730216
6279	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:10:29.992214
6280	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:10:35.25647
6281	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:10:40.520522
6282	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:10:45.778841
6283	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:10:51.037749
6284	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:10:56.318271
6285	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:11:11.937318
6286	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:11:17.225043
6287	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:11:22.517711
5611	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:24.914758
5612	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:30.212001
5613	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:35.479876
5614	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:40.752271
5615	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:46.066372
5616	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:52:51.378671
5617	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:53:00.455607
5618	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:53:05.727601
5619	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:53:10.989249
5620	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:53:16.25707
5621	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:55:14.665029
5622	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:55:19.926501
5623	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:55:25.195324
5624	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:55:30.459508
5625	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:55:35.723806
5626	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:55:40.99085
5627	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:55:46.255494
5628	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:55:51.519883
5629	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:55:56.793054
5630	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:56:02.079392
5631	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:56:07.783354
5632	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:56:13.108757
5633	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:56:18.384059
5634	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:58:03.573968
5635	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:58:08.892132
5636	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:58:14.175329
5637	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:58:19.437194
5638	109	2026-04-23	4933.00000000	4933.00000000	2026-04-23 18:58:24.829736
5639	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:58:30.100529
5640	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:58:35.38762
5641	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:58:40.666833
5642	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:58:56.214496
5643	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:01.469536
5644	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:06.755981
5645	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:12.073582
5646	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:17.340092
5647	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:22.618638
5648	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:27.990269
5649	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:33.265666
5650	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:38.538516
5651	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:43.806921
5652	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:49.07523
5653	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:54.345149
5654	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 18:59:59.610905
5655	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:00:04.881426
5656	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:00:10.167777
5657	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:00:15.475387
5658	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:00:20.750746
5659	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:00:26.028501
5660	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:00:31.309993
5661	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:00:36.564225
5662	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:00:41.841273
5663	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:00:47.114915
5664	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:00:52.387591
5665	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:00:57.671139
5666	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:01:02.961486
5667	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:01:08.218256
5668	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:01:13.49738
5669	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:01:18.770012
5670	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:01:24.038572
5671	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:01:29.328573
5672	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:01:34.586384
5673	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:01:39.851938
5674	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:01:45.116916
5675	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:01:50.389957
5676	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:01:55.649346
5677	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:02:00.928904
5678	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:02:06.196763
5679	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:02:11.477114
5680	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:02:16.734899
5681	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:02:22.032381
5682	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:02:27.421686
5683	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:03:16.780277
5684	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:03:22.059381
5685	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:03:33.725066
5686	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:03:39.045256
5687	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:03:44.331502
5688	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:03:49.625944
5689	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:03:54.369678
5690	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:03:59.681339
5691	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:04:04.970264
5692	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:04:10.267091
5693	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:04:15.529661
5694	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:04:20.83047
5695	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:04:26.104592
5696	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:04:31.374911
5697	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:04:36.652537
5698	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:04:41.91734
5699	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:04:47.209704
5700	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:04:52.52574
5701	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:04:57.847722
5702	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:05:03.114092
5703	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:05:08.403065
5704	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:05:13.716108
5705	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:05:19.027486
5706	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:05:24.391531
5707	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:05:49.293213
5708	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:05:54.631906
5709	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:05:59.945204
5710	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:06:05.241759
5711	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:06:10.511305
5712	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:06:15.804611
5713	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:06:21.085513
5714	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:06:41.353245
5715	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:06:46.678042
5716	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:06:51.933634
5717	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:06:57.233813
5718	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:07:02.496892
5719	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:07:07.778088
5720	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:07:13.073287
5721	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:07:18.366967
5722	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:07:23.688594
5723	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:07:28.989841
5724	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:07:34.262238
5725	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:07:39.535361
5726	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:07:44.794638
5727	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:07:50.062927
5728	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:07:55.319328
5729	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:08:00.589736
5730	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:08:05.889055
5731	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:08:14.041972
5732	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:08:19.346969
5733	109	2026-04-23	5391.00000000	5391.00000000	2026-04-23 19:08:24.628304
5734	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:08:29.918875
5735	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:08:35.187912
5736	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:08:40.499534
5737	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:08:45.778571
5738	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:08:51.035515
5739	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:08:56.421135
5740	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:09:01.679153
5741	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:09:06.935528
5742	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:09:12.208383
5743	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:09:53.592382
5744	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:09:58.94274
5745	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:10:04.211533
5746	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:10:09.67772
5747	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:10:14.954543
5748	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:10:20.231813
5749	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:10:25.507475
5750	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:10:30.761704
5751	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:10:36.020805
5752	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:11:06.501829
5753	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:11:11.77326
5754	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:11:17.040346
5755	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:11:22.303962
5756	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:11:27.805683
5757	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:12:30.773928
5758	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:12:43.250203
5759	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:13:15.175122
5760	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:13:20.426236
5761	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:13:25.683929
5762	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:13:30.938486
5763	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:13:36.205623
5764	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:13:41.473263
5765	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:13:46.72762
5766	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:13:51.979744
5767	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:13:57.233855
5768	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:14:02.505923
5769	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:14:07.80254
5770	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:14:13.058872
5771	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:14:18.327209
5772	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:14:23.59869
5773	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:14:28.875627
5774	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:14:34.154237
5775	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:14:39.419889
5776	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:14:44.736937
5777	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:14:50.030347
5778	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:14:55.293586
5779	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:00.569763
5780	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:05.84467
5781	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:11.126316
5782	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:16.409706
5783	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:21.706965
5784	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:26.976249
5785	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:32.263504
5786	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:37.518992
5787	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:42.795818
5788	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:48.089446
5789	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:53.3587
5790	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:15:58.639122
5791	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:16:03.916546
5792	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:16:09.189723
5793	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:16:14.468225
5794	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:16:19.739592
5795	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:16:25.027691
5796	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:16:30.288944
5797	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:16:35.570037
5798	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:16:40.827817
5799	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:16:46.080883
5800	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:16:51.378408
5801	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:16:56.652381
5802	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:01.93533
5803	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:07.200673
5804	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:12.484189
5805	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:17.762715
5806	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:23.027682
5807	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:26.962861
5808	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:32.066136
5809	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:37.325626
5810	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:37.925907
5811	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:43.223157
5812	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:47.411587
5813	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:52.739027
5814	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:17:56.932732
5815	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:18:02.212963
5816	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:18:07.554135
5817	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:18:07.995436
5818	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:18:12.832677
5819	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:18:19.062913
5820	109	2026-04-23	5735.00000000	5735.00000000	2026-04-23 19:18:24.34871
5821	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:18:29.611969
5822	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:18:34.880278
5823	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:18:40.210487
5824	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:18:44.312538
5825	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:18:59.57493
5826	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:19:04.906768
5827	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:19:10.167935
5828	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:19:15.445725
5829	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:19:18.657145
5830	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:19:23.927701
5831	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:19:29.189176
5832	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:19:34.571592
5833	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:19:39.840782
5834	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:19:45.104419
5835	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:19:50.431403
5836	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:19:55.704462
5837	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:00.964487
5838	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:06.221275
5839	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:11.480619
5840	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:16.731622
5841	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:21.991957
5842	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:27.245887
5843	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:32.496144
5844	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:37.793427
5845	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:43.059101
5846	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:48.32785
5847	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:53.596867
5848	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:20:58.871371
5849	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:21:04.127312
5850	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:21:09.401504
5851	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:21:14.668457
5852	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:21:19.93442
5853	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:21:25.200994
5854	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:21:30.464092
5855	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:21:35.714769
5856	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:21:41.010515
5857	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:21:46.274995
5858	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:21:51.526381
5859	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:21:56.782218
5860	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:02.064629
5861	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:07.322455
5862	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:12.587655
5863	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:17.839238
5864	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:23.104658
5865	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:28.36724
5866	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:32.968825
5867	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:38.251979
5868	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:43.565203
5869	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:48.85017
5870	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:54.122234
5871	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:22:59.388325
5872	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:23:04.657997
5873	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:23:09.941965
5874	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:23:15.194124
5875	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:23:20.456882
5876	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:23:25.712399
5877	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:23:31.017646
5878	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:23:36.269183
5879	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:23:41.539403
5880	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:23:46.874242
5881	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:23:52.152673
5882	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:23:57.427746
5883	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:02.705701
5884	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:08.01026
5885	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:13.301264
5886	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:18.596262
5887	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:22.676893
5888	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:28.034929
5889	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:33.320347
5890	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:38.595488
5891	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:43.868267
5892	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:49.201848
5893	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:54.489147
5894	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:24:59.781168
5895	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:25:05.064288
5896	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:25:10.337877
5897	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:25:15.628727
5898	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:25:20.918514
5899	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:25:26.232231
5900	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:25:31.511798
5901	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:25:36.785526
5902	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:25:42.081119
5903	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:25:47.387043
5904	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:25:52.704934
5905	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:25:57.993949
5906	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:26:03.273218
5907	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:26:08.559069
5908	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:26:13.851493
5909	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:26:19.139495
5910	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:26:24.487023
5911	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:26:29.789653
5912	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:26:35.053618
5913	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:26:39.348207
5914	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:26:53.84551
5915	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:26:59.111801
5916	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:27:04.369543
5917	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:27:09.651027
5918	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:27:14.038143
5919	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:27:29.306537
5920	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:27:44.581276
5921	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:27:59.852002
5922	109	2026-04-23	5871.00000000	5871.00000000	2026-04-23 19:28:15.116359
5923	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:28:30.428856
5924	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:28:45.701902
5925	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:28:51.315613
5926	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:29:06.589845
5927	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:29:11.752475
5928	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:29:21.634365
5929	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:29:26.938043
5930	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:29:32.205335
5931	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:29:37.459672
5932	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:29:42.725327
5933	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:29:44.191884
5934	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:29:49.451162
5935	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:29:54.708469
5936	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:00.695779
5937	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:06.027183
5938	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:11.289823
5939	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:16.552602
5940	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:21.817033
5941	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:27.082515
5942	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:32.369838
5943	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:37.634648
5944	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:42.89338
5945	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:48.173422
5946	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:53.435871
5947	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:30:58.340926
5948	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:03.626985
5949	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:08.906372
5950	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:14.283019
5951	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:15.127725
5952	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:25.480524
5953	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:30.758299
5954	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:32.924565
5955	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:38.294599
5956	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:43.563635
5957	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:48.8444
5958	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:54.095789
5959	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:31:59.380197
5960	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:32:04.665063
5961	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:32:09.956781
5962	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:32:15.231287
5963	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:32:20.494661
5964	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:32:25.7818
5965	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:32:31.058967
5966	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:32:36.314145
5967	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:32:41.653648
5968	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:32:46.921379
5969	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:32:52.234881
5970	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:32:57.511982
5971	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:33:02.78292
5972	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:33:08.055842
5973	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:33:13.319812
5974	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:33:18.589146
5975	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:33:23.939182
5976	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:33:29.218066
5977	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:33:34.524905
5978	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:33:39.831639
5979	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:33:45.112864
5980	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:33:50.414591
5981	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:33:55.66589
5982	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:34:00.918907
5983	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:34:06.184879
5984	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:34:09.140219
5985	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:34:19.805795
5986	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:34:25.178298
5987	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:34:26.952007
5988	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:34:32.226872
5989	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:34:37.501023
5990	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:34:42.758695
5991	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:34:57.624314
5992	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:35:00.67849
5993	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:35:05.969134
5994	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:35:11.245542
5995	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:35:16.520294
5996	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:35:21.769691
5997	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:35:27.073089
5998	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:35:32.368651
5999	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:35:37.287597
6000	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:35:47.542504
6001	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:35:49.961997
6002	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:35:55.297334
6003	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:00.572966
6004	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:05.85838
6005	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:11.155695
6006	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:16.449542
6007	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:21.723422
6008	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:27.003246
6009	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:32.265
6010	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:37.538645
6011	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:42.815477
6012	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:48.092028
6013	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:53.459773
6014	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:36:58.722049
6015	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:37:03.990342
6016	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:37:09.266943
6017	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:37:12.769004
6018	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:37:16.904698
6019	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:37:22.044253
6020	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:37:27.32282
6021	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:37:32.611611
6022	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:37:37.984012
6023	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:37:43.246146
6024	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:37:48.506397
6025	109	2026-04-23	6179.00000000	6179.00000000	2026-04-23 19:37:53.78161
6026	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:38:55.149092
6027	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:00.409439
6028	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:05.677918
6029	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:10.957588
6030	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:16.21678
6031	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:21.498372
6032	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:26.780883
6033	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:32.107457
6034	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:37.374414
6035	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:42.638103
6036	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:47.926748
6037	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:53.179404
6038	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:39:58.430453
6039	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:03.691577
6040	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:08.987123
6041	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:14.261208
6042	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:19.538043
6043	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:24.806693
6044	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:26.940749
6045	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:32.19679
6046	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:37.44798
6047	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:42.703397
6048	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:47.982253
6049	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:53.315385
6050	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:40:58.570388
6051	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:03.822982
6052	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:08.645596
6053	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:13.969705
6054	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:15.883829
6055	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:21.141281
6056	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:28.218724
6057	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:29.043961
6058	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:30.734409
6059	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:34.476413
6060	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:39.693951
6061	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:44.976514
6062	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:45.329231
6063	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:50.601885
6064	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:41:55.876689
6065	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:01.132993
6066	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:06.438003
6067	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:11.713833
6068	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:16.962118
6069	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:22.223107
6070	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:27.535588
6071	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:32.786883
6072	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:38.044459
6073	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:43.321006
6074	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:46.100924
6075	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:47.003841
6076	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:49.312341
6077	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:54.561151
6078	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:42:59.858176
6079	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:02.27885
6080	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:05.157957
6081	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:10.413273
6082	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:15.69336
6083	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:17.55195
6084	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:20.946438
6085	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:26.215182
6086	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:31.492233
6087	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:32.815498
6088	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:36.750228
6089	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:42.022188
6090	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:47.291676
6091	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:48.065734
6092	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:52.559865
6093	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:43:57.825982
6094	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:03.098751
6095	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:03.318163
6096	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:08.374669
6097	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:13.640382
6098	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:18.564278
6099	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:18.895263
6100	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:24.164379
6101	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:29.416548
6102	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:33.829461
6103	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:34.672086
6104	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:39.93499
6105	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:45.190215
6109	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:44:51.053712
6112	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:02.888293
6113	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:03.416749
6116	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:08.843396
6117	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:12.181345
6119	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:45:29.408244
6126	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:06.229349
6129	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:18.794362
6130	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:24.041052
6131	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:28.495532
6132	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:33.831575
6133	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:46:39.114747
6137	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:00.21515
6138	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:05.519636
6139	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:10.801279
6140	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:16.072562
6141	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:21.375376
6142	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:26.64681
6143	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:31.895807
6144	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:37.156333
6145	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:42.435689
6146	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:47.687814
6147	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:52.96415
6148	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:47:58.223827
6149	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:48:03.485661
6150	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:48:08.7568
6151	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:48:14.022365
6152	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:48:19.30229
6153	109	2026-04-23	6300.00000000	6300.00000000	2026-04-23 19:48:24.548539
6159	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:48:56.208571
6160	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:49:01.466026
6161	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:49:06.731868
6162	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:49:11.997392
6163	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:49:17.263133
6164	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:49:22.56575
6165	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:49:27.84391
6166	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:49:33.121479
6169	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:49:50.600852
6172	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:06.539551
6173	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:11.816573
6174	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:17.076943
6177	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:27.662974
6183	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:50:59.323653
6185	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:09.85583
6190	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:36.32649
6194	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:52.801949
6195	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:51:58.108145
6197	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:03.277464
6199	109	2026-04-23	6683.00000000	6683.00000000	2026-04-23 19:52:13.850906
6288	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:11:27.774655
6289	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:11:33.065107
6290	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:11:39.329653
6291	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:12:15.130733
6292	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:12:20.411164
6293	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:12:25.686273
6294	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:12:30.981316
6295	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:12:36.267609
6296	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:12:41.541256
6297	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:12:46.825012
6298	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:12:52.868948
6299	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:12:58.179475
6300	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:13:03.493864
6301	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:13:08.810285
6302	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:13:14.082835
6303	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:13:19.407782
6304	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:13:24.680805
6305	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:13:29.958241
6306	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:13:40.99615
6307	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:13:46.274759
6308	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:13:51.54412
6309	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:13:56.815236
6310	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:14:02.167271
6311	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:14:07.439731
6312	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:14:12.713892
6313	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:14:18.123176
6314	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:14:23.429848
6315	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:14:28.74927
6316	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:14:34.068246
6317	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:14:39.404149
6318	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:14:44.738815
6319	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:14:50.162582
6320	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:14:55.55066
6321	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:00.914816
6322	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:06.208461
6323	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:11.499802
6324	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:16.795384
6325	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:22.079274
6326	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:27.363643
6327	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:32.6506
6328	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:37.933516
6329	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:43.216811
6330	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:48.502516
6331	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:53.787324
6332	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:15:59.064654
6333	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:16:04.339456
6334	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:16:09.61096
6335	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:16:14.871893
6336	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:16:20.163146
6337	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:16:25.445896
6338	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:16:30.715894
6339	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:16:36.013795
6340	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:17:49.925392
6341	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:17:55.226766
6342	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:18:00.513937
6343	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:18:05.778263
6344	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:18:11.053907
6345	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:18:16.326827
6346	109	2026-04-23	7439.00000000	7439.00000000	2026-04-23 20:18:21.61797
6347	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:18:26.871897
6348	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:18:32.167808
6349	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:18:37.421872
6350	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:18:42.692715
6351	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:18:48.000805
6352	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:18:53.262314
6353	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:19:58.537875
6354	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:20:03.813038
6355	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:20:09.083528
6356	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:20:15.633554
6357	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:20:20.903356
6358	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:20:26.167635
6359	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:20:31.419785
6360	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:20:36.678159
6361	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:20:41.952369
6362	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:20:47.229026
6363	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:20:52.530525
6364	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:20:57.821236
6365	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:21:03.080596
6366	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:21:08.371703
6367	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:21:13.634702
6368	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:21:18.90843
6369	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:21:24.183557
6370	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:21:29.436925
6371	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:21:34.707127
6372	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:21:39.953603
6373	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:22:15.303372
6374	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:22:20.58232
6375	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:22:25.838754
6376	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:22:31.11102
6377	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:22:36.406909
6378	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:22:41.655449
6379	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:22:46.928571
6380	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:22:52.209181
6381	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:22:57.488338
6382	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:23:02.750065
6383	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:23:08.034265
6384	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:23:13.294463
6385	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:23:18.652744
6386	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:23:23.899842
6387	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:23:29.155191
6388	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:23:34.410604
6389	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:23:39.656979
6390	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:23:44.910881
6391	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:23:50.184927
6392	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:23:55.439152
6393	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:24:00.716415
6394	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:24:06.0022
6395	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:24:11.300982
6396	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:24:16.585166
6397	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:25:54.905432
6398	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:00.190882
6399	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:05.529576
6400	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:10.837934
6401	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:16.162893
6402	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:21.41584
6403	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:26.688564
6404	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:32.00258
6405	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:37.278399
6406	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:42.529793
6407	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:47.807269
6408	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:53.11727
6409	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:26:58.365006
6410	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:27:03.641299
6411	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:27:08.91949
6412	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:27:14.203294
6413	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:27:19.479991
6414	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:27:24.966411
6415	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:27:30.25042
6416	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:27:35.512226
6417	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:27:40.784947
6418	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:27:46.075143
6419	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:27:51.327921
6420	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:27:56.598961
6421	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:28:01.856738
6422	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:28:07.20789
6423	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:28:12.492638
6424	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:28:17.753863
6425	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:28:23.054297
6426	109	2026-04-23	7800.00000000	7800.00000000	2026-04-23 20:28:28.3009
6427	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:28:33.56009
6428	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:28:38.829342
6429	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:28:44.080199
6430	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:28:49.340282
6431	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:28:54.586377
6432	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:28:59.836034
6433	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:29:35.093593
6434	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:29:40.420032
6435	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:29:45.670064
6436	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:29:50.951324
6437	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:29:56.196896
6438	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:01.475838
6439	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:06.763858
6440	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:12.016565
6441	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:17.289332
6442	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:22.566575
6443	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:27.849697
6444	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:33.168021
6445	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:38.447759
6446	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:43.710015
6447	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:48.963273
6448	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:54.241521
6449	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:30:59.569606
6450	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:31:04.841174
6451	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:31:10.164648
6452	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:31:15.450888
6453	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:31:20.727469
6454	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:31:26.007535
6455	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:31:31.291829
6456	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:31:36.600146
6457	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:31:41.896572
6458	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:31:47.160582
6459	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:31:52.427047
6460	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:31:57.680793
6461	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:32:03.030035
6462	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:32:08.296773
6463	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:32:13.575358
6464	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:32:18.895638
6465	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:32:24.162687
6466	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:32:29.461398
6467	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:32:34.743923
6468	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:32:40.024435
6469	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:32:45.296205
6470	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:32:50.573616
6471	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:32:55.856169
6472	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:01.158035
6473	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:06.449968
6474	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:11.749436
6475	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:17.06985
6476	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:22.331814
6477	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:27.59957
6478	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:32.912235
6479	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:38.213147
6480	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:43.476006
6481	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:48.739266
6482	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:54.002983
6483	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:33:59.30705
6484	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:36:40.565772
6485	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:36:45.882954
6486	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:36:51.164755
6487	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:36:56.45151
6488	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:37:01.722296
6489	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:37:06.993606
6490	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:37:12.285747
6491	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:37:17.571181
6492	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:37:22.855236
6493	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:37:28.110698
6494	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:37:33.391833
6495	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:37:48.673324
6496	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:37:59.394377
6497	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:38:04.668337
6498	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:38:09.972799
6499	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:38:15.254058
6500	109	2026-04-23	8053.00000000	8053.00000000	2026-04-23 20:38:20.540159
6501	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:38:37.17626
6502	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:38:42.465266
6503	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:38:47.765378
6504	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:38:53.017655
6505	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:38:58.272906
6506	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:39:03.553436
6507	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:39:08.86412
6508	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:39:14.119836
6509	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:39:19.397834
6510	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:39:24.66021
6511	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:39:29.953399
6512	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:39:35.215921
6513	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:39:40.468929
6514	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:39:45.743283
6515	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:39:50.993751
6516	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:39:56.244508
6517	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:01.500048
6518	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:06.769435
6519	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:12.03434
6520	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:17.485334
6521	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:22.740617
6522	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:27.999047
6523	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:33.254499
6524	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:38.508756
6525	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:43.777961
6526	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:49.041628
6527	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:54.313218
6528	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:40:59.565798
6529	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:41:04.817142
6530	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:41:10.089539
6531	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:41:15.347425
6532	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:41:20.609955
6533	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:41:56.276455
6534	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:42:01.595647
6535	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:42:06.919753
6536	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:42:12.216935
6537	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:42:17.492543
6538	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:42:22.784036
6539	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:42:28.042354
6540	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:42:33.313897
6541	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:42:38.585462
6542	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:42:43.8476
6543	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:42:49.845527
6544	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:42:58.176426
6545	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:43:03.451759
6546	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:43:08.714424
6547	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:43:13.972965
6548	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:43:19.225434
6549	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:43:24.489374
6550	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:43:29.773018
6551	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:43:35.026175
6552	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:43:40.275246
6553	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:43:45.526554
6554	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:43:50.774639
6555	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:43:56.029833
6556	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:44:01.292984
6557	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:44:06.547249
6558	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:44:11.811245
6559	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:44:17.076187
6560	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:44:22.397565
6561	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:44:27.661975
6562	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:44:32.947458
6563	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:44:38.219142
6564	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:44:43.491463
6565	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:44:48.766504
6566	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:45:50.178767
6567	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:45:55.452949
6568	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:00.733349
6569	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:06.023631
6570	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:11.314211
6571	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:16.598168
6572	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:21.859389
6573	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:27.121849
6574	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:32.400754
6575	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:37.666924
6576	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:42.964316
6577	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:48.249478
6578	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:53.519671
6579	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:46:58.800403
6580	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:47:04.050606
6581	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:47:09.32178
6582	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:47:14.589776
6583	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:47:19.849998
6584	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:47:25.100454
6585	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:47:30.404395
6586	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:47:35.696434
6587	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:47:40.974065
6588	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:47:46.271117
6589	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:47:51.534625
6590	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:47:56.808031
6591	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:48:02.185858
6592	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:48:07.47736
6593	109	2026-04-23	8399.00000000	8399.00000000	2026-04-23 20:48:12.737447
6594	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:48:58.823529
6595	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:49:20.035226
6596	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:49:25.32185
6597	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:49:30.600337
6598	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:49:35.992533
6599	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:50:18.900873
6600	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:50:24.173134
6601	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:50:29.452422
6602	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:50:34.706028
6603	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:50:39.978682
6604	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:50:45.236163
6605	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:50:50.508997
6606	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:50:55.770022
6607	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:51:01.021686
6608	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:51:06.294708
6609	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:51:11.599191
6610	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:51:16.851714
6611	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:51:22.104719
6612	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:51:27.362962
6613	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:51:32.626816
6614	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:51:37.90742
6615	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:51:43.163178
6616	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:51:48.435256
6617	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:53:18.012967
6618	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:53:23.624058
6619	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:53:28.898975
6620	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:53:34.16499
6621	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:53:39.416127
6622	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:53:44.666866
6623	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:53:49.918319
6624	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:53:55.180996
6625	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:00.436215
6626	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:05.704219
6627	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:10.969359
6628	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:16.225549
6629	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:21.494739
6630	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:26.756207
6631	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:32.074398
6632	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:37.336815
6633	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:42.588879
6634	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:47.89959
6635	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:53.167005
6636	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:54:58.418943
6637	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:55:03.671324
6638	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:55:08.935712
6639	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:55:14.189821
6640	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:55:19.449296
6641	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:55:24.702023
6642	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:55:56.632986
6643	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:01.952612
6644	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:07.201461
6645	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:12.46048
6646	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:17.762258
6647	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:23.061292
6648	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:28.335207
6649	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:33.599471
6650	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:38.905494
6651	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:44.166492
6652	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:49.428299
6653	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:54.685416
6654	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:56:59.950342
6655	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:57:05.210121
6656	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:57:10.478175
6657	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:57:15.735817
6658	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:57:20.994083
6659	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:57:26.27352
6660	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:57:31.534591
6661	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:57:36.829935
6662	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:57:42.098497
6663	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:57:50.867605
6664	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:57:56.147393
6665	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:58:01.451796
6666	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:58:06.709849
6667	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:58:12.004152
6668	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:58:17.265434
6669	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:58:22.537714
6670	109	2026-04-23	8542.00000000	8542.00000000	2026-04-23 20:58:27.797052
6671	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:58:33.050424
6672	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:58:38.302215
6673	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:58:43.556761
6674	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:59:11.763746
6675	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:59:17.017946
6676	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:59:22.266421
6677	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:59:27.52177
6678	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:59:32.77901
6679	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:59:38.0294
6680	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:59:43.282694
6681	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:59:48.547193
6682	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:59:53.820323
6683	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 20:59:59.083056
6684	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:00:04.353658
6685	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:00:09.615178
6686	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:00:14.916368
6687	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:00:20.223174
6688	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:00:25.492426
6689	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:00:30.757266
6690	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:00:36.019151
6691	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:00:41.281378
6692	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:00:46.537303
6693	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:00:51.802717
6694	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:00:57.068316
6695	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:01:02.334812
6696	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:01:07.609302
6697	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:01:12.887695
6698	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:01:18.15185
6699	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:01:23.410272
6700	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:01:28.666574
6701	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:01:33.94885
6702	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:01:39.202759
6703	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:01:44.458778
6704	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:01:49.742514
6705	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:01:55.002641
6706	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:02:00.258152
6707	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:02:05.512935
6708	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:02:10.776798
6709	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:02:18.463116
6710	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:02:23.721029
6711	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:02:29.086807
6712	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:02:34.364023
6713	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:02:39.617391
6714	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:02:51.985455
6715	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:02:57.247985
6716	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:03:02.51182
6717	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:03:07.771874
6718	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:03:13.019697
6719	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:03:18.279918
6720	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:03:23.537904
6721	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:03:28.813238
6722	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:03:34.065547
6723	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:03:39.317626
6724	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:03:44.567381
6725	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:03:49.829911
6726	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:03:55.093406
6727	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:04:03.512311
6728	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:04:08.813212
6729	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:04:14.067587
6730	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:04:19.319533
6731	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:04:24.568642
6732	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:05:28.435215
6733	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:05:33.809791
6734	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:05:38.879588
6735	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:05:44.17561
6736	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:08:23.049431
6737	109	2026-04-23	8703.00000000	8703.00000000	2026-04-23 21:08:39.142645
6738	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:08:44.927728
6739	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:08:50.343561
6740	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:08:58.913347
6741	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:09:04.209251
6742	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:09:09.486549
6743	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:09:14.765323
6744	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:09:20.03122
6745	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:09:25.33692
6746	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:09:30.60946
6747	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:09:35.86518
6748	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:09:41.114656
6749	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:09:46.389456
6750	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:10:22.562905
6751	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:10:27.902894
6752	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:10:33.154558
6753	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:10:38.418988
6754	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:10:43.670559
6755	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:10:48.94473
6756	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:10:54.194623
6757	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:11:10.806835
6758	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:11:16.100786
6759	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:11:21.35305
6760	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:11:26.613164
6761	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:11:31.861064
6762	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:11:37.123026
6763	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:11:42.435339
6764	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:11:47.725951
6765	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:11:53.321504
6766	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:11:58.786541
6767	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:12:04.052634
6768	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:12:09.329159
6769	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:12:14.593508
6770	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:12:24.919014
6771	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:12:30.19647
6772	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:12:35.461869
6773	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:12:40.766877
6774	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:12:46.146715
6775	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:12:51.631647
6776	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:12:56.909663
6777	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:13:02.181946
6778	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:13:07.455742
6779	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:13:12.742044
6780	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:13:18.002979
6781	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:13:23.283739
6782	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:13:28.561978
6783	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:13:33.842443
6784	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:13:39.124634
6785	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:13:44.416158
6786	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:14:14.198918
6787	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:14:19.621438
6788	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:14:24.979879
6789	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:14:30.241972
6790	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:14:35.529828
6791	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:14:40.805804
6792	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:14:46.074856
6793	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:14:51.329822
6794	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:14:56.594873
6795	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:15:01.855203
6796	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:16:07.625095
6797	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:16:12.924045
6798	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:16:18.228465
6799	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:16:27.295164
6800	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:17:15.010339
6801	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:17:20.386095
6802	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:17:24.865684
6803	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:17:30.152531
6804	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:17:35.441066
6805	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:17:38.390502
6806	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:17:43.614027
6807	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:17:48.916525
6808	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:17:51.779035
6809	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:17:57.150278
6810	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:18:00.651135
6811	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:18:05.941381
6812	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:18:11.278728
6813	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:18:16.583124
6814	109	2026-04-23	9103.00000000	9103.00000000	2026-04-23 21:18:21.876236
6815	109	2026-04-23	9308.00000000	9308.00000000	2026-04-23 21:18:27.164935
6816	109	2026-04-23	9308.00000000	9308.00000000	2026-04-23 21:18:32.451557
6817	109	2026-04-23	9308.00000000	9308.00000000	2026-04-23 21:18:34.5412
6818	109	2026-04-23	9308.00000000	9308.00000000	2026-04-23 21:28:03.170031
\.


--
-- Data for Name: fraud_flags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fraud_flags (id, user_id, flag_type, severity, details, is_resolved, resolved_at, resolved_note, created_at) FROM stdin;
17	107	multi_account	medium	{"ip":"122.161.75.161","sharedWithUserIds":[106],"windowDays":7}	f	\N	\N	2026-04-23 08:43:55.998815
18	106	multi_account	medium	{"ip":"122.161.75.161","sharedWithUserIds":[107],"windowDays":7}	f	\N	\N	2026-04-23 08:43:56.01359
19	108	multi_account	medium	{"ip":"122.161.75.161","sharedWithUserIds":[106,107],"windowDays":7}	f	\N	\N	2026-04-23 08:45:07.135254
20	108	device_cluster	medium	{"fingerprint":"9319cb88ccf0deae","sharedWithUserIds":[107,106],"accountCount":3}	f	\N	\N	2026-04-23 08:45:07.147092
21	106	device_cluster	medium	{"fingerprint":"9319cb88ccf0deae","sharedWithUserIds":[108,107],"accountCount":3}	f	\N	\N	2026-04-23 09:31:52.335387
22	109	multi_account	medium	{"ip":"157.49.16.118","sharedWithUserIds":[106],"windowDays":7}	f	\N	\N	2026-04-23 16:07:49.213148
23	109	device_cluster	medium	{"fingerprint":"9319cb88ccf0deae","sharedWithUserIds":[107,108,106],"accountCount":4}	f	\N	\N	2026-04-23 16:07:49.220899
24	1	multi_account	medium	{"ip":"122.161.66.137","sharedWithUserIds":[106,109],"windowDays":7}	f	\N	\N	2026-04-23 20:48:34.589359
25	1	device_cluster	medium	{"fingerprint":"4cbc8039bc8d8bad","sharedWithUserIds":[106,109],"accountCount":3}	f	\N	\N	2026-04-23 20:48:34.589699
\.


--
-- Data for Name: gl_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.gl_accounts (id, code, name, account_type, normal_balance, user_id, is_system, created_at) FROM stdin;
1441	platform:usdt_pool	Platform USDT Pool	asset	debit	\N	t	2026-04-22 09:04:40.992323
1442	platform:user_liability	Aggregate User Liability	liability	credit	\N	t	2026-04-22 09:04:41.049104
1443	platform:fee_revenue	Platform Fee Revenue	revenue	credit	\N	t	2026-04-22 09:04:41.061316
1444	platform:profit_expense	Daily Profit Distributed	expense	debit	\N	t	2026-04-22 09:04:41.064391
1445	platform:referral_expense	Referral Bonuses Paid	expense	debit	\N	t	2026-04-22 09:04:41.066872
1446	platform:hot_wallet	Hot Wallet (On-Chain)	asset	debit	\N	t	2026-04-22 09:04:41.070038
1447	platform:cold_wallet	Cold Wallet (Reserve)	asset	debit	\N	t	2026-04-22 09:04:41.073264
1448	platform:pending_deposits	Pending Deposits (In-Flight)	asset	debit	\N	t	2026-04-22 09:04:41.076345
1449	platform:pending_withdrawals	Pending Withdrawals (Held)	liability	credit	\N	t	2026-04-22 09:04:41.07955
\.


--
-- Data for Name: investments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.investments (id, user_id, amount, risk_level, is_active, is_paused, auto_compound, total_profit, daily_profit, drawdown, drawdown_limit, peak_balance, started_at, stopped_at, paused_at) FROM stdin;
109	107	0.00000000	low	f	f	f	0.00000000	0.00000000	0.00000000	5.00	0.00000000	\N	\N	\N
110	108	0.00000000	low	f	f	f	0.00000000	0.00000000	0.00000000	5.00	0.00000000	\N	\N	\N
108	106	500.00000000	low	t	f	f	28.00000000	2.50000000	0.85000000	5.00	528.00000000	2026-04-13 14:28:56.363929	\N	\N
111	109	0.00000000	low	f	f	f	0.00000000	0.00000000	0.00000000	5.00	0.00000000	\N	\N	\N
\.


--
-- Data for Name: ip_signups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ip_signups (id, ip_address, user_id, created_at) FROM stdin;
5	223.177.130.20	106	2026-04-22 09:22:03.693414
6	122.161.75.161	107	2026-04-23 08:43:55.983279
7	122.161.75.161	108	2026-04-23 08:45:07.121045
8	157.49.16.118	109	2026-04-23 16:07:49.200155
\.


--
-- Data for Name: ledger_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ledger_entries (id, journal_id, transaction_id, account_id, account_code, entry_type, amount, currency, description, created_at) FROM stdin;
\.


--
-- Data for Name: login_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.login_events (id, user_id, ip_address, user_agent, device_fingerprint, event_type, created_at) FROM stdin;
21	106	223.177.130.20	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	9319cb88ccf0deae	register	2026-04-22 09:22:03.697107
22	106	122.161.75.161	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	9319cb88ccf0deae	login	2026-04-23 08:13:39.121965
23	107	122.161.75.161	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	9319cb88ccf0deae	register	2026-04-23 08:43:55.988165
24	108	122.161.75.161	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	9319cb88ccf0deae	register	2026-04-23 08:45:07.128994
25	106	157.49.16.118	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	9319cb88ccf0deae	login	2026-04-23 09:31:52.03908
26	106	157.49.16.118	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	9319cb88ccf0deae	login	2026-04-23 09:44:17.301921
27	106	157.49.16.118	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	9319cb88ccf0deae	login	2026-04-23 12:55:36.829713
28	106	157.49.16.118	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	9319cb88ccf0deae	login	2026-04-23 13:27:50.663405
29	106	157.49.16.118	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	9319cb88ccf0deae	login	2026-04-23 13:28:50.020679
30	109	157.49.16.118	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	9319cb88ccf0deae	register	2026-04-23 16:07:49.207774
31	109	122.161.66.137	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	4cbc8039bc8d8bad	login	2026-04-23 16:29:57.366701
32	106	122.161.66.137	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	4cbc8039bc8d8bad	login	2026-04-23 19:55:59.632243
33	109	122.161.66.137	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	4cbc8039bc8d8bad	login	2026-04-23 19:58:28.216306
34	1	122.161.66.137	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	4cbc8039bc8d8bad	login	2026-04-23 20:48:34.551128
\.


--
-- Data for Name: monthly_performance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.monthly_performance (id, user_id, year_month, monthly_return, max_drawdown, win_rate, total_profit, trading_days, winning_days, start_equity, peak_equity, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, message, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: pnl_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pnl_history (id, user_id, date, percent, amount) FROM stdin;
3602	109	2026-04-23	0.5626	0.00
1	106	2026-04-23	0.4253	4.45
\.


--
-- Data for Name: points_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.points_transactions (id, user_id, amount, type, description, reference_id, created_at) FROM stdin;
5	106	25	task_reward	Email verification bonus	\N	2026-04-22 09:22:44.57493
6	108	25	task_reward	Email verification bonus	\N	2026-04-23 08:45:24.19058
7	109	25	task_reward	Email verification bonus	\N	2026-04-23 16:08:25.328713
\.


--
-- Data for Name: promo_redemptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promo_redemptions (id, user_id, code, status, bonus_percent, bonus_amount, deposit_id, issued_at, redeemed_at, credited_at) FROM stdin;
\.


--
-- Data for Name: report_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.report_verifications (id, hash_id, user_id, year_month, monthly_return, max_drawdown, win_rate, total_profit, trading_days, winning_days, start_equity, peak_equity, content_hash, generated_at) FROM stdin;
\.


--
-- Data for Name: signal_trade_audit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.signal_trade_audit (id, trade_id, action, actor_user_id, details, created_at) FROM stdin;
\.


--
-- Data for Name: signal_trade_distributions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.signal_trade_distributions (id, trade_id, user_id, share_basis, profit_amount, created_at, swept_at) FROM stdin;
\.


--
-- Data for Name: signal_trades; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.signal_trades (id, pair, direction, entry_price, pips_target, pip_size, exit_price, expected_profit_percent, realized_profit_percent, realized_exit_price, status, close_reason, notes, total_distributed, affected_users, idempotency_key, created_by, created_at, closed_at, tp_price, sl_price, scheduled_at) FROM stdin;
1	XAUUSD	BUY	2380.50000	50.00	0.010000	2381.00000	1.5000	1.5000	2381.00000	closed	target_hit	\N	311.85000000	50	trade:8c01d839-d0fe-4fb1-8c59-8ba1094a9216	1	2026-04-20 14:20:34.08956	2026-04-20 14:20:34.496	\N	\N	\N
2	EURUSD	SELL	1.08500	20.00	0.000100	1.08300	0.5000	0.5000	1.08300	closed	target_hit	\N	103.95000000	50	trade:715977c4-08e1-4d2c-8bef-57935c2ac389	1	2026-04-20 14:22:46.428005	2026-04-20 14:22:46.838	\N	\N	\N
3	XAUUSD	BUY	2380.00000	500.00	0.010000	2385.00000	2.0000	2.0000	2385.00000	closed	target_hit	\N	415.80000000	50	trade:b0fc7bef-63bf-4aad-9bf6-7e4b8a012c4c	1	2026-04-20 14:37:38.017537	2026-04-20 14:37:38.427	2385.00000	2378.00000	\N
4	EURUSD	SELL	1.08500	20.00	0.000100	1.08300	1.0000	\N	\N	closing	\N	\N	0.00000000	0	trade:c9b8cdad-1632-41b1-9b17-ef954230345e	1	2026-04-20 14:37:39.035565	\N	1.08300	1.08600	\N
5	EURUSD	BUY	1.08500	20.00	0.000100	1.08700	1.0000	-0.5000	1.08400	closed	stop_loss	\N	-103.95000000	50	trade:793c8ff5-8c2a-4163-b022-78a17a5105a9	1	2026-04-20 14:38:18.159133	2026-04-20 14:38:18.665	1.08700	1.08400	\N
6	XAUUSD	BUY	2400.00000	500.00	0.010000	2405.00000	2.0000	2.0000	2405.00000	closed	target_hit	\N	415.80000000	50	trade:cf3f3020-2486-42db-8ba4-d2138015939e	1	2026-04-20 14:40:37.97125	2026-04-20 14:40:38.365	2405.00000	2398.00000	\N
7	BTCUSD	BUY	65000.00000	500.00	1.000000	65500.00000	1.5000	1.5000	65500.00000	closed	target_hit	\N	311.85000000	50	trade:9d21ec63-3eb1-4912-bf0c-4f223473bc52	1	2026-04-20 14:47:08.331143	2026-04-20 14:55:43.297	65500.00000	64800.00000	\N
8	XAUUSD	SELL	4812.00000	500.00	0.010000	4807.00000	50.0000	50.0000	4807.00000	closed	target_hit	\N	10395.00000000	50	trade:92094cab-21ce-49a7-a679-64af727a5329	1	2026-04-20 14:55:28.744302	2026-04-20 15:00:05.144	4807.00000	4814.00000	\N
9	XAUUSD	BUY	2400.00000	1000.00	0.010000	2410.00000	120.0000	120.0000	2410.00000	closed	target_hit	\N	24948.00000000	50	trade:f4d2c334-35e2-4afe-bbc8-003c190d0622	1	2026-04-20 15:07:49.131712	2026-04-20 15:16:17.174	2410.00000	2398.00000	\N
10	XAUUSD	BUY	2400.00000	1000.00	0.010000	2410.00000	3.0000	3.0000	2410.00000	closed	target_hit	\N	623.70000000	50	trade:b269b71a-b8cf-46dc-9387-5ac32d57b18e	1	2026-04-20 15:19:35.428841	2026-04-20 15:19:36.075	2410.00000	2395.00000	\N
11	EURUSD	BUY	1.08500	50.00	0.000100	1.09000	2.0000	2.0000	1.09000	closed	target_hit	\N	415.80000000	50	trade:e6dc0640-7b87-4d47-a989-06b8e75541ae	1	2026-04-20 15:26:10.333602	2026-04-20 15:26:11.016	1.09000	1.08200	\N
13	XAUUSD	BUY	4792.00000	300.00	0.010000	4795.00000	30.0000	0.1000	4795.00000	closed	manual	\N	21.09000000	52	trade:11cab986-fefa-4135-86a9-a626bb6b2818	1	2026-04-20 15:49:59.37958	2026-04-20 15:50:44.276	4795.00000	4788.00000	2026-04-20 21:19:00
12	XAUUSD	BUY	4790.00000	1000.00	0.010000	4800.00000	100.0000	0.3000	4800.00000	closed	manual	\N	63.27000000	52	trade:7afcc0cf-98d9-47dd-88a9-de687b8204c9	1	2026-04-20 15:47:40.965961	2026-04-20 15:50:47.232	4800.00000	4785.00000	2026-04-20 21:16:00
14	XAUUSD	BUY	2400.00000	1000.00	0.010000	2410.00000	0.4167	0.2500	2410.00000	closed	manual	\N	52.72500000	52	trade:fd0643c7-8556-4d1c-b113-2c73225f190b	1	2026-04-20 15:55:59.279272	2026-04-20 15:56:00.09	2410.00000	2395.00000	\N
15	BTCUSD	BUY	75100.00000	380.00	1.000000	75480.00000	0.5060	0.5060	75480.00000	closed	target_hit	\N	106.71540000	52	trade:13da0334-4fae-4f6f-8aac-bd5ca12eb1a6	1	2026-04-20 16:24:14.322288	2026-04-20 16:25:01.422	75480.00000	75000.00000	2026-04-20 21:53:00
16	XAUUSD	SELL	4799.00000	900.00	0.010000	4790.00000	0.1875	0.1875	4790.00000	closed	target_hit	\N	39.54375000	52	trade:3a8b2932-2716-4b00-b32e-77235c976206	1	2026-04-20 16:59:59.381697	2026-04-20 18:02:38.019	4790.00000	4802.00000	2026-04-20 22:29:00
17	XAUUSD	SELL	4820.00000	2000.00	0.010000	4800.00000	0.4149	0.4149	4800.00000	closed	target_hit	\N	87.66647705	52	trade:e3beaec6-f4de-4e30-942b-84fe7c5190a7	1	2026-04-20 18:03:23.322562	2026-04-20 18:03:30.567	4800.00000	4825.00000	2026-04-20 23:33:00
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (id, key, value, updated_at) FROM stdin;
910	baseline_total_profit	264600.66	2026-04-23 12:45:30.142917
2	test_report	{"timestamp":"2026-04-20T15:14:20.398Z","durationMs":285,"summary":{"total":23,"passed":23,"failed":0,"warnings":0},"categories":[{"name":"Deposit Engine","icon":"ArrowDownToLine","tests":[{"name":"Deposit — small ($10)","status":"passed","detail":"Deposited $10 to user #54 → tx #644","durationMs":89},{"name":"Deposit — medium ($100)","status":"passed","detail":"Deposited $100 to user #53 → tx #645","durationMs":9},{"name":"Deposit — large ($500)","status":"passed","detail":"Deposited $500 to user #60 → tx #646","durationMs":9},{"name":"Multiple deposits — same user","status":"passed","detail":"3 deposits of $50 for user #53: txIds=647,648,649","durationMs":31},{"name":"Duplicate credit prevention","status":"passed","detail":"Unique tx hashes enforced; wallet balance $257.00 consistent with 5 deposits","durationMs":1}]},{"name":"Profit Engine","icon":"TrendingUp","tests":[{"name":"Profit engine — Positive day (1.2%)","status":"passed","detail":"Processed 0/0 investments; 0 errors; rate=1.2%","durationMs":0},{"name":"Profit engine — Zero day (0%)","status":"passed","detail":"Processed 0/0 investments; 0 errors; rate=0%","durationMs":0},{"name":"Profit engine — Negative day (simulated cap)","status":"passed","detail":"Processed 0/0 investments; 0 errors; rate=-0.5%","durationMs":0},{"name":"Rounding error check","status":"passed","detail":"All profit calculations within 6 decimal precision","durationMs":0}]},{"name":"Withdrawal Flow","icon":"ArrowUpFromLine","tests":[{"name":"Insufficient balance rejection","status":"passed","detail":"Withdrawal of $99999.00 blocked — balance only $0.00 (validated by API schema checks)","durationMs":0},{"name":"Withdrawal status tracking","status":"passed","detail":"0 pending withdrawals in queue, each tracked individually by transaction ID","durationMs":3}]},{"name":"Security","icon":"Shield","tests":[{"name":"Rate limiting (login endpoint)","status":"passed","detail":"Rate limiter configured: max 20 attempts/15min window via express-rate-limit middleware","durationMs":0},{"name":"Session invalidation on force-logout","status":"passed","detail":"forceLogoutAfter set to 2026-04-20T15:14:20.263Z for user #53 — existing JWT tokens rejected","durationMs":8},{"name":"Admin IP whitelist enforcement","status":"passed","detail":"adminMiddleware checks admin_ip_whitelist system setting on every admin request; bypass blocked at middleware level","durationMs":0},{"name":"JWT secret strength","status":"passed","detail":"JWT_SECRET is 88 chars — strong (≥32 recommended). Signed with HS256.","durationMs":0},{"name":"Account freeze mechanism","status":"passed","detail":"isFrozen flag blocks non-admin logins at authMiddleware layer; admins are exempt from freeze","durationMs":0}]},{"name":"Fraud Detection","icon":"AlertTriangle","tests":[{"name":"Self-referral prevention","status":"passed","detail":"Registration uses sponsorId lookup — user cannot use their own referralCode (TS51F3262C) during sign-up","durationMs":0},{"name":"Multi-account same IP detection","status":"passed","detail":"login_events table records IP per login; fraud_flags table tracks IP abuse. 50 test accounts visible in fraud monitor.","durationMs":0},{"name":"Fake deposit injection prevention","status":"passed","detail":"Blockchain deposits require TronGrid verification before crediting. Direct DB-level test deposits are admin-gated and isolated.","durationMs":1},{"name":"Rapid withdrawal spam detection","status":"passed","detail":"0 pending withdrawals tracked. Admin must approve each — no automated bypass path.","durationMs":1}]},{"name":"Load & Performance","icon":"Zap","tests":[{"name":"Concurrent wallet reads (50 users)","status":"passed","detail":"50 concurrent wallet reads in 51ms; 0 errors","durationMs":51},{"name":"Concurrent transaction reads (50 users)","status":"passed","detail":"50 concurrent tx reads in 53ms; 0 errors","durationMs":53},{"name":"Concurrent investment reads (50 users)","status":"passed","detail":"50 concurrent investment reads in 20ms; 0 errors","durationMs":20}]}],"bugs":[],"performance":[{"metric":"Concurrent wallet reads (50 users)","value":"51ms"},{"metric":"Concurrent transaction reads (50 users)","value":"53ms"},{"metric":"Concurrent investment reads (50 users)","value":"20ms"},{"metric":"Total load test DB time","value":"124ms"},{"metric":"Avg per-user latency","value":"2.5ms"},{"metric":"Test users loaded","value":"50"}]}	2026-04-20 15:14:20.398
1	test_mode	false	2026-04-22 05:29:03.203605
6	baseline_total_aum	500000	2026-04-22 11:21:44.637476
7	baseline_active_capital	264000	2026-04-22 11:21:44.637476
8	baseline_reserve_fund	513000	2026-04-22 11:21:44.637476
9	baseline_active_investors	0	2026-04-22 11:21:44.637476
10	auto_demo_signup	false	2026-04-22 11:22:36.985398
11	demo_signup_amount	0	2026-04-22 11:22:36.985398
148	baseline_users_earning_now	18	2026-04-23 08:09:47.36239
149	baseline_withdrawals_24h	12840	2026-04-23 08:09:47.36239
150	baseline_avg_monthly_return	6.2	2026-04-23 08:09:47.36239
151	demo_mode_enabled	true	2026-04-23 08:09:47.36239
152	demo_profit_value	28.45	2026-04-23 08:09:47.36239
153	demo_profit_enabled	true	2026-04-23 08:09:47.36239
154	fomo_messages	["+3 investors joined today","$2,140 invested in last 24h","Strategy capacity 72% filled","+5 withdrawals processed in last hour","New investor from Mumbai just activated trading"]	2026-04-23 08:09:47.36239
155	popup_mode	once	2026-04-23 08:09:47.36239
156	popup_title	🚀 Start Your Investment Journey	2026-04-23 08:09:47.36239
157	popup_message	You are currently exploring demo performance.\n\nActivate live trading to start earning real profits.\n\nStart small. Scale anytime.	2026-04-23 08:09:47.36239
158	popup_button_text	Start with $10	2026-04-23 08:09:47.36239
159	popup_redirect_link	/deposit	2026-04-23 08:09:47.36239
192	active_investors_count	457	2026-04-23 21:33:15.911
193	active_investors_last_increment_at	1776978731552	2026-04-23 21:33:15.911
230	users_earning_now_count	433	2026-04-23 21:33:15.911
259	withdrawals_24h_amount	31164	2026-04-23 21:33:15.911
260	withdrawals_24h_last_increment_at	1776979595587	2026-04-23 21:33:15.911
261	withdrawals_24h_window_start_at	1776939995587	2026-04-23 21:33:15.911
284	avg_monthly_return_value	9.81	2026-04-23 21:33:15.911
285	avg_monthly_return_day	2026-04-23	2026-04-23 21:33:15.911
310	total_equity_boost	520469	2026-04-23 21:33:15.911
311	total_equity_last_increment_at	1776979946914	2026-04-23 21:33:15.911
\.


--
-- Data for Name: task_proofs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_proofs (id, user_id, task_id, proof_type, proof_content, status, admin_note, reviewed_by, reviewed_at, created_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tasks (id, slug, title, description, category, point_reward, requires_proof, requires_kyc, requires_deposit, is_active, icon_name, sort_order, created_at) FROM stdin;
1	daily_login	Daily Login	Log in to your account today	daily	10	f	f	f	t	LogIn	1	2026-04-20 12:43:40.958272
2	daily_dashboard	Visit Dashboard	Open your dashboard today	daily	5	f	f	f	t	LayoutDashboard	2	2026-04-20 12:43:40.964089
3	social_twitter_follow	Follow on X (Twitter)	Follow our official X account and submit proof	social	50	t	f	f	t	Twitter	10	2026-04-20 12:43:40.966649
4	social_telegram_join	Join Telegram Group	Join our Telegram community and submit proof	social	40	t	f	f	t	MessageCircle	11	2026-04-20 12:43:40.973258
5	social_instagram_follow	Follow on Instagram	Follow our Instagram page and submit proof	social	30	t	f	f	t	Instagram	12	2026-04-20 12:43:40.977385
6	social_share_platform	Share Platform	Share Qorix Markets on any social media and submit the link	social	60	t	f	f	t	Share2	13	2026-04-20 12:43:40.980395
7	weekly_referral_signup	Referral Signs Up	One of your referrals creates an account this week	weekly	100	f	f	f	t	UserPlus	20	2026-04-20 12:43:40.98284
8	weekly_referral_kyc	Referral Completes KYC	One of your referrals completes KYC this week	weekly	200	f	t	f	t	BadgeCheck	21	2026-04-20 12:43:40.985374
9	weekly_referral_deposit	Referral Makes First Deposit	One of your referrals makes their first deposit this week	weekly	300	f	t	t	t	DollarSign	22	2026-04-20 12:43:40.988553
10	onetime_kyc	Complete KYC	Submit and pass identity verification	one_time	500	f	f	f	t	ShieldCheck	30	2026-04-20 12:43:40.991943
11	onetime_first_deposit	Make Your First Deposit	Fund your account for the first time	one_time	300	f	f	f	t	Wallet	31	2026-04-20 12:43:40.995731
\.


--
-- Data for Name: trades; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.trades (id, user_id, symbol, direction, entry_price, exit_price, profit, profit_percent, executed_at) FROM stdin;
\.


--
-- Data for Name: trading_desk_traders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.trading_desk_traders (id, name, strategy_type, experience_years, win_rate_percent, is_active, joined_at) FROM stdin;
1	Marcus Chen	scalping	8	73.00	t	2026-04-20 15:01:30.621384
2	Elena Vasquez	scalping	6	71.00	t	2026-04-20 15:01:30.621384
3	Dmitri Volkov	scalping	9	70.00	t	2026-04-20 15:01:30.621384
4	Priya Sharma	scalping	5	72.00	t	2026-04-20 15:01:30.621384
5	Lucas Berg	scalping	7	74.00	t	2026-04-20 15:01:30.621384
6	Aiko Tanaka	scalping	11	76.00	t	2026-04-20 15:01:30.621384
7	Carlos Reyes	scalping	4	68.00	t	2026-04-20 15:01:30.621384
8	Sophie Müller	scalping	8	71.00	t	2026-04-20 15:01:30.621384
9	Ahmed Hassan	scalping	6	70.00	t	2026-04-20 15:01:30.621384
10	Nina Petrov	scalping	10	73.00	t	2026-04-20 15:01:30.621384
11	James Walsh	scalping	7	69.00	t	2026-04-20 15:01:30.621384
12	Yuki Nakamura	scalping	5	72.00	t	2026-04-20 15:01:30.621384
13	Stefan Koch	scalping	9	71.00	t	2026-04-20 15:01:30.621384
14	Leila Kazemi	scalping	6	74.00	t	2026-04-20 15:01:30.621384
15	Blake Morrison	scalping	7	70.00	t	2026-04-20 15:01:30.621384
16	Ravi Patel	scalping	8	73.00	t	2026-04-20 15:01:30.621384
17	Mia Larsen	scalping	4	68.00	t	2026-04-20 15:01:30.621384
18	Omar Farouk	scalping	11	75.00	t	2026-04-20 15:01:30.621384
19	David Konishi	swing	12	67.00	t	2026-04-20 15:01:30.621384
20	Isabelle Fontaine	swing	9	64.00	t	2026-04-20 15:01:30.621384
21	Viktor Romanov	swing	14	66.00	t	2026-04-20 15:01:30.621384
22	Ana Lima	swing	7	63.00	t	2026-04-20 15:01:30.621384
23	Sebastian Holt	swing	11	65.00	t	2026-04-20 15:01:30.621384
24	Zara Ahmed	swing	8	64.00	t	2026-04-20 15:01:30.621384
25	Patrick O'Brien	swing	10	66.00	t	2026-04-20 15:01:30.621384
26	Mei Lin	swing	6	63.00	t	2026-04-20 15:01:30.621384
27	Lars Hansen	swing	13	67.00	t	2026-04-20 15:01:30.621384
28	Fatima Malik	swing	5	62.00	t	2026-04-20 15:01:30.621384
29	Evan Carver	swing	9	65.00	t	2026-04-20 15:01:30.621384
30	Natasha Ivanova	swing	15	68.00	t	2026-04-20 15:01:30.621384
31	Diego Herrera	swing	8	64.00	t	2026-04-20 15:01:30.621384
32	Amara Diallo	swing	7	65.00	t	2026-04-20 15:01:30.621384
33	Ryan Thornton	hybrid	10	69.00	t	2026-04-20 15:01:30.621384
34	Kenji Watanabe	hybrid	8	68.00	t	2026-04-20 15:01:30.621384
35	Sarah Kowalski	hybrid	12	70.00	t	2026-04-20 15:01:30.621384
36	Ali Reza	hybrid	6	66.00	t	2026-04-20 15:01:30.621384
37	Monica Reinholt	hybrid	9	68.00	t	2026-04-20 15:01:30.621384
38	Kai Zhang	hybrid	11	70.00	t	2026-04-20 15:01:30.621384
39	Ingrid Sorenson	hybrid	7	67.00	t	2026-04-20 15:01:30.621384
40	Tariq Mansoor	hybrid	8	69.00	t	2026-04-20 15:01:30.621384
41	Clara von Buren	hybrid	14	71.00	t	2026-04-20 15:01:30.621384
42	Olga Stravinsky	hybrid	6	67.00	t	2026-04-20 15:01:30.621384
43	Jack Madden	hybrid	9	68.00	t	2026-04-20 15:01:30.621384
44	Marcus Chen	scalping	8	73.00	t	2026-04-20 15:01:30.627105
45	Elena Vasquez	scalping	6	71.00	t	2026-04-20 15:01:30.627105
46	Dmitri Volkov	scalping	9	70.00	t	2026-04-20 15:01:30.627105
47	Priya Sharma	scalping	5	72.00	t	2026-04-20 15:01:30.627105
48	Lucas Berg	scalping	7	74.00	t	2026-04-20 15:01:30.627105
49	Aiko Tanaka	scalping	11	76.00	t	2026-04-20 15:01:30.627105
50	Carlos Reyes	scalping	4	68.00	t	2026-04-20 15:01:30.627105
51	Sophie Müller	scalping	8	71.00	t	2026-04-20 15:01:30.627105
52	Ahmed Hassan	scalping	6	70.00	t	2026-04-20 15:01:30.627105
53	Nina Petrov	scalping	10	73.00	t	2026-04-20 15:01:30.627105
54	James Walsh	scalping	7	69.00	t	2026-04-20 15:01:30.627105
55	Yuki Nakamura	scalping	5	72.00	t	2026-04-20 15:01:30.627105
56	Stefan Koch	scalping	9	71.00	t	2026-04-20 15:01:30.627105
57	Leila Kazemi	scalping	6	74.00	t	2026-04-20 15:01:30.627105
58	Blake Morrison	scalping	7	70.00	t	2026-04-20 15:01:30.627105
59	Ravi Patel	scalping	8	73.00	t	2026-04-20 15:01:30.627105
60	Mia Larsen	scalping	4	68.00	t	2026-04-20 15:01:30.627105
61	Omar Farouk	scalping	11	75.00	t	2026-04-20 15:01:30.627105
62	David Konishi	swing	12	67.00	t	2026-04-20 15:01:30.627105
63	Isabelle Fontaine	swing	9	64.00	t	2026-04-20 15:01:30.627105
64	Viktor Romanov	swing	14	66.00	t	2026-04-20 15:01:30.627105
65	Ana Lima	swing	7	63.00	t	2026-04-20 15:01:30.627105
66	Sebastian Holt	swing	11	65.00	t	2026-04-20 15:01:30.627105
67	Zara Ahmed	swing	8	64.00	t	2026-04-20 15:01:30.627105
68	Patrick O'Brien	swing	10	66.00	t	2026-04-20 15:01:30.627105
69	Mei Lin	swing	6	63.00	t	2026-04-20 15:01:30.627105
70	Lars Hansen	swing	13	67.00	t	2026-04-20 15:01:30.627105
71	Fatima Malik	swing	5	62.00	t	2026-04-20 15:01:30.627105
72	Evan Carver	swing	9	65.00	t	2026-04-20 15:01:30.627105
73	Natasha Ivanova	swing	15	68.00	t	2026-04-20 15:01:30.627105
74	Diego Herrera	swing	8	64.00	t	2026-04-20 15:01:30.627105
75	Amara Diallo	swing	7	65.00	t	2026-04-20 15:01:30.627105
76	Ryan Thornton	hybrid	10	69.00	t	2026-04-20 15:01:30.627105
77	Kenji Watanabe	hybrid	8	68.00	t	2026-04-20 15:01:30.627105
78	Sarah Kowalski	hybrid	12	70.00	t	2026-04-20 15:01:30.627105
79	Ali Reza	hybrid	6	66.00	t	2026-04-20 15:01:30.627105
80	Monica Reinholt	hybrid	9	68.00	t	2026-04-20 15:01:30.627105
81	Kai Zhang	hybrid	11	70.00	t	2026-04-20 15:01:30.627105
82	Ingrid Sorenson	hybrid	7	67.00	t	2026-04-20 15:01:30.627105
83	Tariq Mansoor	hybrid	8	69.00	t	2026-04-20 15:01:30.627105
84	Clara von Buren	hybrid	14	71.00	t	2026-04-20 15:01:30.627105
85	Olga Stravinsky	hybrid	6	67.00	t	2026-04-20 15:01:30.627105
86	Jack Madden	hybrid	9	68.00	t	2026-04-20 15:01:30.627105
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, user_id, type, amount, status, description, wallet_address, tx_hash, created_at) FROM stdin;
\.


--
-- Data for Name: user_task_completions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_task_completions (id, user_id, task_id, status, points_awarded, completed_at, period_key) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, full_name, is_admin, admin_role, kyc_status, is_disabled, is_frozen, force_logout_after, referral_code, sponsor_id, tron_address, created_at, email_verified, points, kyc_document_url, kyc_document_type, kyc_submitted_at, kyc_reviewed_at, kyc_rejection_reason, kyc_document_url_back, kyc_personal_status, phone_number, date_of_birth, kyc_personal_submitted_at, kyc_address_status, address_line1, address_city, address_state, address_country, address_postal_code, kyc_address_doc_url, kyc_address_submitted_at, kyc_address_reviewed_at, kyc_address_rejection_reason) FROM stdin;
1	secure@safepayu.com	$2b$10$jTfv3YcXDJwrpN6FEnQHH.06heWc7CjmFKA2KsCMOk4aGB5b0vA0y	Admin	t	user	not_submitted	f	f	\N	ADMIN001	1	\N	2026-04-20 12:51:50.357293	t	0	\N	\N	\N	\N	\N	\N	not_submitted	\N	\N	\N	not_submitted	\N	\N	\N	\N	\N	\N	\N	\N	\N
106	looxprem@gmail.com	$2b$12$sa2.CSmXakLNXcTvFMbq4O4G6uplqm2CLQsx4vgFazIjKwHSKWCRq	Rajeev Puri	f	user	not_submitted	f	f	\N	QX70751A86	0	\N	2026-04-22 09:22:03.528227	t	25	\N	\N	\N	\N	\N	\N	not_submitted	\N	\N	\N	not_submitted	\N	\N	\N	\N	\N	\N	\N	\N	\N
107	SAFEPAYU@GMAIL.COM	$2b$12$DjKgSVKxE9vHtMpxC4yB/O07k1MrtidFsNVtZlxd0KA9.vN36JkHe	prem2	f	user	not_submitted	f	f	\N	QXCE592B58	0	\N	2026-04-23 08:43:55.602006	f	0	\N	\N	\N	\N	\N	\N	not_submitted	\N	\N	\N	not_submitted	\N	\N	\N	\N	\N	\N	\N	\N	\N
109	safepayu@gmail.com	$2b$12$J0.6o1DrgDbP2jFlXKcph.drw8SXLitN3rDcsHYMZC5RNsYtOsTiC	prem	f	user	not_submitted	f	f	\N	QXEC3249EB	0	\N	2026-04-23 16:07:49.124535	t	25	\N	\N	\N	\N	\N	\N	not_submitted	\N	\N	\N	not_submitted	\N	\N	\N	\N	\N	\N	\N	\N	\N
108	altradedevx@gmail.com	$2b$12$1irjL6Ms0TRuXRygsWPM6u3rZ.s6/zDkqM9hFYbtEw1x31xDL4O.C	prem 2	f	user	not_submitted	f	f	\N	QX02012063	0	\N	2026-04-23 08:45:07.066333	t	25	\N	\N	\N	\N	\N	\N	not_submitted	\N	\N	\N	not_submitted	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.wallets (id, user_id, main_balance, trading_balance, profit_balance, updated_at, demo_equity_boost, demo_equity_last_at, daily_pnl_amount, daily_pnl_pct, daily_pnl_day, daily_pnl_target_pct, daily_pnl_chunks, daily_pnl_increments_done, trading_fund_boost, trading_fund_last_at, total_profit_boost, synth_win_rate, synth_max_drawdown, synth_metrics_day, synth_avg_return, synth_risk_score) FROM stdin;
102	1	0.00000000	0.00000000	0.00000000	2026-04-22 09:04:18.185944	0.00	0	0.00	0.0000		0.0000	[]	0	0.00	0	0.00	0.00	0.00		0.00	Low
107	107	0.00000000	0.00000000	0.00000000	2026-04-23 08:43:55.84506	0.00	0	0.00	0.0000		0.0000	[]	0	0.00	0	0.00	0.00	0.00		0.00	Low
108	108	0.00000000	0.00000000	0.00000000	2026-04-23 08:45:07.100792	0.00	0	0.00	0.0000		0.0000	[]	0	0.00	0	0.00	0.00	0.00		0.00	Low
106	106	0.00000000	0.00000000	0.00000000	2026-04-22 09:22:03.600276	17780.00	1776973716255	4.45	0.4253	2026-04-23	0.4253	[0.1122,0.1553,0.0679,0.0899]	4	87.74	1776972776773	4.45	92.88	2.11	2026-04-23	2.48	Low
109	109	0.00000000	0.00000000	0.00000000	2026-04-23 16:07:49.167629	9515.00	1776979705788	0.00	0.5626	2026-04-23	0.5626	[0.1761,0.0841,0.1147,0.1877]	4	85.89	1776978505798	0.00	95.00	2.10	2026-04-23	2.50	Low
\.


--
-- Name: blockchain_deposits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.blockchain_deposits_id_seq', 2, true);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 1, false);


--
-- Name: chat_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_sessions_id_seq', 1, false);


--
-- Name: daily_profit_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.daily_profit_runs_id_seq', 1, false);


--
-- Name: deposit_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.deposit_addresses_id_seq', 3, true);


--
-- Name: email_otps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.email_otps_id_seq', 11, true);


--
-- Name: equity_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.equity_history_id_seq', 6818, true);


--
-- Name: fraud_flags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fraud_flags_id_seq', 25, true);


--
-- Name: gl_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.gl_accounts_id_seq', 2385, true);


--
-- Name: investments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.investments_id_seq', 111, true);


--
-- Name: ip_signups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ip_signups_id_seq', 8, true);


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ledger_entries_id_seq', 2256, true);


--
-- Name: login_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.login_events_id_seq', 34, true);


--
-- Name: monthly_performance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.monthly_performance_id_seq', 53, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 14, true);


--
-- Name: pnl_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pnl_history_id_seq', 7316, true);


--
-- Name: points_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.points_transactions_id_seq', 7, true);


--
-- Name: promo_redemptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promo_redemptions_id_seq', 10, true);


--
-- Name: report_verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.report_verifications_id_seq', 1, false);


--
-- Name: signal_trade_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.signal_trade_audit_id_seq', 44, true);


--
-- Name: signal_trade_distributions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.signal_trade_distributions_id_seq', 864, true);


--
-- Name: signal_trades_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.signal_trades_id_seq', 17, true);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 2757, true);


--
-- Name: task_proofs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.task_proofs_id_seq', 1, false);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tasks_id_seq', 2398, true);


--
-- Name: trades_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.trades_id_seq', 464, true);


--
-- Name: trading_desk_traders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.trading_desk_traders_id_seq', 86, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transactions_id_seq', 1169, true);


--
-- Name: user_task_completions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_task_completions_id_seq', 7, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 109, true);


--
-- Name: users_sponsor_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_sponsor_id_seq', 101, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wallets_id_seq', 109, true);


--
-- Name: blockchain_deposits blockchain_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blockchain_deposits
    ADD CONSTRAINT blockchain_deposits_pkey PRIMARY KEY (id);


--
-- Name: blockchain_deposits blockchain_deposits_tx_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blockchain_deposits
    ADD CONSTRAINT blockchain_deposits_tx_hash_unique UNIQUE (tx_hash);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: daily_profit_runs daily_profit_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_profit_runs
    ADD CONSTRAINT daily_profit_runs_pkey PRIMARY KEY (id);


--
-- Name: deposit_addresses deposit_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_addresses
    ADD CONSTRAINT deposit_addresses_pkey PRIMARY KEY (id);


--
-- Name: deposit_addresses deposit_addresses_trc20_address_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_addresses
    ADD CONSTRAINT deposit_addresses_trc20_address_unique UNIQUE (trc20_address);


--
-- Name: deposit_addresses deposit_addresses_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_addresses
    ADD CONSTRAINT deposit_addresses_user_id_unique UNIQUE (user_id);


--
-- Name: email_otps email_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_otps
    ADD CONSTRAINT email_otps_pkey PRIMARY KEY (id);


--
-- Name: equity_history equity_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equity_history
    ADD CONSTRAINT equity_history_pkey PRIMARY KEY (id);


--
-- Name: fraud_flags fraud_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_flags
    ADD CONSTRAINT fraud_flags_pkey PRIMARY KEY (id);


--
-- Name: gl_accounts gl_accounts_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gl_accounts
    ADD CONSTRAINT gl_accounts_code_unique UNIQUE (code);


--
-- Name: gl_accounts gl_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gl_accounts
    ADD CONSTRAINT gl_accounts_pkey PRIMARY KEY (id);


--
-- Name: investments investments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_pkey PRIMARY KEY (id);


--
-- Name: investments investments_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_user_id_unique UNIQUE (user_id);


--
-- Name: ip_signups ip_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_signups
    ADD CONSTRAINT ip_signups_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: login_events login_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_events
    ADD CONSTRAINT login_events_pkey PRIMARY KEY (id);


--
-- Name: monthly_performance monthly_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_performance
    ADD CONSTRAINT monthly_performance_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: pnl_history pnl_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pnl_history
    ADD CONSTRAINT pnl_history_pkey PRIMARY KEY (id);


--
-- Name: points_transactions points_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_transactions
    ADD CONSTRAINT points_transactions_pkey PRIMARY KEY (id);


--
-- Name: promo_redemptions promo_redemptions_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_redemptions
    ADD CONSTRAINT promo_redemptions_code_unique UNIQUE (code);


--
-- Name: promo_redemptions promo_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_redemptions
    ADD CONSTRAINT promo_redemptions_pkey PRIMARY KEY (id);


--
-- Name: promo_redemptions promo_redemptions_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_redemptions
    ADD CONSTRAINT promo_redemptions_user_id_unique UNIQUE (user_id);


--
-- Name: report_verifications report_verifications_hash_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_verifications
    ADD CONSTRAINT report_verifications_hash_id_unique UNIQUE (hash_id);


--
-- Name: report_verifications report_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_verifications
    ADD CONSTRAINT report_verifications_pkey PRIMARY KEY (id);


--
-- Name: signal_trade_audit signal_trade_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signal_trade_audit
    ADD CONSTRAINT signal_trade_audit_pkey PRIMARY KEY (id);


--
-- Name: signal_trade_distributions signal_trade_distributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signal_trade_distributions
    ADD CONSTRAINT signal_trade_distributions_pkey PRIMARY KEY (id);


--
-- Name: signal_trades signal_trades_idempotency_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signal_trades
    ADD CONSTRAINT signal_trades_idempotency_key_unique UNIQUE (idempotency_key);


--
-- Name: signal_trades signal_trades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signal_trades
    ADD CONSTRAINT signal_trades_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_unique UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: task_proofs task_proofs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_proofs
    ADD CONSTRAINT task_proofs_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_slug_unique UNIQUE (slug);


--
-- Name: trades trades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trades
    ADD CONSTRAINT trades_pkey PRIMARY KEY (id);


--
-- Name: trading_desk_traders trading_desk_traders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trading_desk_traders
    ADD CONSTRAINT trading_desk_traders_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_task_completions user_task_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_task_completions
    ADD CONSTRAINT user_task_completions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_unique UNIQUE (user_id);


--
-- Name: email_otps_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_otps_email_idx ON public.email_otps USING btree (email);


--
-- Name: email_otps_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_otps_user_id_idx ON public.email_otps USING btree (user_id);


--
-- Name: fraud_flags_resolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fraud_flags_resolved_idx ON public.fraud_flags USING btree (is_resolved);


--
-- Name: fraud_flags_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fraud_flags_type_idx ON public.fraud_flags USING btree (flag_type);


--
-- Name: fraud_flags_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fraud_flags_user_id_idx ON public.fraud_flags USING btree (user_id);


--
-- Name: fraud_flags_user_type_unresolved_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fraud_flags_user_type_unresolved_uniq ON public.fraud_flags USING btree (user_id, flag_type) WHERE (is_resolved = false);


--
-- Name: ip_signups_ip_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ip_signups_ip_idx ON public.ip_signups USING btree (ip_address);


--
-- Name: login_events_fingerprint_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_events_fingerprint_idx ON public.login_events USING btree (device_fingerprint);


--
-- Name: login_events_ip_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_events_ip_idx ON public.login_events USING btree (ip_address);


--
-- Name: login_events_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_events_user_id_idx ON public.login_events USING btree (user_id);


--
-- Name: pnl_history_user_date_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pnl_history_user_date_unique ON public.pnl_history USING btree (user_id, date);


--
-- Name: points_txn_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX points_txn_user_id_idx ON public.points_transactions USING btree (user_id);


--
-- Name: signal_trade_audit_trade_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX signal_trade_audit_trade_idx ON public.signal_trade_audit USING btree (trade_id);


--
-- Name: signal_trade_dist_trade_user_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX signal_trade_dist_trade_user_unique ON public.signal_trade_distributions USING btree (trade_id, user_id);


--
-- Name: signal_trade_dist_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX signal_trade_dist_user_idx ON public.signal_trade_distributions USING btree (user_id);


--
-- Name: signal_trades_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX signal_trades_status_idx ON public.signal_trades USING btree (status);


--
-- Name: task_proofs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_proofs_status_idx ON public.task_proofs USING btree (status);


--
-- Name: task_proofs_task_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_proofs_task_id_idx ON public.task_proofs USING btree (task_id);


--
-- Name: task_proofs_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_proofs_user_id_idx ON public.task_proofs USING btree (user_id);


--
-- Name: utc_task_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX utc_task_id_idx ON public.user_task_completions USING btree (task_id);


--
-- Name: utc_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX utc_user_id_idx ON public.user_task_completions USING btree (user_id);


--
-- Name: utc_user_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX utc_user_task_idx ON public.user_task_completions USING btree (user_id, task_id);


--
-- Name: utc_user_task_period_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX utc_user_task_period_uniq ON public.user_task_completions USING btree (user_id, task_id, period_key);


--
-- Name: chat_messages chat_messages_session_id_chat_sessions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_session_id_chat_sessions_id_fk FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict cDQLsyPc4wRnYLtpw1gv1TmajxagIbnj5ghFvecbyHm7JEhdh0I0E9F4yo4dixO

