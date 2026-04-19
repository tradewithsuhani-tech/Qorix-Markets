import { Queue } from "bullmq";
import { redisConnection } from "./redis";

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

export const profitDistributionQueue = new Queue<ProfitDistributionJobData>(
  "profit-distribution",
  { connection: redisConnection },
);

export const depositEventQueue = new Queue<DepositEventJobData>(
  "deposit-event",
  { connection: redisConnection },
);

export const profitDistributionEventQueue = new Queue<ProfitDistributionEventJobData>(
  "profit-distribution-event",
  { connection: redisConnection },
);
