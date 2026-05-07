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
    id: 1,
    userId: 1,
    mainBalance: 1250.45,
    tradingBalance: 850.0,
    profitBalance: 312.78,
    updatedAt: NOW(),
  }),

  // ─── dashboard ───────────────────────────────────────────────────────────
  "GET /dashboard/summary": () => ({
    totalBalance: 2413.23,
    dailyProfitLoss: 24.56,
    dailyProfitPercent: 1.05,
    activeInvestment: 850.0,
    totalProfit: 562.78,
    profitBalance: 312.78,
    tradingBalance: 850.0,
    nextPayoutDate: ISO(20 * 60 * 60 * 1000),
    daysUntilPayout: 1,
    riskLevel: "medium",
    isTrading: true,
    vip: {
      tier: "gold",
      label: "Gold",
      profitBonus: 0.05,
      withdrawalFee: 0.015,
      minAmount: 1000,
      nextTier: { tier: "platinum", label: "Platinum", minAmount: 5000, gap: 2586.77 },
    },
  }),

  // ─── investment ──────────────────────────────────────────────────────────
  "GET /investment": () => ({
    id: 1,
    userId: 1,
    amount: 850.0,
    riskLevel: "medium",
    isActive: true,
    autoCompound: true,
    totalProfit: 78.45,
    dailyProfit: 10.62,
    drawdown: 1.2,
    drawdownLimit: 5,
    peakBalance: 940.0,
    drawdownFromPeak: 1.2,
    recoveryPct: 1.21,
    isPaused: false,
    startedAt: ISO(-7 * 24 * 60 * 60 * 1000),
    stoppedAt: null,
  }),
  "POST /investment/start": () => DEMO_RESPONSES["GET /investment"](),
  "POST /investment/stop": () => DEMO_RESPONSES["GET /investment"](),

  // ─── trades — TOP-LEVEL ARRAY ────────────────────────────────────────────
  "GET /trades": () =>
    Array.from({ length: 12 }, (_, i) => {
      const profit = i % 3 === 0 ? -1.2 - i * 0.15 : 2.45 + i * 0.3;
      return {
        id: i + 1,
        symbol: ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"][i % 4],
        direction: i % 2 === 0 ? "LONG" : "SHORT",
        entryPrice: 42000 + i * 100,
        exitPrice: 42000 + i * 100 + (profit > 0 ? 250 : -180),
        profit,
        profitPercent: profit > 0 ? 0.6 + i * 0.05 : -0.3 - i * 0.02,
        executedAt: ISO(-i * 60 * 60 * 1000),
      };
    }),

  // ─── transactions ────────────────────────────────────────────────────────
  "GET /transactions": () => ({
    data: Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      userId: 1,
      type: ["deposit", "withdrawal", "daily_profit", "transfer", "referral"][i % 5],
      amount: 50 + i * 17.3,
      status: i < 2 ? "pending" : "completed",
      description: ["TRC20 USDT deposit", "INR withdrawal", "Daily profit", "Internal transfer", "Referral bonus"][i % 5],
      createdAt: ISO(-i * 4 * 60 * 60 * 1000),
    })),
    total: 15,
    page: 1,
    totalPages: 1,
  }),

  // ─── deposit ─────────────────────────────────────────────────────────────
  "GET /deposit/address": () => ({
    address: "TXyzAbc123Demo456Wallet789Address0Qor",
    network: "TRC20",
    token: "USDT",
  }),
  "GET /deposit/history": () => ({ deposits: [], total: 0 }),
  "POST /deposit/initiate": () => ({ success: true, depositId: "dep-demo-1" }),

  // ─── withdraw ────────────────────────────────────────────────────────────
  "POST /withdraw": () => ({ success: true, withdrawalId: "wd-demo-1", status: "pending" }),
  "POST /withdraw/verify-otp": () => ({ success: true }),

  // ─── transfer ────────────────────────────────────────────────────────────
  "POST /transfer": () => ({ success: true, transferId: "tr-demo-1" }),

  // ─── referral ────────────────────────────────────────────────────────────
  "GET /referral": () => ({
    referralCode: "QORIX2026",
    totalReferred: 8,
    activeReferrals: 5,
    totalEarned: 145.5,
    monthlyEarnings: 32.4,
  }),
  "GET /referral/referred-users": () =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      fullName: `User ${i + 1}`,
      email: `user${i + 1}@demo.com`,
      investmentAmount: 200 + i * 100,
      isActive: i < 3,
      joinedAt: ISO(-i * 7 * 24 * 60 * 60 * 1000),
    })),

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
      id: i + 1,
      userId: 1,
      type: ["daily_profit", "system", "system", "system", "deposit", "system"][i],
      title: ["Daily profit credited", "Trade closed", "Login from new device", "Welcome to Qorix", "Referral bonus", "VIP tier upgrade"][i],
      message: "Demo notification — design reference only.",
      isRead: i > 1,
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
  let path = u.pathname;
  // strip host-prefix junk + ALL repeated "/api" prefixes (handles
  // baseUrl ".../api" + generated "/api/..." double-prefix case)
  const apiIdx = path.indexOf("/api");
  if (apiIdx >= 0) path = path.slice(apiIdx);
  while (path.startsWith("/api")) path = path.slice(4);
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
