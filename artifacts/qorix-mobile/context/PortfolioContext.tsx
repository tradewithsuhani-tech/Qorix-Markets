import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  deposit as apiDeposit,
  getDashboardPerformance as apiGetDashboardPerformance,
  getEquityChart as apiGetEquityChart,
  getTrades as apiGetTrades,
  getTransactions as apiGetTransactions,
  getWallet as apiGetWallet,
  startInvestment as apiStartInvestment,
  stopInvestment as apiStopInvestment,
  transferToTrading as apiTransferToTrading,
  withdraw as apiWithdraw,
} from "@workspace/api-client-react";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { FX_RATE } from "@/lib/tx-mapper";

export type TransactionType = "deposit" | "withdrawal" | "income" | "fee" | "transfer";

export type TransferDirection = "main_to_trading" | "trading_to_main";
export type TransactionStatus = "pending" | "completed" | "failed";
export type TradeSide = "BUY" | "SELL";
export type AssetClass = "equity" | "fno" | "crypto";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description: string;
  createdAt: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  executedAt: string;
  assetClass: AssetClass;
}

export interface IncomeEntry {
  id: string;
  cycleDate: string;
  grossPnl: number;
  companyFee: number;
  clientIncome: number;
  tdsDeducted: number;
  creditedAt: string;
}

export interface BotActivity {
  id: string;
  message: string;
  timestamp: string;
  type: "scan" | "signal" | "trade" | "exit" | "info";
}

export interface OpenPosition {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  entryPrice: number;
  currentPrice: number;
  assetClass: AssetClass;
}

export interface DailyPnLEntry {
  date: string;
  pnl: number;
  label: string;
}

export interface Mover {
  symbol: string;
  changePct: number;
  pnl: number;
}

export interface Wallet {
  balance: number;
  lockedAmount: number;
}

export interface Portfolio {
  deployedAmount: number;
  currentNAV: number;
  riskTier: string;
  botName: string;
  totalPnL: number;
  dailyPnL: number;
  status: "active" | "inactive" | "paused";
  deployedAt: string;
  navHistory: number[];
  navHistoryByTimeframe: {
    "1D": number[];
    "1W": number[];
    "1M": number[];
    "3M": number[];
    "ALL": number[];
  };
  winRate: number;
  totalTrades: number;
  winTrades: number;
  sharpeRatio: number;
  maxDrawdown: number;
  signalsScannedToday: number;
  tradesExecutedToday: number;
  accuracyToday: number;
  allocation: { equity: number; fno: number; crypto: number };
  tier: "Silver" | "Gold" | "Platinum" | "Diamond";
  tierProgress: number;
  nextTier: string;
  amountToNextTier: number;
  dailyPnLHistory: DailyPnLEntry[];
  topGainers: Mover[];
  topLosers: Mover[];
}

interface PortfolioState {
  wallet: Wallet;
  portfolio: Portfolio | null;
  trades: Trade[];
  transactions: Transaction[];
  incomeLedger: IncomeEntry[];
  botActivity: BotActivity[];
  openPositions: OpenPosition[];
}

interface PortfolioContextValue extends PortfolioState {
  deposit: (amount: number) => Promise<void>;
  withdraw: (amount: number, description?: string) => Promise<void>;
  deployCapital: (amount: number, riskTier: string) => Promise<void>;
  stopStrategy: () => Promise<{ capitalReturned: number; finalPnL: number }>;
  transfer: (direction: TransferDirection, amount: number) => Promise<void>;
  refreshData: () => void;
}

const STORAGE_KEY_BASE = "@autotrader_portfolio_v3";
const storageKeyFor = (userId: string | null | undefined) =>
  userId ? `${STORAGE_KEY_BASE}:${userId}` : `${STORAGE_KEY_BASE}:guest`;

