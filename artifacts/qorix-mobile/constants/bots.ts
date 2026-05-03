import type { BotStrategy } from "@/components/BotStrategyCard";

export const BOT_STRATEGIES: BotStrategy[] = [
  {
    id: "trend",
    name: "Trend-following Bot",
    description: "Momentum",
    returnsPct: 17,
    data: [12, 14, 13, 16, 18, 17, 21, 22, 25, 27, 26, 29],
    accent: "purple",
    active: true,
  },
  {
    id: "arbitrage",
    name: "Arbitrage Bot",
    description: "Spread",
    returnsPct: 12,
    data: [10, 11, 11, 13, 12, 14, 15, 14, 16, 17, 18, 19],
    accent: "blue",
    active: true,
  },
  {
    id: "scalp",
    name: "Scalping Bot",
    description: "HFT",
    returnsPct: 9,
    data: [8, 9, 10, 9, 11, 10, 12, 11, 13, 12, 14, 15],
    accent: "pink",
  },
  {
    id: "grid",
    name: "Grid Trading Bot",
    description: "Range",
    returnsPct: 14,
    data: [10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17],
    accent: "green",
  },
];
