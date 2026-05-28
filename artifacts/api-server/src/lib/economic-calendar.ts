/**
 * Economic Calendar — Finnhub live data with Redis cache
 *
 * Fetches real economic events from Finnhub's free tier.
 * Cached in Redis for 1 hour to respect rate limits (60 calls/min free).
 * Falls back to synthetic data if Finnhub is unavailable.
 */

import { getRedisConnection } from "./redis";
import { logger } from "./logger";

export type ImpactLevel = "high" | "medium" | "low";

export interface CalendarEvent {
  id: string;
  eventAt: string;       // ISO8601 UTC
  timeLabel: string;     // "08:30" (UTC time label)
  currency: string;      // "USD"
  flag: string;          // "🇺🇸"
  title: string;         // event name
  forecast: string | null;
  previous: string | null;
  impact: ImpactLevel;
}

export interface CalendarSummary {
  highImpactWeek: number;
  upcomingHigh: number;
  eventsToday: number;
}

export interface CalendarResponse {
  summary: CalendarSummary;
  currencies: string[];
  events: CalendarEvent[];
}

// ─── Country → currency / flag map ──────────────────────────────────────────
const COUNTRY_MAP: Record<string, { currency: string; flag: string }> = {
  US: { currency: "USD", flag: "🇺🇸" },
  EU: { currency: "EUR", flag: "🇪🇺" },
  GB: { currency: "GBP", flag: "🇬🇧" },
  JP: { currency: "JPY", flag: "🇯🇵" },
  CA: { currency: "CAD", flag: "🇨🇦" },
  AU: { currency: "AUD", flag: "🇦🇺" },
  CH: { currency: "CHF", flag: "🇨🇭" },
  NZ: { currency: "NZD", flag: "🇳🇿" },
  CN: { currency: "CNY", flag: "🇨🇳" },
  IN: { currency: "INR", flag: "🇮🇳" },
  DE: { currency: "EUR", flag: "🇩🇪" },
  FR: { currency: "EUR", flag: "🇫🇷" },
  IT: { currency: "EUR", flag: "🇮🇹" },
  ES: { currency: "EUR", flag: "🇪🇸" },
  KR: { currency: "KRW", flag: "🇰🇷" },
  SG: { currency: "SGD", flag: "🇸🇬" },
};

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "NZD"];

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function normalizeImpact(raw: unknown): ImpactLevel {
  return raw === "high" || raw === "medium" ? raw : "low";
}

function formatUnit(val: number | string | null | undefined, unit: string | null | undefined): string | null {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (!Number.isFinite(n)) return null;
  const u = unit ?? "";
  if (u === "%" || u === "K" || u === "M" || u === "B") return `${n}${u}`;
  return String(n);
}

// ─── Redis cache ─────────────────────────────────────────────────────────────
const CACHE_KEY = (from: string, to: string) => `eco_cal:${from}:${to}`;
const CACHE_TTL_SEC = 60 * 60; // 1 hour