const SEED_TRADES: Trade[] = [
  { id: "t1", symbol: "RELIANCE", side: "BUY", qty: 10, entryPrice: 2841.5, exitPrice: 2867.3, pnl: 258.0, executedAt: "2026-05-02T09:15:00Z", assetClass: "equity" },
  { id: "t2", symbol: "NIFTY 22500 CE", side: "BUY", qty: 50, entryPrice: 145.5, exitPrice: 168.25, pnl: 1137.5, executedAt: "2026-05-02T09:32:00Z", assetClass: "fno" },
  { id: "t3", symbol: "BTC/USDT", side: "BUY", qty: 0.025, entryPrice: 65840.0, exitPrice: 67248.3, pnl: 35.21, executedAt: "2026-05-02T11:48:00Z", assetClass: "crypto" },
  { id: "t4", symbol: "HDFC BANK", side: "SELL", qty: 5, entryPrice: 1652.0, exitPrice: 1618.4, pnl: 168.0, executedAt: "2026-05-01T10:05:00Z", assetClass: "equity" },
  { id: "t5", symbol: "INFY", side: "BUY", qty: 15, entryPrice: 1432.0, exitPrice: 1419.5, pnl: -187.5, executedAt: "2026-05-01T11:20:00Z", assetClass: "equity" },
  { id: "t6", symbol: "TCS", side: "BUY", qty: 8, entryPrice: 3980.0, exitPrice: 4021.5, pnl: 332.0, executedAt: "2026-04-30T09:45:00Z", assetClass: "equity" },
  { id: "t7", symbol: "BANKNIFTY 47600 PE", side: "BUY", qty: 30, entryPrice: 218.0, exitPrice: 253.0, pnl: 1050.0, executedAt: "2026-04-30T14:10:00Z", assetClass: "fno" },
  { id: "t8", symbol: "ETH/USDT", side: "BUY", qty: 0.5, entryPrice: 3245.0, exitPrice: 3284.5, pnl: 19.75, executedAt: "2026-04-30T15:30:00Z", assetClass: "crypto" },
  { id: "t9", symbol: "WIPRO", side: "BUY", qty: 30, entryPrice: 462.0, exitPrice: 458.5, pnl: -105.0, executedAt: "2026-04-29T09:55:00Z", assetClass: "equity" },
  { id: "t10", symbol: "LTIM", side: "BUY", qty: 12, entryPrice: 5230.0, exitPrice: 5318.0, pnl: 1056.0, executedAt: "2026-04-29T13:30:00Z", assetClass: "equity" },
  { id: "t11", symbol: "NIFTY 22300 PE", side: "SELL", qty: 50, entryPrice: 95.0, exitPrice: 78.5, pnl: 825.0, executedAt: "2026-04-28T11:15:00Z", assetClass: "fno" },
  { id: "t12", symbol: "SOL/USDT", side: "BUY", qty: 5, entryPrice: 142.5, exitPrice: 148.7, pnl: 31.0, executedAt: "2026-04-28T16:42:00Z", assetClass: "crypto" },
];

const SEED_TRANSACTIONS: Transaction[] = [
  { id: "tx1", type: "deposit", amount: 50000, status: "completed", description: "UPI deposit – HDFC Bank", createdAt: "2026-04-15T10:00:00Z" },
  { id: "tx2", type: "income", amount: 1842, status: "completed", description: "Daily income – Apr 28", createdAt: "2026-04-28T23:59:00Z" },
  { id: "tx3", type: "income", amount: 2103, status: "completed", description: "Daily income – Apr 29", createdAt: "2026-04-29T23:59:00Z" },
  { id: "tx4", type: "income", amount: 725, status: "completed", description: "Daily income – Apr 30", createdAt: "2026-04-30T23:59:00Z" },
  { id: "tx5", type: "income", amount: 1268, status: "completed", description: "Daily income – May 01", createdAt: "2026-05-01T23:59:00Z" },
  { id: "tx6", type: "deposit", amount: 20000, status: "completed", description: "Net Banking – SBI", createdAt: "2026-04-25T09:30:00Z" },
];

const SEED_INCOME: IncomeEntry[] = [
  { id: "i1", cycleDate: "2026-05-01", grossPnl: 1585.0, companyFee: 317.0, clientIncome: 1268.0, tdsDeducted: 0, creditedAt: "2026-05-01T23:59:00Z" },
  { id: "i2", cycleDate: "2026-04-30", grossPnl: 906.25, companyFee: 181.25, clientIncome: 725.0, tdsDeducted: 0, creditedAt: "2026-04-30T23:59:00Z" },
  { id: "i3", cycleDate: "2026-04-29", grossPnl: 2628.75, companyFee: 525.75, clientIncome: 2103.0, tdsDeducted: 0, creditedAt: "2026-04-29T23:59:00Z" },
  { id: "i4", cycleDate: "2026-04-28", grossPnl: 2302.5, companyFee: 460.5, clientIncome: 1842.0, tdsDeducted: 0, creditedAt: "2026-04-28T23:59:00Z" },
];

