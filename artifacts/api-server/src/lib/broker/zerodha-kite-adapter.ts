import crypto from "crypto";
import {
  type BrokerFunds,
  type BrokerHolding,
  type BrokerPort,
  type BrokerPosition,
  type BrokerProfile,
  type BrokerQuote,
} from "./types";

const KITE_BASE = "https://api.kite.trade";

export interface KiteSession {
  apiKey: string;
  accessToken: string;
}

function authHeader(session: KiteSession): string {
  return `token ${session.apiKey}:${session.accessToken}`;
}

async function kiteGet<T>(
  session: KiteSession,
  path: string,
  query?: Record<string, string | string[]>,
): Promise<T> {
  const url = new URL(`${KITE_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, item);
      } else url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: authHeader(session),
      "X-Kite-Version": "3",
    },
  });
  const body = (await res.json()) as { status?: string; message?: string; data?: T };
  if (!res.ok || body.status === "error") {
    throw new Error(body.message ?? `Kite API error ${res.status}`);
  }
  return body.data as T;
}

export function getKiteLoginUrl(apiKey: string, redirectUrl: string): string {
  return `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(apiKey)}&redirect_url=${encodeURIComponent(redirectUrl)}`;
}

export async function exchangeKiteRequestToken(
  apiKey: string,
  apiSecret: string,
  requestToken: string,
): Promise<{ accessToken: string; userId: string; userName: string; loginTime: string }> {
  const checksum = await sha256Hex(`${apiKey}${requestToken}${apiSecret}`);
  const res = await fetch(`${KITE_BASE}/session/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Kite-Version": "3",
    },
    body: new URLSearchParams({
      api_key: apiKey,
      request_token: requestToken,
      checksum,
    }),
  });
  const body = (await res.json()) as {
    status?: string;
    message?: string;
    data?: {
      access_token: string;
      user_id: string;
      user_name: string;
      login_time: string;
    };
  };
  if (!res.ok || body.status === "error" || !body.data) {
    throw new Error(body.message ?? "Failed to exchange Kite request token");
  }
  return {
    accessToken: body.data.access_token,
    userId: body.data.user_id,
    userName: body.data.user_name,
    loginTime: body.data.login_time,
  };
}

async function sha256Hex(input: string): Promise<string> {
  return crypto.createHash("sha256").update(input).digest("hex");
}

interface KiteProfile {
  user_id: string;
  user_name: string;
  email: string;
  exchanges: string[];
}

interface KiteHolding {
  tradingsymbol: string;
  exchange: string;
  instrument_token: number;
  isin?: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
  product?: string;
}

interface KitePositionDay {
  tradingsymbol: string;
  exchange: string;
  product: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  m2m: number;
  unrealised: number;
  realised: number;
  buy_quantity: number;
  sell_quantity: number;
  net_quantity: number;
}

interface KiteMargins {
  equity?: {
    net?: number;
    available?: { cash?: number; live_balance?: number };
    utilised?: { debits?: number };
  };
}

interface KiteQuoteEntry {
  instrument_token: number;
  timestamp: string;
  last_price: number;
  ohlc?: { open: number; high: number; low: number; close: number };
  volume?: number;
}

export class ZerodhaKiteAdapter implements BrokerPort {
  constructor(private session: KiteSession) {}

  async getProfile(_userId: number): Promise<BrokerProfile> {
    const p = await kiteGet<KiteProfile>(this.session, "/user/profile");
    return {
      broker: "zerodha",
      mode: "live",
      userId: p.user_id,
      userName: p.user_name,
      email: p.email,
      exchanges: p.exchanges,
      connected: true,
    };
  }

  async getHoldings(_userId: number): Promise<BrokerHolding[]> {
    const rows = await kiteGet<KiteHolding[]>(this.session, "/portfolio/holdings");
    return rows.map((h) => ({
      tradingsymbol: h.tradingsymbol,
      exchange: h.exchange,
      instrumentToken: h.instrument_token,
      isin: h.isin,
      quantity: h.quantity,
      averagePrice: h.average_price,
      lastPrice: h.last_price,
      pnl: h.pnl,
      dayChange: h.day_change,
      dayChangePct: h.day_change_percentage,
      product: h.product,
    }));
  }

  async getPositions(_userId: number): Promise<BrokerPosition[]> {
    const data = await kiteGet<{ net?: KitePositionDay[]; day?: KitePositionDay[] }>(
      this.session,
      "/portfolio/positions",
    );
    const rows = [...(data.net ?? []), ...(data.day ?? [])];
    return rows.map((p) => ({
      tradingsymbol: p.tradingsymbol,
      exchange: p.exchange,
      product: p.product,
      quantity: p.quantity,
      averagePrice: p.average_price,
      lastPrice: p.last_price,
      pnl: p.pnl,
      m2m: p.m2m,
      unrealised: p.unrealised,
      realised: p.realised,
      buyQuantity: p.buy_quantity,
      sellQuantity: p.sell_quantity,
      netQuantity: p.net_quantity,
    }));
  }

  async getFunds(_userId: number): Promise<BrokerFunds> {
    const m = await kiteGet<KiteMargins>(this.session, "/user/margins");
    const eq = m.equity;
    const available = eq?.available?.live_balance ?? eq?.available?.cash ?? 0;
    const used = eq?.utilised?.debits ?? 0;
    const total = eq?.net ?? available + used;
    return {
      available,
      used,
      total,
      currency: "INR",
      breakdown: {
        cash: eq?.available?.cash ?? 0,
        liveBalance: eq?.available?.live_balance ?? 0,
        debits: used,
      },
    };
  }

  async getQuotes(_userId: number, instruments: string[]): Promise<BrokerQuote[]> {
    if (!instruments.length) return [];
    const data = await kiteGet<Record<string, KiteQuoteEntry>>(this.session, "/quote", {
      i: instruments,
    });
    return Object.entries(data).map(([instrument, q]) => {
      const [exchange, tradingsymbol] = instrument.split(":");
      const close = q.ohlc?.close ?? q.last_price;
      const change = q.last_price - close;
      return {
        instrument,
        tradingsymbol: tradingsymbol ?? instrument,
        exchange: exchange ?? "NSE",
        lastPrice: q.last_price,
        open: q.ohlc?.open ?? q.last_price,
        high: q.ohlc?.high ?? q.last_price,
        low: q.ohlc?.low ?? q.last_price,
        close,
        change,
        changePct: close ? (change / close) * 100 : 0,
        volume: q.volume ?? 0,
        timestamp: q.timestamp,
      };
    });
  }
}
