import { Queue } from "bullmq";
import { getRedisConnection } from "./redis";

export interface ProfitDistributionJobData {
  profitPercent: number;
  triggeredBy: "cron" | "admin";
  triggeredAt: string;
}

export interface DepositEventJobData {
  userId: number;
  amount: number;
  newMainBalance: number;
  triggeredAt: string;
}

export interface ProfitDistributionSummary {
  investorsAffected: number;
  totalProfitDistributed: number;
  referralBonusPaid: number;
  triggeredBy: "cron" | "admin";
}

export interface ProfitDistributionEventJobData {
  userId: number;
  amount: number;
  adjustedProfitPercent: number;
  riskLevel: string;
  autoCompound: boolean;
  triggeredAt: string;
  summary?: ProfitDistributionSummary;
}

// Queues are created lazily on first use so that merely importing this module
// (or any route that imports event-bus.ts) does NOT open a BullMQ/IORedis
// connection. This is what lets HTTP-only test suites boot the Express app
// without a running Redis.

let _profitDistributionQueue: Queue<ProfitDistributionJobData> | null = null;
let _depositEventQueue: Queue<DepositEventJobData> | null = null;
let _profitDistributionEventQueue: Queue<ProfitDistributionEventJobData> | null = null;

export function getProfitDistributionQueue(): Queue<ProfitDistributionJobData> {
  if (!_profitDistributionQueue) {
    _profitDistributionQueue = new Queue<ProfitDistributionJobData>(
      "profit-distribution",
      { connection: getRedisConnection() },
    );
  }
  return _profitDistributionQueue;
}

export function getDepositEventQueue(): Queue<DepositEventJobData> {
  if (!_depositEventQueue) {
    _depositEventQueue = new Queue<DepositEventJobData>(
      "deposit-event",
      { connection: getRedisConnection() },
    );
  }
  return _depositEventQueue;
}

export function getProfitDistributionEventQueue(): Queue<ProfitDistributionEventJobData> {
  if (!_profitDistributionEventQueue) {
    _profitDistributionEventQueue = new Queue<ProfitDistributionEventJobData>(
      "profit-distribution-event",
      { connection: getRedisConnection() },
    );
  }
  return _profitDistributionEventQueue;
}
