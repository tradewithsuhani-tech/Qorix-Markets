import type { CoinRowData } from "@/components/CoinListItem";
import type { NewsItem } from "@/components/NewsCard";
import type { PromoBanner } from "@/components/PromoBannerCarousel";
import { generateCandles } from "@/components/CandlestickChart";

const spark = (count: number, start: number, vol: number, trend: number) => {
  const out: number[] = [];
  let p = start;
  for (let i = 0; i < count; i++) {
    p += (Math.random() - 0.5 + trend) * vol;
    out.push(p);
  }
  return out;
};

export const HOT_COINS: CoinRowData[] = [
  { id: "btc", symbol: "BTC", name: "Bitcoin", price: 67542.8, change24h: 2.41, volumeQuote: "$32.4B", spark: spark(20, 67000, 200, 0.15), logoColors: ["#F7931A", "#FFB347"], pair: "USDT" },
  { id: "eth", symbol: "ETH", name: "Ethereum", price: 3284.5, change24h: 3.12, volumeQuote: "$18.2B", spark: spark(20, 3200, 12, 0.18), logoColors: ["#627EEA", "#8FA1FF"], pair: "USDT" },
  { id: "sol", symbol: "SOL", name: "Solana", price: 148.7, change24h: 5.84, volumeQuote: "$4.1B", spark: spark(20, 142, 0.6, 0.25), logoColors: ["#14F195", "#9945FF"], pair: "USDT" },
  { id: "bnb", symbol: "BNB", name: "BNB", price: 612.4, change24h: 1.21, volumeQuote: "$1.8B", spark: spark(20, 608, 1.5, 0.12), logoColors: ["#F3BA2F", "#FCD34D"], pair: "USDT" },
  { id: "xrp", symbol: "XRP", name: "XRP", price: 0.5821, change24h: -1.34, volumeQuote: "$1.2B", spark: spark(20, 0.59, 0.003, -0.1), logoColors: ["#23292F", "#475569"], pair: "USDT" },
  { id: "ada", symbol: "ADA", name: "Cardano", price: 0.4612, change24h: 4.21, volumeQuote: "$680M", spark: spark(20, 0.45, 0.003, 0.18), logoColors: ["#0033AD", "#3B82F6"], pair: "USDT" },
  { id: "doge", symbol: "DOGE", name: "Dogecoin", price: 0.1521, change24h: -2.18, volumeQuote: "$840M", spark: spark(20, 0.155, 0.001, -0.15), logoColors: ["#C2A633", "#E5C455"], pair: "USDT" },
  { id: "matic", symbol: "MATIC", name: "Polygon", price: 0.7834, change24h: 6.42, volumeQuote: "$420M", spark: spark(20, 0.74, 0.005, 0.22), logoColors: ["#8247E5", "#A855F7"], pair: "USDT" },
];

export const GAINERS: CoinRowData[] = [
  { id: "matic", symbol: "MATIC", name: "Polygon", price: 0.7834, change24h: 14.82, volumeQuote: "$420M", spark: spark(20, 0.68, 0.006, 0.32), logoColors: ["#8247E5", "#A855F7"] },
  { id: "sol", symbol: "SOL", name: "Solana", price: 148.7, change24h: 12.42, volumeQuote: "$4.1B", spark: spark(20, 132, 1, 0.32), logoColors: ["#14F195", "#9945FF"] },
  { id: "ada", symbol: "ADA", name: "Cardano", price: 0.4612, change24h: 9.61, volumeQuote: "$680M", spark: spark(20, 0.42, 0.004, 0.32), logoColors: ["#0033AD", "#3B82F6"] },
  { id: "avax", symbol: "AVAX", name: "Avalanche", price: 38.42, change24h: 8.27, volumeQuote: "$520M", spark: spark(20, 35.4, 0.3, 0.32), logoColors: ["#E84142", "#F87171"] },
  { id: "link", symbol: "LINK", name: "Chainlink", price: 16.81, change24h: 6.92, volumeQuote: "$310M", spark: spark(20, 15.7, 0.13, 0.28), logoColors: ["#2A5ADA", "#5C7BFA"] },
];

export const LOSERS: CoinRowData[] = [
  { id: "doge", symbol: "DOGE", name: "Dogecoin", price: 0.1521, change24h: -8.42, volumeQuote: "$840M", spark: spark(20, 0.165, 0.0015, -0.32), logoColors: ["#C2A633", "#E5C455"] },
  { id: "shib", symbol: "SHIB", name: "Shiba Inu", price: 0.0000242, change24h: -6.21, volumeQuote: "$220M", spark: spark(20, 0.0000258, 0.0000003, -0.32), logoColors: ["#F00500", "#FF5C5C"] },
  { id: "xrp", symbol: "XRP", name: "XRP", price: 0.5821, change24h: -4.18, volumeQuote: "$1.2B", spark: spark(20, 0.61, 0.004, -0.32), logoColors: ["#23292F", "#475569"] },
  { id: "ltc", symbol: "LTC", name: "Litecoin", price: 84.21, change24h: -3.42, volumeQuote: "$320M", spark: spark(20, 87, 0.5, -0.32), logoColors: ["#345D9D", "#5C8AC9"] },
  { id: "uni", symbol: "UNI", name: "Uniswap", price: 7.84, change24h: -2.91, volumeQuote: "$110M", spark: spark(20, 8.1, 0.07, -0.32), logoColors: ["#FF007A", "#F472B6"] },
];

