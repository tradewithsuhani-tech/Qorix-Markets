import {
  type BrokerFunds,
  type BrokerHolding,
  type BrokerPort,
  type BrokerPosition,
  type BrokerProfile,
  type BrokerQuote,
  type DemoOrder,
  type DemoPortfolioState,
} from "./types";

/** Seed instruments for demo quotes when live feed unavailable. */
const DEMO_INSTRUMENTS: Record<
  string,
  { tradingsymbol: string; exchange: string; basePrice: number }
> = {
  "NSE:RELIANCE": { tradingsymbol: "RELIANCE", exchange: "NSE", basePrice: 2850 },
  "NSE:TCS": { tradingsymbol: "TCS", exchange: "NSE", basePrice: 4100 },
  "NSE:INFY": { tradingsymbol: "INFY", exchange: "NSE", basePrice: 1780 },
  "NSE:HDFCBANK": { tradingsymbol: "HDFCBANK", exchange: "NSE", basePrice: 1680 },
  "NSE:ICICIBANK": { tradingsymbol: "ICICIBANK", exchange: "NSE", basePrice: 1240 },
};

function hashSeed(userId: number, key: string): number {
  let h = userId * 31;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 1000) / 10000;
}

function demoQuote(userId: number, instrument: string): BrokerQuote {
  const meta = DEMO_INSTRUMENTS[instrument] ?? {
    tradingsymbol: instrument.split(":")[1] ?? instrument,
    exchange: instrument.split(":")[0] ?? "NSE",
    basePrice: 1000,
  };
  const jitter = hashSeed(userId, instrument);
  const last = meta.basePrice * (1 + jitter);
  const open = last * (1 - 0.002);
  const change = last - open;
  return {
    instrument,
    tradingsymbol: meta.tradingsymbol,
    exchange: meta.exchange,
    lastPrice: round2(last),
    open: round2(open),
    high: round2(last * 1.008),
    low: round2(last * 0.992),
    close: round2(open),
    change: round2(change),
    changePct: round2((change / open) * 100),
    volume: Math.floor(50000 + jitter * 1e6),
    timestamp: new Date().toISOString(),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function holdingValue(h: BrokerHolding): number {
  return h.quantity * h.lastPrice;
}

export function defaultDemoState(): DemoPortfolioState {
  return {
    cashBalance: 1_000_000,
    holdings: [],
    positions: [],
    orders: [],
  };
}

export function parseDemoState(raw: {
  cashBalance: string | number;
  holdings: unknown;
  positions: unknown;
  orders: unknown;
}): DemoPortfolioState {
  return {
    cashBalance: Number(raw.cashBalance),
    holdings: Array.isArray(raw.holdings) ? (raw.holdings as BrokerHolding[]) : [],
    positions: Array.isArray(raw.positions) ? (raw.positions as BrokerPosition[]) : [],
    orders: Array.isArray(raw.orders) ? (raw.orders as DemoOrder[]) : [],
  };
}

export function serializeDemoState(state: DemoPortfolioState) {
  return {
    cashBalance: String(state.cashBalance),
    holdings: state.holdings,
    positions: state.positions,
    orders: state.orders,
  };
}

export function applyDemoOrder(
  state: DemoPortfolioState,
  order: { symbol: string; side: "buy" | "sell"; quantity: number; price?: number },
  userId: number,
): { state: DemoPortfolioState; order: DemoOrder; error?: string } {
  const instrument = order.symbol.includes(":") ? order.symbol : `NSE:${order.symbol}`;
  const quote = demoQuote(userId, instrument);
  const price = order.price && order.price > 0 ? order.price : quote.lastPrice;
  const cost = price * order.quantity;

  if (order.side === "buy") {
    if (cost > state.cashBalance) {
      return { state, order: {} as DemoOrder, error: "Insufficient demo funds" };
    }
    const next = structuredClone(state);
    next.cashBalance = round2(next.cashBalance - cost);
    const idx = next.holdings.findIndex(
      (h) => `${h.exchange}:${h.tradingsymbol}` === instrument,
    );
    if (idx >= 0) {
      const h = next.holdings[idx]!;
      const totalQty = h.quantity + order.quantity;
      h.averagePrice = round2((h.averagePrice * h.quantity + cost) / totalQty);
      h.quantity = totalQty;
      h.lastPrice = price;
      h.pnl = round2((h.lastPrice - h.averagePrice) * h.quantity);
    } else {
      next.holdings.push({
        tradingsymbol: quote.tradingsymbol,
        exchange: quote.exchange,
        instrumentToken: 0,
        quantity: order.quantity,
        averagePrice: price,
        lastPrice: price,
        pnl: 0,
        dayChange: quote.change,
        dayChangePct: quote.changePct,
        product: "CNC",
      });
    }
    const filled: DemoOrder = {
      id: `demo-${Date.now()}`,
      symbol: instrument,
      exchange: quote.exchange,
      side: "buy",
      quantity: order.quantity,
      price,
      status: "filled",
      filledAt: new Date().toISOString(),
    };
    next.orders = [filled, ...next.orders].slice(0, 100);
    return { state: next, order: filled };
  }

  const idx = state.holdings.findIndex(
    (h) => `${h.exchange}:${h.tradingsymbol}` === instrument,
  );
  if (idx < 0) return { state, order: {} as DemoOrder, error: "No holdings to sell" };
  const h = state.holdings[idx]!;
  if (order.quantity > h.quantity) {
    return { state, order: {} as DemoOrder, error: "Insufficient quantity" };
  }
  const next = structuredClone(state);
  const nh = next.holdings[idx]!;
  nh.quantity -= order.quantity;
  if (nh.quantity === 0) next.holdings.splice(idx, 1);
  else {
    nh.lastPrice = price;
    nh.pnl = round2((nh.lastPrice - nh.averagePrice) * nh.quantity);
  }
  next.cashBalance = round2(next.cashBalance + cost);
  const filled: DemoOrder = {
    id: `demo-${Date.now()}`,
    symbol: instrument,
    exchange: quote.exchange,
    side: "sell",
    quantity: order.quantity,
    price,
    status: "filled",
    filledAt: new Date().toISOString(),
  };
  next.orders = [filled, ...next.orders].slice(0, 100);
  return { state: next, order: filled };
}

export class DemoBrokerAdapter implements BrokerPort {
  constructor(
    private loadState: (userId: number) => Promise<DemoPortfolioState>,
    private userLabel: (userId: number) => Promise<string>,
  ) {}

  async getProfile(userId: number): Promise<BrokerProfile> {
    const name = await this.userLabel(userId);
    return {
      broker: "demo",
      mode: "demo",
      userId: `demo-${userId}`,
      userName: name,
      connected: true,
      exchanges: ["NSE", "BSE"],
    };
  }

  async getHoldings(userId: number): Promise<BrokerHolding[]> {
    const state = await this.loadState(userId);
    return state.holdings.map((h) => {
      const q = demoQuote(userId, `${h.exchange}:${h.tradingsymbol}`);
      return {
        ...h,
        lastPrice: q.lastPrice,
        pnl: round2((q.lastPrice - h.averagePrice) * h.quantity),
        dayChange: q.change,
        dayChangePct: q.changePct,
      };
    });
  }

  async getPositions(_userId: number): Promise<BrokerPosition[]> {
    return [];
  }

  async getFunds(userId: number): Promise<BrokerFunds> {
    const state = await this.loadState(userId);
    const invested = state.holdings.reduce((s, h) => s + holdingValue(h), 0);
    return {
      available: round2(state.cashBalance),
      used: round2(invested),
      total: round2(state.cashBalance + invested),
      currency: "INR",
    };
  }

  async getQuotes(userId: number, instruments: string[]): Promise<BrokerQuote[]> {
    const list = instruments.length ? instruments : Object.keys(DEMO_INSTRUMENTS);
    return list.map((i) => demoQuote(userId, i.includes(":") ? i : `NSE:${i}`));
  }
}
