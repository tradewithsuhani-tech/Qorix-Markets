import type { InferSelectModel } from "drizzle-orm";
import {
  db,
  usersTable,
  brokerConnectionsTable,
  brokerDemoStateTable,
  brokerUserSettingsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { decryptBrokerToken, encryptBrokerToken } from "./broker-token-crypto";
import {
  DemoBrokerAdapter,
  applyDemoOrder,
  defaultDemoState,
  parseDemoState,
  serializeDemoState,
} from "./demo-adapter";
import {
  exchangeKiteRequestToken,
  getKiteLoginUrl,
  ZerodhaKiteAdapter,
} from "./zerodha-kite-adapter";
import type { BrokerPort, BrokerTradingMode, DemoPortfolioState } from "./types";

type BrokerConnectionRow = InferSelectModel<typeof brokerConnectionsTable>;

function kiteConfig() {
  const apiKey = process.env["KITE_API_KEY"] ?? "";
  const apiSecret = process.env["KITE_API_SECRET"] ?? "";
  const redirectUrl =
    process.env["KITE_REDIRECT_URL"] ??
    `${process.env["PUBLIC_APP_URL"] ?? "http://localhost:5000"}/api/v1/broker/zerodha/callback`;
  return { apiKey, apiSecret, redirectUrl };
}

export async function ensureBrokerSettings(userId: number) {
  const existing = await db
    .select()
    .from(brokerUserSettingsTable)
    .where(eq(brokerUserSettingsTable.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db
    .insert(brokerUserSettingsTable)
    .values({ userId, tradingMode: "demo" })
    .returning();
  return row!;
}

export async function getBrokerStatus(userId: number) {
  const settings = await ensureBrokerSettings(userId);
  const conn = await db
    .select()
    .from(brokerConnectionsTable)
    .where(
      and(
        eq(brokerConnectionsTable.userId, userId),
        eq(brokerConnectionsTable.broker, "zerodha"),
      ),
    )
    .limit(1);
  const zerodha = conn[0];
  return {
    mode: settings.tradingMode as BrokerTradingMode,
    activeBroker: settings.activeBroker,
    zerodha: zerodha
      ? {
          connected: true,
          userId: zerodha.brokerUserId,
          userName: zerodha.brokerUserName,
          connectedAt: zerodha.connectedAt?.toISOString(),
        }
      : { connected: false },
  };
}

export async function setTradingMode(userId: number, mode: BrokerTradingMode) {
  if (mode === "live") {
    const conn = await db
      .select()
      .from(brokerConnectionsTable)
      .where(
        and(
          eq(brokerConnectionsTable.userId, userId),
          eq(brokerConnectionsTable.broker, "zerodha"),
        ),
      )
      .limit(1);
    if (!conn[0]) {
      throw new Error("Connect Zerodha before switching to live mode");
    }
  }
  await db
    .insert(brokerUserSettingsTable)
    .values({ userId, tradingMode: mode, activeBroker: mode === "live" ? "zerodha" : null })
    .onConflictDoUpdate({
      target: brokerUserSettingsTable.userId,
      set: {
        tradingMode: mode,
        activeBroker: mode === "live" ? "zerodha" : null,
        updatedAt: new Date(),
      },
    });
  return getBrokerStatus(userId);
}

async function loadDemoState(userId: number): Promise<DemoPortfolioState> {
  const rows = await db
    .select()
    .from(brokerDemoStateTable)
    .where(eq(brokerDemoStateTable.userId, userId))
    .limit(1);
  if (!rows[0]) {
    const seed = defaultDemoState();
    await db.insert(brokerDemoStateTable).values({
      userId,
      cashBalance: String(seed.cashBalance),
      holdings: seed.holdings,
      positions: seed.positions,
      orders: seed.orders,
    });
    return seed;
  }
  return parseDemoState(rows[0]);
}

async function saveDemoState(userId: number, state: DemoPortfolioState) {
  const payload = serializeDemoState(state);
  await db
    .insert(brokerDemoStateTable)
    .values({
      userId,
      cashBalance: payload.cashBalance,
      holdings: payload.holdings,
      positions: payload.positions,
      orders: payload.orders,
    })
    .onConflictDoUpdate({
      target: brokerDemoStateTable.userId,
      set: {
        cashBalance: payload.cashBalance,
        holdings: payload.holdings,
        positions: payload.positions,
        orders: payload.orders,
        updatedAt: new Date(),
      },
    });
}

async function userLabel(userId: number): Promise<string> {
  const rows = await db
    .select({ name: usersTable.fullName, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const u = rows[0];
  return u?.name || u?.email || `User ${userId}`;
}

async function getZerodhaSession(userId: number) {
  const { apiKey } = kiteConfig();
  const rows = await db
    .select()
    .from(brokerConnectionsTable)
    .where(
      and(
        eq(brokerConnectionsTable.userId, userId),
        eq(brokerConnectionsTable.broker, "zerodha"),
      ),
    )
    .limit(1);
  const conn = rows[0] as BrokerConnectionRow | undefined;
  if (!conn) throw new Error("Zerodha not connected");
  const key = conn.apiKey ?? apiKey;
  const accessToken = decryptBrokerToken(conn.accessTokenEnc);
  return { apiKey: key, accessToken };
}

export async function resolveBrokerAdapter(userId: number): Promise<BrokerPort> {
  const settings = await ensureBrokerSettings(userId);
  if (settings.tradingMode === "live") {
    const session = await getZerodhaSession(userId);
    return new ZerodhaKiteAdapter(session);
  }
  return new DemoBrokerAdapter(loadDemoState, userLabel);
}

export function getZerodhaLoginUrl() {
  const { apiKey, redirectUrl } = kiteConfig();
  if (!apiKey) throw new Error("KITE_API_KEY is not configured");
  return { url: getKiteLoginUrl(apiKey, redirectUrl), redirectUrl, apiKeyConfigured: true };
}

export async function connectZerodha(userId: number, requestToken: string) {
  const { apiKey, apiSecret } = kiteConfig();
  if (!apiKey || !apiSecret) throw new Error("Kite API credentials not configured");
  const session = await exchangeKiteRequestToken(apiKey, apiSecret, requestToken);
  const accessTokenEnc = encryptBrokerToken(session.accessToken);
  await db
    .insert(brokerConnectionsTable)
    .values({
      userId,
      broker: "zerodha",
      brokerUserId: session.userId,
      brokerUserName: session.userName,
      accessTokenEnc,
      apiKey,
      meta: { loginTime: session.loginTime },
    })
    .onConflictDoUpdate({
      target: [brokerConnectionsTable.userId, brokerConnectionsTable.broker],
      set: {
        brokerUserId: session.userId,
        brokerUserName: session.userName,
        accessTokenEnc,
        apiKey,
        meta: { loginTime: session.loginTime },
        updatedAt: new Date(),
      },
    });
  return getBrokerStatus(userId);
}

export async function disconnectZerodha(userId: number) {
  await db
    .delete(brokerConnectionsTable)
    .where(
      and(
        eq(brokerConnectionsTable.userId, userId),
        eq(brokerConnectionsTable.broker, "zerodha"),
      ),
    );
  const settings = await ensureBrokerSettings(userId);
  if (settings.tradingMode === "live") {
    await setTradingMode(userId, "demo");
  }
  return getBrokerStatus(userId);
}

export async function placeDemoOrder(
  userId: number,
  input: { symbol: string; side: "buy" | "sell"; quantity: number; price?: number },
) {
  const state = await loadDemoState(userId);
  const result = applyDemoOrder(state, input, userId);
  if (result.error) throw new Error(result.error);
  await saveDemoState(userId, result.state);
  return { order: result.order, portfolio: result.state };
}

export async function resetDemoPortfolio(userId: number) {
  const seed = defaultDemoState();
  await saveDemoState(userId, seed);
  return seed;
}

export async function getDemoPortfolio(userId: number) {
  return loadDemoState(userId);
}