export const NEW_LISTINGS: CoinRowData[] = [
  { id: "tia", symbol: "TIA", name: "Celestia", price: 4.82, change24h: 28.41, volumeQuote: "$182M", spark: spark(20, 3.9, 0.08, 0.45), logoColors: ["#7B2BF9", "#C084FC"] },
  { id: "jup", symbol: "JUP", name: "Jupiter", price: 0.9842, change24h: 18.92, volumeQuote: "$95M", spark: spark(20, 0.85, 0.012, 0.42), logoColors: ["#10B981", "#34D399"] },
  { id: "pyth", symbol: "PYTH", name: "Pyth Network", price: 0.6421, change24h: 14.42, volumeQuote: "$72M", spark: spark(20, 0.58, 0.008, 0.40), logoColors: ["#9333EA", "#C084FC"] },
  { id: "manta", symbol: "MANTA", name: "Manta Network", price: 2.31, change24h: 11.21, volumeQuote: "$68M", spark: spark(20, 2.12, 0.025, 0.38), logoColors: ["#1F2937", "#6B7280"] },
];

export const PROMO_BANNERS: PromoBanner[] = [
  {
    id: "earn",
    title: "Earn up to 18% APY",
    subtitle: "Stake INR & crypto to earn passive income with auto-compounding bots",
    cta: "Start Earning",
    icon: "trending-up",
    gradient: ["#7C3AED", "#EC4899"],
  },
  {
    id: "ref",
    title: "Refer & Get ₹2,500",
    subtitle: "Invite friends and unlock bonus capital + lifetime fee discount",
    cta: "Invite Now",
    icon: "users",
    gradient: ["#0EA5E9", "#7C3AED"],
  },
  {
    id: "futures",
    title: "Futures Trading is Live",
    subtitle: "Trade with 100x leverage on BTC, ETH and 50+ pairs · Zero gas fees",
    cta: "Trade Futures",
    icon: "zap",
    gradient: ["#EF4444", "#F97316"],
  },
  {
    id: "ai",
    title: "AI Strategy Builder",
    subtitle: "Train your own bot with backtests on 5 years of historical data",
    cta: "Build Bot",
    icon: "cpu",
    gradient: ["#10B981", "#06B6D4"],
  },
];

export const NEWS_FEED: NewsItem[] = [
  {
    id: "n1",
    title: "Bitcoin breaks $67K resistance — analysts target $72K next week",
    source: "Bloomberg",
    time: "2m ago",
    category: "MARKETS",
    accent: ["#F7931A", "#FFB347"],
    icon: "trending-up",
    isHot: true,
  },
  {
    id: "n2",
    title: "RBI announces sandbox for retail tokenized deposits in Q3 FY26",
    source: "Economic Times",
    time: "18m ago",
    category: "REGULATION",
    accent: ["#3B82F6", "#60A5FA"],
    icon: "shield",
  },
  {
    id: "n3",
    title: "Ethereum L2 TVL hits $52B as institutional flows accelerate",
    source: "CoinDesk",
    time: "1h ago",
    category: "DEFI",
    accent: ["#627EEA", "#8FA1FF"],
    icon: "layers",
    isHot: true,
  },
  {
    id: "n4",
    title: "MomentumBot v2.1 model retrained with new feature set — accuracy up 3.2%",
    source: "AutoTrader",
    time: "3h ago",
    category: "PRODUCT",
    accent: ["#A855F7", "#EC4899"],
    icon: "cpu",
  },
];

export const QUICK_ACTIONS = [
  { id: "deposit", label: "Deposit", icon: "arrow-down-circle" as const, color: "#10D070" },
  { id: "withdraw", label: "Withdraw", icon: "arrow-up-circle" as const, color: "#A855F7" },
  { id: "buy", label: "Buy Crypto", icon: "credit-card" as const, color: "#60A5FA" },
  { id: "convert", label: "Convert", icon: "repeat" as const, color: "#FB923C" },
  { id: "p2p", label: "P2P", icon: "users" as const, color: "#EC4899" },
  { id: "earn", label: "Earn", icon: "trending-up" as const, color: "#10D070", badge: "18%" },
  { id: "deploy", label: "Deploy Bot", icon: "zap" as const, color: "#A855F7" },
  { id: "more", label: "More", icon: "grid" as const, color: "#8B85A1" },
];

export const BTC_CANDLES = generateCandles(28, 67250, 0.012);

export const ORDER_BOOK_BIDS = (() => {
  const out: { price: number; qty: number; total: number }[] = [];
  let total = 0;
  for (let i = 0; i < 6; i++) {
    const price = 67542 - i * 4.5;
    const qty = +(Math.random() * 0.8 + 0.2).toFixed(4);
    total += qty;
    out.push({ price, qty, total: +total.toFixed(4) });
  }
  return out;
})();

export const ORDER_BOOK_ASKS = (() => {
  const out: { price: number; qty: number; total: number }[] = [];
  let total = 0;
  for (let i = 0; i < 6; i++) {
    const price = 67548 + i * 4.5;
    const qty = +(Math.random() * 0.8 + 0.2).toFixed(4);
    total += qty;
    out.push({ price, qty, total: +total.toFixed(4) });
  }
  return out;
})();
