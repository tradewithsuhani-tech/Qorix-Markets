/**
 * Demo mode — when EXPO_PUBLIC_DEMO_MODE === "1", patches global fetch so the
 * app renders fully populated screens without ever talking to a real backend.
 * Used for design-reference APK builds for handoff to native developers.
 */

const DEMO_USER = {
  id: "demo-user-1",
  email: "demo@qorixmarkets.com",
  fullName: "Demo Investor",
  emailVerified: true,
  kycStatus: "approved",
  vipTier: 2,
  referralCode: "QORIX2026",
  createdAt: "2026-01-15T10:00:00.000Z",
};

const DEMO_TOKEN = "demo.jwt.token";

const NOW = () => new Date().toISOString();
const ISO = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const DEMO_RESPONSES: Record<string, () => unknown> = {
  // ─── auth ────────────────────────────────────────────────────────────────
  "POST /auth/login": () => ({
    success: true,
    token: DEMO_TOKEN,
    user: DEMO_USER,
  }),
  "POST /auth/signup": () => ({
    success: true,
    token: DEMO_TOKEN,
    user: DEMO_USER,
  }),
  "POST /auth/verify-otp": () => ({ success: true, token: DEMO_TOKEN, user: DEMO_USER }),
  "POST /auth/resend-otp": () => ({ success: true }),
  "POST /auth/forgot-password": () => ({ success: true }),
  "POST /auth/reset-password": () => ({ success: true }),
  "POST /auth/change-password": () => ({
    success: true,
    message: "Password updated",
    passwordChangedAt: NOW(),
    withdrawalLockedUntil: ISO(24 * 60 * 60 * 1000),
    withdrawalLockHours: 24,
  }),
  "POST /auth/logout": () => ({ success: true }),
  "GET /auth/me": () => DEMO_USER,

  // ─── wallet ──────────────────────────────────────────────────────────────
  "GET /wallet": () => ({
    main: 1250.45,
    trading: 850.0,
    profit: 312.78,
    locked: 0,
    currency: "USDT",
  }),

  // ─── dashboard ───────────────────────────────────────────────────────────
  "GET /dashboard/summary": () => ({
    totalBalance: 2413.23,
    todayProfit: 24.56,
    todayProfitPercent: 1.05,
    activeInvestment: 850.0,
    totalEarnings: 562.78,
    referralEarnings: 45.5,
    vipTier: 2,
    nextTierAt: 5000,
    dailyProfitPercent: 1.25,
    autoTrading: true,
    riskLevel: "medium",
  }),

  // ─── investment ──────────────────────────────────────────────────────────
  "GET /investment": () => ({
    active: true,
    amount: 850.0,
    riskLevel: "medium",
    drawdownLimit: 5,
    autoCompound: true,
    startedAt: ISO(-7 * 24 * 60 * 60 * 1000),
    totalProfit: 78.45,
    todayProfit: 10.62,
    daysActive: 7,
  }),
  "POST /investment/start": () => ({ success: true }),
  "POST /investment/stop": () => ({ success: true }),

  // ─── trades ──────────────────────────────────────────────────────────────
  "GET /trades": () => ({
    trades: Array.from({ length: 12 }, (_, i) => ({
      id: `trade-${i + 1}`,
      pair: ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"][i % 4],
      side: i % 2 === 0 ? "buy" : "sell",
      entryPrice: 42000 + i * 100,
      exitPrice: 42000 + i * 100 + (i % 2 === 0 ? 250 : -180),
      amount: 100 + i * 25,
      pnl: i % 2 === 0 ? 2.45 + i * 0.3 : -1.2 - i * 0.15,
      pnlPercent: i % 2 === 0 ? 0.6 + i * 0.05 : -0.3 - i * 0.02,
      openedAt: ISO(-i * 60 * 60 * 1000),
      closedAt: ISO(-i * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: "closed",
    })),
  }),

  // ─── transactions ────────────────────────────────────────────────────────
  "GET /transactions": () => ({
    transactions: Array.from({ length: 15 }, (_, i) => ({
      id: `tx-${i + 1}`,
      type: ["deposit", "withdraw", "profit", "transfer", "referral"][i % 5],
      amount: 50 + i * 17.3,
      currency: "USDT",
      status: i < 2 ? "pending" : "completed",
      createdAt: ISO(-i * 4 * 60 * 60 * 1000),
      description: ["TRC20 USDT deposit", "INR withdrawal", "Daily profit", "Internal transfer", "Referral bonus"][i % 5],
      txHash: i % 5 === 0 ? `0x${"a".repeat(64)}` : null,
    })),
  }),

  // ─── deposit ─────────────────────────────────────────────────────────────
  "GET /deposit/address": () => ({
    address: "TXyzAbc123Demo456Wallet789Address0Qor",
    network: "TRC20",
    minimum: 10,
    qrCodeData: "TXyzAbc123Demo456Wallet789Address0Qor",
  }),
  "POST /deposit/initiate": () => ({ success: true, depositId: "dep-demo-1" }),

  // ─── withdraw ────────────────────────────────────────────────────────────
  "POST /withdraw": () => ({ success: true, withdrawalId: "wd-demo-1", status: "pending" }),
  "POST /withdraw/verify-otp": () => ({ success: true }),

  // ─── transfer ────────────────────────────────────────────────────────────
  "POST /transfer": () => ({ success: true, transferId: "tr-demo-1" }),

  // ─── referral ────────────────────────────────────────────────────────────
  "GET /referral": () => ({
    code: "QORIX2026",
    link: "https://qorixmarkets.com/signup?ref=QORIX2026",
    totalReferrals: 8,
    activeReferrals: 5,
    totalEarnings: 145.5,
    monthlyEarnings: 32.4,
    referrals: Array.from({ length: 5 }, (_, i) => ({
      id: `ref-${i + 1}`,
      name: `User ${i + 1}`,
      joinedAt: ISO(-i * 7 * 24 * 60 * 60 * 1000),
      invested: 200 + i * 100,
      yourEarning: 5 + i * 2,
    })),
  }),

  // ─── 2FA ─────────────────────────────────────────────────────────────────
  "GET /security/2fa/status": () => ({
    enabled: false,
    backupCodesRemaining: 0,
    enabledAt: null,
  }),
  "POST /security/2fa/setup": () => ({
    qrDataUrl:
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjx0ZXh0IHg9IjUwIiB5PSIxMDAiIGZpbGw9IiMwMDAiIGZvbnQtc2l6ZT0iMTQiPkRFTU8gUVI8L3RleHQ+PC9zdmc+",
    manualCode: "DEMO2FACODEXYZ123",
    issuer: "Qorix Markets",
    accountName: DEMO_USER.email,
  }),
  "POST /security/2fa/verify-setup": () => ({
    enabled: true,
    backupCodes: ["DEMO-1111", "DEMO-2222", "DEMO-3333", "DEMO-4444", "DEMO-5555"],
  }),
  "POST /security/2fa/disable": () => ({ enabled: false }),

  // ─── devices ─────────────────────────────────────────────────────────────
  "GET /devices": () => ({
    devices: [
      {
        id: "dev-1",
        browser: "Expo Demo",
        os: "Android 14",
        firstSeenAt: ISO(-30 * 24 * 60 * 60 * 1000),
        lastSeenAt: NOW(),
        city: "Mumbai",
        country: "IN",
        isCurrent: true,
        newDeviceAlertSent: true,
        withdrawalLocked: false,
        withdrawalUnlockAt: null,
        withdrawalUnlockHoursLeft: 0,
        withdrawalUnlockIst: null,
      },
      {
        id: "dev-2",
        browser: "Chrome",
        os: "Windows 11",
        firstSeenAt: ISO(-15 * 24 * 60 * 60 * 1000),
        lastSeenAt: ISO(-2 * 60 * 60 * 1000),
        city: "Delhi",
        country: "IN",
        isCurrent: false,
        newDeviceAlertSent: true,
        withdrawalLocked: false,
        withdrawalUnlockAt: null,
        withdrawalUnlockHoursLeft: 0,
        withdrawalUnlockIst: null,
      },
    ],
    cooldownHours: 24,
    currentDeviceTracked: true,
    currentSession: { withdrawalAllowed: true },
  }),

  // ─── KYC ─────────────────────────────────────────────────────────────────
  "GET /kyc": () => ({
    status: "approved",
    submittedAt: ISO(-10 * 24 * 60 * 60 * 1000),
    approvedAt: ISO(-9 * 24 * 60 * 60 * 1000),
    documents: { idFront: "uploaded", idBack: "uploaded", selfie: "uploaded" },
  }),
  "POST /kyc/submit": () => ({ success: true, status: "pending" }),

  // ─── bank ────────────────────────────────────────────────────────────────
  "GET /bank": () => ({
    banks: [
      {
        id: "bank-1",
        accountHolder: "Demo Investor",
        accountNumber: "XXXX1234",
        ifsc: "HDFC0001234",
        bankName: "HDFC Bank",
        isPrimary: true,
        verified: true,
      },
    ],
  }),
  "POST /bank": () => ({ success: true, bankId: "bank-demo-1" }),

  // ─── notifications ───────────────────────────────────────────────────────
  "GET /notifications": () => ({
    notifications: Array.from({ length: 6 }, (_, i) => ({
      id: `notif-${i + 1}`,
      title: ["Daily profit credited", "Trade closed", "Login from new device", "Welcome to Qorix", "Referral bonus", "VIP tier upgrade"][i],
      body: "Demo notification body — design reference only.",
      read: i > 1,
      createdAt: ISO(-i * 60 * 60 * 1000),
    })),
    unreadCount: 2,
  }),

  // ─── system ──────────────────────────────────────────────────────────────
  "GET /system/status": () => ({
    maintenance: false,
    registrationEnabled: true,
    autoTradingEnabled: true,
  }),
};

function findMockResponse(method: string, url: string): unknown | null {
  // strip baseUrl prefix to match against keys like "GET /wallet"
  const u = new URL(url, "https://placeholder.local");
  let path = u.pathname.replace(/^.*?\/api/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  const key = `${method.toUpperCase()} ${path}`;
  if (DEMO_RESPONSES[key]) return DEMO_RESPONSES[key]();
  // greedy: try to match prefixes for paths with ids
  for (const k of Object.keys(DEMO_RESPONSES)) {
    const [m, p] = k.split(" ");
    if (m === method.toUpperCase() && path.startsWith(p)) {
      return DEMO_RESPONSES[k]();
    }
  }
  // default empty success
  return { success: true, demo: true };
}

let installed = false;

export function isDemoMode(): boolean {
  return process.env.EXPO_PUBLIC_DEMO_MODE === "1";
}

export function installDemoMode(): void {
  if (installed || !isDemoMode()) return;
  installed = true;
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? (input as Request).method : "GET")).toUpperCase();
    if (url.includes("/api/")) {
      await new Promise((r) => setTimeout(r, 250));
      const data = findMockResponse(method, url);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof fetch;
  console.log("[demo] installed — all /api/* requests are mocked");
}

export const DEMO_AUTH_TOKEN = DEMO_TOKEN;