const SEED_BOT_ACTIVITY: BotActivity[] = [
  { id: "b1", message: "Scanning order book imbalance on BANKNIFTY", timestamp: new Date(Date.now() - 30000).toISOString(), type: "scan" },
  { id: "b2", message: "Bullish momentum detected on RELIANCE — confidence 87%", timestamp: new Date(Date.now() - 120000).toISOString(), type: "signal" },
  { id: "b3", message: "Executed BUY order: BTC/USDT × 0.025 @ ₹65,840", timestamp: new Date(Date.now() - 240000).toISOString(), type: "trade" },
  { id: "b4", message: "Target hit on RELIANCE — booking profit at +0.91%", timestamp: new Date(Date.now() - 360000).toISOString(), type: "exit" },
  { id: "b5", message: "Volatility spike detected — switching to scalp mode", timestamp: new Date(Date.now() - 480000).toISOString(), type: "info" },
  { id: "b6", message: "EMA 9/21 bullish crossover on NIFTY 5-min", timestamp: new Date(Date.now() - 600000).toISOString(), type: "signal" },
];

const SEED_OPEN_POSITIONS: OpenPosition[] = [
  { id: "op1", symbol: "RELIANCE", side: "BUY", qty: 8, entryPrice: 2854.0, currentPrice: 2891.5, assetClass: "equity" },
  { id: "op2", symbol: "NIFTY 22500 CE", side: "BUY", qty: 50, entryPrice: 168.25, currentPrice: 182.4, assetClass: "fno" },
  { id: "op3", symbol: "BTC/USDT", side: "BUY", qty: 0.018, entryPrice: 67248.3, currentPrice: 67542.8, assetClass: "crypto" },
  { id: "op4", symbol: "TCS", side: "SELL", qty: 4, entryPrice: 4021.5, currentPrice: 4008.0, assetClass: "equity" },
];

// Multi-timeframe NAV histories
const NAV_1D = [54200, 54180, 54250, 54320, 54290, 54380, 54420, 54480, 54530, 54580, 54620, 54670];
const NAV_1W = [52890, 53120, 53420, 53780, 54200, 54420, 54670];
const NAV_1M = [50000, 50180, 50420, 50320, 50890, 51240, 51120, 51780, 52340, 52890, 53120, 53850, 54200, 54670];
const NAV_3M = [45200, 46100, 46800, 47500, 48200, 48900, 49500, 50000, 50890, 51780, 52340, 53120, 54200, 54670];
const NAV_ALL = [40000, 41200, 42500, 43800, 45200, 46800, 48200, 49500, 50890, 51780, 53120, 54200, 54670];

const SEED_DAILY_PNL: DailyPnLEntry[] = [
  { date: "2026-04-26", pnl: 845, label: "Sun" },
  { date: "2026-04-27", pnl: -312, label: "Mon" },
  { date: "2026-04-28", pnl: 1842, label: "Tue" },
  { date: "2026-04-29", pnl: 2103, label: "Wed" },
  { date: "2026-04-30", pnl: 725, label: "Thu" },
  { date: "2026-05-01", pnl: 1268, label: "Fri" },
  { date: "2026-05-02", pnl: 895, label: "Sat" },
];

const SEED_GAINERS: Mover[] = [
  { symbol: "BTC/USDT", changePct: 14.21, pnl: 1208 },
  { symbol: "RELIANCE", changePct: 8.45, pnl: 824 },
  { symbol: "NIFTY CE", changePct: 6.32, pnl: 1137 },
];

const SEED_LOSERS: Mover[] = [
  { symbol: "INFY", changePct: -1.87, pnl: -187 },
  { symbol: "WIPRO", changePct: -0.76, pnl: -105 },
  { symbol: "TCS", changePct: -0.34, pnl: -54 },
];

