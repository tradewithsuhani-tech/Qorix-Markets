# Qorix Markets

## Overview

Qorix Markets is a premium fintech PWA designed for automated USDT investment and trading. It allows users to deposit USDT, select a risk level, and engage in simulated daily trading with profit distribution. Key features include comprehensive wallet management (main, trading, profit balances, with deposit/withdraw/transfer functionalities), a robust referral system, and a tiered VIP membership program. The platform also boasts an enterprise-grade admin panel for managing operations, user accounts, and system settings. The project's vision is to offer an accessible and secure automated investment platform, leveraging modern web technologies for a seamless user experience.

## User Preferences

- **Communication**: Use simple, clear language.
- **Workflow**: Prioritize iterative development.
- **Interaction**: Ask before making major changes.
- **Explanation Style**: Provide detailed explanations for complex decisions.
- **Codebase Changes**: Do not make changes to files or folders unless explicitly instructed or absolutely necessary for core functionality.
- **No changes to `docs/` folder.**
- **No changes to `tools/load-test/k6-ramp.js` or `tools/load-test/README.md` without explicit instruction.**

## System Architecture

The project is built as a monorepo utilizing `pnpm workspaces`.

### Frontend
- **Technology**: React + Vite
- **Styling**: Tailwind CSS v4
- **Animation**: Framer Motion
- **Charting**: Recharts
- **Routing**: Wouter
- **UI/UX**: Features a dark theme with deep navy/obsidian, accented by electric blue. Employs glassmorphism for cards, Framer Motion for animations, and mobile-first design with bottom navigation and a desktop sidebar. The application is PWA installable.

### Backend
- **Technology**: Express 5 (Node.js 24)
- **Authentication**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: Zod (v4) with Drizzle-Zod for schema validation.
- **API Codegen**: Orval is used to generate React Query hooks and Zod schemas from an OpenAPI specification, including a post-codegen patch for `Partial<UseQueryOptions>` to simplify caller interactions.

### Database
- **Technology**: PostgreSQL with Drizzle ORM.
- **Schema**: Comprehensive schema covering users, wallets, transactions, investments, trades, equity, system settings, and notifications.

### Core Features
- **Investment & Trading**: Users can start/stop auto-trading with configurable risk levels (3%/5%/10% drawdown limits). An admin-set daily profit percentage is distributed, with optional auto-compounding.
- **Capital Protection**: Configurable drawdown limits with auto-pause and sticky banners.
- **Anti-Fraud & Security**: Implements honeypot fields, IP signup rate limiting, bot timing detection, device fingerprinting, multi-account detection, email OTP verification for critical actions (signup, withdrawals), new-device login alerts, and a 24h new-device withdrawal cooldown.
- **Admin Panel**: Extensive admin capabilities for setting profit percentages, AUM overview, withdrawal approvals, user management (freeze, disable, force logout), system controls (maintenance mode, registration toggle, auto-withdraw limits, broadcast notifications), and a dedicated admin portal (`/admin-login`).
- **User Engagement**: Includes a task and points system for daily/weekly/social tasks, a referral program with monthly sponsor earnings, and a real-time notification system.
- **Quiz & Giveaways**: KYC-gated timed MCQ quizzes with live leaderboards and prizes, driven by a Redis pub/sub event bus for multi-instance scalability and AI-generated questions.
- **Analytics**: Advanced analytics for equity curves, drawdown charts, profit distribution, and rolling returns.
- **Promotions**: Two-layered offer system: rotating-window HMAC-derived offers and scheduled holiday promotions, with atomic redemption and cap management.
- **Telegram Alerts**: Opt-in personal account alerts via a dedicated Telegram bot with deep-linking for binding.
- **Signal Trading System**: Admin-opened signal trades with proportional profit distribution to users' trading balances upon closure.
- **Modular Deposit Systems**: Self-contained TRON USDT deposit pipeline with wallet generation, deposit watching, and two-step sweeps. INR withdrawal system with cap-based fraud prevention.
- **Performance & Scalability**:
    - **Caching**: Multi-layered caching strategy with per-process in-memory TTL cache and Redis-backed caching for frequently accessed data (e.g., market indicators, dashboard summaries).
    - **Rate Limiting**: Redis-backed rate limiting for login attempts and a global per-IP limiter for all API endpoints.
    - **Horizontal Scaling**: Configured for horizontal scaling on Fly.io with multiple app instances across regions.
    - **Database Optimization**: Composite B-tree indexes on hot paths to alleviate read pressure.
    - **Security Hardening**: Helmet security headers, Origin/Referer guard for state-changing methods, HTTP method allowlisting, and an optional Admin IP allowlist. Cloudflare-pinned origin enforcement and HMAC CSRF nonces are available as opt-in security layers.
    - **Email Normalization**: Lowercase and trim email addresses on register/login.
    - **Disposable Email Block**: Blocks disposable/temp mail services during registration.
    - **Email Verification Gate**: Enforces email verification before login.
- **Qorixplay (Quiz Web App)**: Separate web app scaffolded with Vite, React, Tailwind, and shadcn/ui. Implements OAuth Authorization Code + PKCE flow for SSO with Qorix Markets, including refresh token rotation.

## External Dependencies

- **Cloud Infrastructure**: Fly.io (for application deployment and scaling)
- **Database**: PostgreSQL (managed by Neon.tech for live environment)
- **Cache/Messaging**: Redis (Upstash for shared caching, rate limiting, and quiz event bus)
- **Email Service**: AWS SES (for transactional emails and OTP delivery)
- **SMS/Voice OTP (future)**: Twilio/Exotel (credentials pending)
- **Captcha**: Cloudflare Turnstile (replacing Google reCAPTCHA)
- **TRON Blockchain**: TronGrid (for TRC20 USDT transfer monitoring)
- **IP Geolocation**: ip-api.com (for new-device login alerts)
- **AI (for quizzes)**: OpenAI (gpt-5-mini for question drafting)