// ─── Finnhub fetch ───────────────────────────────────────────────────────────
async function fetchFromFinnhub(from: string, to: string): Promise<CalendarEvent[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error("FINNHUB_API_KEY not set");

  const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Finnhub responded ${res.status}`);

  const body = await res.json() as { economicCalendar?: any[] };
  const raw = body.economicCalendar ?? [];

  const events: CalendarEvent[] = [];
  for (const item of raw) {
    const mapped = COUNTRY_MAP[item.country as string];
    if (!mapped) continue;
    if (!SUPPORTED_CURRENCIES.includes(mapped.currency)) continue;

    const dateStr: string = item.date ?? "";          // "2026-05-27"
    const timeStr: string = item.time ?? "00:00:00";  // "08:30:00"
    const [h = "0", m = "0"] = timeStr.split(":");
    const timeLabel = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    const eventAt = `${dateStr}T${timeStr.slice(0, 5)}:00.000Z`;

    const impact = normalizeImpact(item.impact);

    events.push({
      id: `fh-${item.country}-${dateStr}-${timeStr}-${item.event}`.replace(/\s+/g, "-"),
      eventAt,
      timeLabel,
      currency: mapped.currency,
      flag: mapped.flag,
      title: item.event ?? "Economic Event",
      forecast: formatUnit(item.estimate, item.unit),
      previous: formatUnit(item.prev, item.unit),
      impact,
    });
  }

  return events.sort((a, b) => a.eventAt.localeCompare(b.eventAt));
}

// ─── Synthetic fallback ───────────────────────────────────────────────────────
function buildFallback(from: string, days: number): CalendarEvent[] {
  const base = new Date(from + "T00:00:00Z");
  const seed = [
    { dayOff: 0, h: 8, m: 30, currency: "USD", flag: "🇺🇸", title: "Core CPI (MoM)", impact: "high" as ImpactLevel, forecast: "0.3%", previous: "0.4%" },
    { dayOff: 0, h: 10, m: 0,  currency: "USD", flag: "🇺🇸", title: "Initial Jobless Claims", impact: "high" as ImpactLevel, forecast: "215K", previous: "221K" },
    { dayOff: 0, h: 12, m: 30, currency: "EUR", flag: "🇪🇺", title: "ECB Interest Rate Decision", impact: "high" as ImpactLevel, forecast: "3.50%", previous: "3.75%" },
    { dayOff: 0, h: 14, m: 0,  currency: "EUR", flag: "🇪🇺", title: "ECB Press Conference", impact: "high" as ImpactLevel, forecast: null, previous: null },
    { dayOff: 0, h: 15, m: 30, currency: "USD", flag: "🇺🇸", title: "Philadelphia Fed Manufacturing", impact: "medium" as ImpactLevel, forecast: "1.5", previous: "-4.5" },
    { dayOff: 0, h: 16, m: 0,  currency: "GBP", flag: "🇬🇧", title: "UK Retail Sales (MoM)", impact: "medium" as ImpactLevel, forecast: "0.2%", previous: "0.4%" },
    { dayOff: 1, h: 8,  m: 30, currency: "USD", flag: "🇺🇸", title: "Core PCE Price Index (MoM)", impact: "high" as ImpactLevel, forecast: "0.2%", previous: "0.3%" },
    { dayOff: 1, h: 14, m: 0,  currency: "EUR", flag: "🇪🇺", title: "Eurozone CPI Flash (YoY)", impact: "high" as ImpactLevel, forecast: "2.3%", previous: "2.4%" },
    { dayOff: 2, h: 8,  m: 30, currency: "USD", flag: "🇺🇸", title: "Nonfarm Payrolls", impact: "high" as ImpactLevel, forecast: "195K", previous: "228K" },
    { dayOff: 2, h: 8,  m: 30, currency: "USD", flag: "🇺🇸", title: "Unemployment Rate", impact: "high" as ImpactLevel, forecast: "4.1%", previous: "4.1%" },
    { dayOff: 2, h: 14, m: 0,  currency: "CAD", flag: "🇨🇦", title: "BoC Rate Statement", impact: "high" as ImpactLevel, forecast: "2.75%", previous: "3.00%" },
    { dayOff: 3, h: 9,  m: 45, currency: "USD", flag: "🇺🇸", title: "S&P Global Services PMI", impact: "medium" as ImpactLevel, forecast: "53.5", previous: "54.4" },
    { dayOff: 4, h: 8,  m: 30, currency: "USD", flag: "🇺🇸", title: "PPI ex Food & Energy (MoM)", impact: "high" as ImpactLevel, forecast: "0.2%", previous: "0.1%" },
    { dayOff: 4, h: 20, m: 0,  currency: "JPY", flag: "🇯🇵", title: "BoJ Interest Rate Decision", impact: "high" as ImpactLevel, forecast: "0.50%", previous: "0.50%" },
  ].filter((e) => e.dayOff < days);

  return seed.map((s, i) => {
    const dt = new Date(base);
    dt.setUTCDate(dt.getUTCDate() + s.dayOff);
    dt.setUTCHours(s.h, s.m, 0, 0);
    const timeLabel = `${String(s.h).padStart(2, "0")}:${String(s.m).padStart(2, "0")}`;
    return {
      id: `syn-${i}`,
      eventAt: dt.toISOString(),
      timeLabel,
      currency: s.currency,
      flag: s.flag,
      title: s.title,
      forecast: s.forecast,
      previous: s.previous,
      impact: normalizeImpact(s.impact),
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function getEconomicCalendar(days = 7): Promise<CalendarResponse> {
  const clampedDays = Math.min(Math.max(days, 1), 14);
  const now = new Date();
  const from = toDateStr(now);
  const toDate = new Date(now);
  toDate.setDate(toDate.getDate() + clampedDays - 1);
  const to = toDateStr(toDate);

  const cacheKey = CACHE_KEY(from, to);
  let events: CalendarEvent[] = [];
  let fromCache = false;

  try {
    const redis = getRedisConnection();
    const cached = await redis.get(cacheKey);
    if (cached) {
      events = JSON.parse(cached) as CalendarEvent[];
      fromCache = true;
    }
  } catch {
    // Redis unavailable — continue without cache
  }

  if (!fromCache) {
    try {
      events = await fetchFromFinnhub(from, to);
      if (events.length === 0) {
        // Finnhub returned empty (weekend/holiday) — use fallback
        events = buildFallback(from, clampedDays);
      }
      try {
        const redis = getRedisConnection();
        await redis.set(cacheKey, JSON.stringify(events), "EX", CACHE_TTL_SEC);
      } catch {
        // Cache write failed — serve live anyway
      }
    } catch (err) {
      logger.warn({ err }, "Finnhub economic calendar fetch failed — using fallback");
      events = buildFallback(from, clampedDays);
    }
  }

  const nowMs = Date.now();
  const todayStr = toDateStr(now);

  const highImpactWeek = events.filter((e) => e.impact === "high").length;
  const upcomingHigh   = events.filter((e) => e.impact === "high" && new Date(e.eventAt).getTime() > nowMs).length;
  const eventsToday    = events.filter((e) => e.eventAt.startsWith(todayStr)).length;

  const currencies = [...new Set(events.map((e) => e.currency))].filter((c) =>
    SUPPORTED_CURRENCIES.includes(c),
  );

  return {
    summary: { highImpactWeek, upcomingHigh, eventsToday },
    currencies,
    events,
  };
}
