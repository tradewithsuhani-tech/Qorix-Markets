/** Unified broker API shapes — same for demo and live adapters. */

export type BrokerTradingMode = "demo" | "live";
export type BrokerId = "zerodha";

export interface BrokerProfile {
  broker: BrokerId | "demo";
  mode: BrokerTradingMode;
  userId: string;
  userName: string;
  email?: string;
  exchanges?: string[];
  connected: boolean;
}

export interface BrokerHolding {
  tradingsymbol: string;
  exchange: string;
  instrumentToken: number;
  isin?: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  pnl: number;
  dayChange: number;
  dayChangePct: number;
  product?: string;
}

export interface BrokerPosition {
  tradingsymbol: string;
  exchange: string;
  product: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  pnl: number;
  m2m: number;
  unrealised: number;
  realised: number;
  buyQuantity: number;
  sellQuantity: number;
  netQuantity: number;
}

export interface BrokerFunds {
  available: number;
  used: number;
  total: number;
  currency: string;
  breakdown?: Record<string, number>;
}

export interface BrokerQuote {
  instrument: string;
  tradingsymbol: string;
  exchange: string;
  lastPrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: string;
}

export interface DemoOrder {
  id: string;
  symbol: string;
  exchange: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  status: "filled";
  filledAt: string;
}

export interface DemoPortfolioState {
  cashBalance: number;
  holdings: BrokerHolding[];
  positions: BrokerPosition[];
  orders: DemoOrder[];
}

export interface BrokerPort {
  getProfile(userId: number): Promise<BrokerProfile>;
  getHoldings(userId: number): Promise<BrokerHolding[]>;
  getPositions(userId: number): Promise<BrokerPosition[]>;
  getFunds(userId: number): Promise<BrokerFunds>;
  getQuotes(userId: number, instruments: string[]): Promise<BrokerQuote[]>;
}