const DEFAULT_PORTFOLIO: Portfolio = {
  deployedAmount: 50000,
  currentNAV: 54670,
  riskTier: "moderate",
  botName: "MomentumBot v2.1",
  totalPnL: 4670,
  dailyPnL: 895,
  status: "active",
  deployedAt: "2026-04-15T10:00:00Z",
  navHistory: NAV_1M,
  navHistoryByTimeframe: { "1D": NAV_1D, "1W": NAV_1W, "1M": NAV_1M, "3M": NAV_3M, "ALL": NAV_ALL },
  winRate: 73.2,
  totalTrades: 41,
  winTrades: 30,
  sharpeRatio: 2.14,
  maxDrawdown: 4.8,
  signalsScannedToday: 1284,
  tradesExecutedToday: 7,
  accuracyToday: 85.7,
  allocation: { equity: 45, fno: 35, crypto: 20 },
  tier: "Gold",
  tierProgress: 47,
  nextTier: "Platinum",
  amountToNextTier: 45330,
  dailyPnLHistory: SEED_DAILY_PNL,
  topGainers: SEED_GAINERS,
  topLosers: SEED_LOSERS,
};

const DEFAULT_STATE: PortfolioState = {
  wallet: { balance: 24911, lockedAmount: 50000 },
  portfolio: DEFAULT_PORTFOLIO,
  trades: SEED_TRADES,
  transactions: SEED_TRANSACTIONS,
  incomeLedger: SEED_INCOME,
  botActivity: SEED_BOT_ACTIVITY,
  openPositions: SEED_OPEN_POSITIONS,
};

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [state, setState] = useState<PortfolioState>(DEFAULT_STATE);
  // Always-fresh snapshot for async closures so we never read stale captured `state`.
  const stateRef = useRef(state);
  stateRef.current = state;
  const isDemoUser = user?.id === "demo_001";
  const userId = user?.id ?? null;
  const storageKeyRef = useRef(storageKeyFor(userId));
  storageKeyRef.current = storageKeyFor(userId);
  // Module-scoped in-flight lock to prevent concurrent transfer invocations
  // from any caller (defensive against rapid double-taps that bypass UI state).
  const transferInFlightRef = useRef(false);

  // Reload portfolio state whenever the active user changes so we never
  // surface a previous account's portfolio/trades/transactions to a new user.
  useEffect(() => {
    let cancelled = false;
    const key = storageKeyFor(userId);
    AsyncStorage.getItem(key).then((raw) => {
      if (cancelled) return;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PortfolioState;
          setState(parsed);
          stateRef.current = parsed;
          return;
        } catch {}
      }
      setState(DEFAULT_STATE);
      stateRef.current = DEFAULT_STATE;
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Live NAV drift simulation
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        if (!prev.portfolio) return prev;
        const drift = (Math.random() - 0.45) * 80;
        const newNAV = Math.max(prev.portfolio.deployedAmount * 0.95, prev.portfolio.currentNAV + drift);
        const newDailyPnL = prev.portfolio.dailyPnL + drift;
        const newTotalPnL = newNAV - prev.portfolio.deployedAmount;
        return {
          ...prev,
          portfolio: {
            ...prev.portfolio,
            currentNAV: newNAV,
            dailyPnL: newDailyPnL,
            totalPnL: newTotalPnL,
          },
        };
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const save = async (next: PortfolioState) => {
    setState(next);
    stateRef.current = next;
    try {
      await AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(next));
    } catch {}
  };

  // Sync wallet balance from Qorix API. Skipped for the offline demo account.
  const syncWalletFromApi = async () => {
    if (!isAuthenticated || isDemoUser) return;
    try {
      const w = await apiGetWallet();
      const current = stateRef.current;
      const usdtBal = Number((w as any).usdtBalance) || 0;
      const inrBal = Number(w.mainBalance) || 0;
      const next: PortfolioState = {
        ...current,
        wallet: {
          balance: inrBal / FX_RATE + usdtBal,
          lockedAmount: Number(w.tradingBalance) || 0,
        },
      };
      await save(next);
    } catch {
      /* ignore — keep cached wallet */
    }
  };

  // Sync recent bot trades from Qorix API (real bot trade history).
  const syncTradesFromApi = async () => {
    if (!isAuthenticated || isDemoUser) return;
    try {
      const list = await apiGetTrades({ limit: 50 });
      const mapped: Trade[] = list.map((t) => {
        const sym = String(t.symbol ?? "");
        const ac: AssetClass = /USDT|BTC|ETH|SOL/i.test(sym)
          ? "crypto"
          : /CE|PE|FUT|NIFTY|BANKNIFTY/i.test(sym)
            ? "fno"
            : "equity";
        const qty = Math.max(1, Math.round((Number(t.profit) || 0) / Math.max(1, Number(t.exitPrice) - Number(t.entryPrice) || 1)));
        return {
          id: String(t.id),
          symbol: sym,
          side: (String(t.direction).toUpperCase() === "SELL" ? "SELL" : "BUY") as TradeSide,
          qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
          entryPrice: Number(t.entryPrice) || 0,
          exitPrice: Number(t.exitPrice) || 0,
          pnl: Number(t.profit) || 0,
          executedAt: String(t.executedAt),
          assetClass: ac,
        };
      });
      const current = stateRef.current;
      // Always overwrite (even with empty list) so a new user does not inherit
      // the previous account's cached trades.
      await save({ ...current, trades: mapped });
    } catch {
      /* ignore — keep cached trades */
    }
  };

  // Sync transaction history from Qorix API.
  const syncTransactionsFromApi = async () => {
    if (!isAuthenticated || isDemoUser) return;
    try {
      const res = await apiGetTransactions({ limit: 50, page: 1 });
      const mapped: Transaction[] = (res.data ?? []).map((t) => {
        const rawType = String(t.type ?? "").toLowerCase();
        const type: TransactionType =
          rawType === "deposit" ? "deposit"
          : rawType === "withdrawal" || rawType === "withdraw" ? "withdrawal"
          : rawType === "income" || rawType === "profit" ? "income"
          : rawType === "fee" ? "fee"
          : "transfer";
        const rawStatus = String(t.status ?? "").toLowerCase();
        const status: TransactionStatus =
          rawStatus === "completed" || rawStatus === "success" ? "completed"
          : rawStatus === "failed" || rawStatus === "rejected" ? "failed"
          : "pending";
        return {
          id: String(t.id),
          type,
          amount: Number(t.amount) || 0,
          status,
          description: t.description ?? `${type.charAt(0).toUpperCase()}${type.slice(1)}`,
          createdAt: String(t.createdAt),
        };
      });
      const current = stateRef.current;
      // Always overwrite (even with empty list) so a new user does not inherit
      // the previous account's cached transactions.
      await save({ ...current, transactions: mapped });
    } catch {
      /* ignore — keep cached transactions */
    }
  };

  // Sync portfolio analytics (win rate, sharpe-ish, drawdown) + equity history.
  const syncPerformanceFromApi = async () => {
    if (!isAuthenticated || isDemoUser) return;
    try {
      const [perf, eq30, eq7, eq90] = await Promise.all([
        apiGetDashboardPerformance().catch(() => null),
        apiGetEquityChart({ days: 30 }).catch(() => []),
        apiGetEquityChart({ days: 7 }).catch(() => []),
        apiGetEquityChart({ days: 90 }).catch(() => []),
      ]);
      const current = stateRef.current;
      if (!current.portfolio) return;
      const seriesFrom = (pts: Array<{ equity: number }>) =>
        pts.length > 0 ? pts.map((p) => Number(p.equity) || 0) : current.portfolio!.navHistory;
      const m30 = seriesFrom(eq30 ?? []);
      const m7 = seriesFrom(eq7 ?? []);
      const m90 = seriesFrom(eq90 ?? []);
      const winTrades = perf
        ? Math.round(((perf.winRate ?? 0) / 100) * (perf.totalTrades ?? 0))
        : current.portfolio.winTrades;
      const next: PortfolioState = {
        ...current,
        portfolio: {
          ...current.portfolio,
          winRate: perf?.winRate ?? current.portfolio.winRate,
          totalTrades: perf?.totalTrades ?? current.portfolio.totalTrades,
          winTrades,
          maxDrawdown: perf?.maxDrawdown ?? current.portfolio.maxDrawdown,
          navHistory: m30,
          navHistoryByTimeframe: {
            "1D": current.portfolio.navHistoryByTimeframe["1D"],
            "1W": m7,
            "1M": m30,
            "3M": m90,
            "ALL": m90.length >= m30.length ? m90 : m30,
          },
        },
      };
      await save(next);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    syncWalletFromApi();
    syncTradesFromApi();
    syncTransactionsFromApi();
    syncPerformanceFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isDemoUser]);

  const deposit = async (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Deposit amount must be greater than 0");
    }
    if (isAuthenticated && !isDemoUser) {
      try {
        await apiDeposit({ amount });
      } catch (err) {
        const e = err as { data?: { error?: string }; message?: string };
        throw new Error(e?.data?.error ?? e?.message ?? "Deposit failed");
      }
    } else {
      await new Promise((r) => setTimeout(r, 1200));
    }
    const current = stateRef.current;
    const tx: Transaction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "deposit",
      amount,
      status: "completed",
      description: "USDT deposit",
      createdAt: new Date().toISOString(),
    };
    const next: PortfolioState = {
      ...current,
      wallet: { ...current.wallet, balance: current.wallet.balance + amount },
      transactions: [tx, ...current.transactions],
    };
    await save(next);
    syncWalletFromApi();
  };

  const withdraw = async (amount: number, description?: string) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Withdrawal amount must be greater than 0");
    }
    const current = stateRef.current;
    if (amount > current.wallet.balance) {
      throw new Error("Insufficient balance for this withdrawal");
    }
    if (isAuthenticated && !isDemoUser) {
      try {
        await apiWithdraw({ amount, walletAddress: description ?? "user-wallet" });
      } catch (err) {
        const e = err as { data?: { error?: string }; message?: string };
        throw new Error(e?.data?.error ?? e?.message ?? "Withdrawal failed");
      }
    } else {
      await new Promise((r) => setTimeout(r, 1200));
    }
    const tx: Transaction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "withdrawal",
      amount,
      status: "pending",
      description: description ?? "Withdrawal request",
      createdAt: new Date().toISOString(),
    };
    const next: PortfolioState = {
      ...stateRef.current,
      wallet: { ...stateRef.current.wallet, balance: stateRef.current.wallet.balance - amount },
      transactions: [tx, ...stateRef.current.transactions],
    };
    await save(next);
    syncWalletFromApi();
  };

  const deployCapital = async (amount: number, riskTier: string) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Deploy amount must be greater than 0");
    }
    const current = stateRef.current;
    if (amount > current.wallet.balance) {
      throw new Error("Insufficient balance to deploy");
    }
    if (isAuthenticated && !isDemoUser) {
      try {
        await apiStartInvestment({ amount, riskLevel: riskTier });
      } catch (err) {
        const e = err as { data?: { error?: string }; message?: string };
        throw new Error(e?.data?.error ?? e?.message ?? "Could not start strategy");
      }
    } else {
      await new Promise((r) => setTimeout(r, 1500));
    }
    const botMap: Record<string, string> = {
      conservative: "ScalpBot v1.3",
      moderate: "MomentumBot v2.1",
      aggressive: "ArbitrageBot v3.0",
    };
    const portfolio: Portfolio = {
      ...DEFAULT_PORTFOLIO,
      deployedAmount: amount,
      currentNAV: amount,
      riskTier,
      botName: botMap[riskTier] ?? "AlgoBot",
      totalPnL: 0,
      dailyPnL: 0,
      navHistory: [amount],
      navHistoryByTimeframe: {
        "1D": [amount], "1W": [amount], "1M": [amount], "3M": [amount], "ALL": [amount],
      },
      deployedAt: new Date().toISOString(),
      totalTrades: 0,
      winTrades: 0,
      signalsScannedToday: 0,
      tradesExecutedToday: 0,
    };
    const next: PortfolioState = {
      ...current,
      wallet: {
        balance: current.wallet.balance - amount,
        lockedAmount: current.wallet.lockedAmount + amount,
      },
      portfolio,
    };
    await save(next);
    syncWalletFromApi();
  };

  const stopStrategy = async () => {
    const current = stateRef.current;
    const capitalReturned = current.portfolio?.currentNAV ?? 0;
    const finalPnL = current.portfolio?.totalPnL ?? 0;
    if (isAuthenticated && !isDemoUser) {
      try {
        await apiStopInvestment();
      } catch (err) {
        const e = err as { data?: { error?: string }; message?: string };
        throw new Error(e?.data?.error ?? e?.message ?? "Could not stop strategy");
      }
    } else {
      await new Promise((r) => setTimeout(r, 600));
    }
    const next: PortfolioState = {
      ...stateRef.current,
      wallet: {
        balance: stateRef.current.wallet.balance + capitalReturned,
        lockedAmount: Math.max(0, stateRef.current.wallet.lockedAmount - capitalReturned),
      },
      portfolio: null,
    };
    await save(next);
    syncWalletFromApi();
    return { capitalReturned, finalPnL };
  };

  const transfer = async (direction: TransferDirection, amount: number) => {
    if (direction !== "main_to_trading" && direction !== "trading_to_main") {
      throw new Error("Invalid transfer direction");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Transfer amount must be greater than 0");
    }
    if (amount < 100) {
      throw new Error("Minimum transfer is ₹100");
    }
    if (transferInFlightRef.current) {
      throw new Error("Another transfer is already in progress");
    }
    transferInFlightRef.current = true;
    try {
      if (isAuthenticated && !isDemoUser) {
        try {
          await apiTransferToTrading({
            amount,
            direction: direction === "main_to_trading" ? "to_trading" : "to_main",
          });
        } catch (err) {
          const e = err as { data?: { error?: string }; message?: string };
          throw new Error(e?.data?.error ?? e?.message ?? "Transfer failed");
        }
      } else {
        await new Promise((r) => setTimeout(r, 900));
      }
      const current = stateRef.current;

      if (direction === "main_to_trading") {
        if (!current.portfolio) {
          throw new Error("Deploy capital first to enable trading transfers");
        }
        if (amount > current.wallet.balance) {
          throw new Error("Insufficient main wallet balance");
        }
        const tx: Transaction = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: "transfer",
          amount,
          status: "completed",
          description: "Transfer · Main → Trading",
          createdAt: new Date().toISOString(),
        };
        const next: PortfolioState = {
          ...current,
          wallet: {
            balance: current.wallet.balance - amount,
            lockedAmount: current.wallet.lockedAmount + amount,
          },
          portfolio: {
            ...current.portfolio,
            deployedAmount: current.portfolio.deployedAmount + amount,
            currentNAV: current.portfolio.currentNAV + amount,
          },
          transactions: [tx, ...current.transactions],
        };
        await save(next);
        return;
      }

      // trading_to_main
      if (!current.portfolio) {
        throw new Error("No trading wallet to transfer from");
      }
      if (amount > current.portfolio.currentNAV) {
        throw new Error("Insufficient trading wallet balance");
      }
      const tx: Transaction = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "transfer",
        amount,
        status: "completed",
        description: "Transfer · Trading → Main",
        createdAt: new Date().toISOString(),
      };
      // Reduce deployedAmount proportionally so totalPnL ratio is preserved.
      const navRatio = current.portfolio.currentNAV > 0 ? amount / current.portfolio.currentNAV : 1;
      const deployedDelta = current.portfolio.deployedAmount * navRatio;
      const newDeployed = Math.max(0, current.portfolio.deployedAmount - deployedDelta);
      const newNav = current.portfolio.currentNAV - amount;
      const next: PortfolioState = {
        ...current,
        wallet: {
          balance: current.wallet.balance + amount,
          lockedAmount: Math.max(0, current.wallet.lockedAmount - deployedDelta),
        },
        portfolio: {
          ...current.portfolio,
          deployedAmount: newDeployed,
          currentNAV: newNav,
          totalPnL: newNav - newDeployed,
        },
        transactions: [tx, ...current.transactions],
      };
      await save(next);
    } finally {
      transferInFlightRef.current = false;
      syncWalletFromApi();
    }
  };

  const refreshData = () => {
    syncWalletFromApi();
    syncTradesFromApi();
    syncTransactionsFromApi();
    syncPerformanceFromApi();
  };

  return (
    <PortfolioContext.Provider value={{ ...state, deposit, withdraw, deployCapital, stopStrategy, transfer, refreshData }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within PortfolioProvider");
  return ctx;
}
