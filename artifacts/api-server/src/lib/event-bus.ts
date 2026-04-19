import {
  depositEventQueue,
  profitDistributionEventQueue,
  profitDistributionQueue,
  type DepositEventJobData,
  type ProfitDistributionEventJobData,
  type ProfitDistributionJobData,
} from "./queues";

export async function emitProfitDistribution(
  data: Omit<ProfitDistributionJobData, "triggeredAt">,
): Promise<void> {
  await profitDistributionQueue.add("run-profit-distribution", {
    ...data,
    triggeredAt: new Date().toISOString(),
  });
}

export async function emitDepositEvent(
  data: Omit<DepositEventJobData, "triggeredAt">,
): Promise<void> {
  await depositEventQueue.add("deposit", {
    ...data,
    triggeredAt: new Date().toISOString(),
  });
}

export async function emitProfitDistributionEvent(
  data: Omit<ProfitDistributionEventJobData, "triggeredAt">,
): Promise<void> {
  await profitDistributionEventQueue.add("profit-credited", {
    ...data,
    triggeredAt: new Date().toISOString(),
  });
}
