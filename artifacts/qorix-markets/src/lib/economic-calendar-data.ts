export type ImpactLevel = "high" | "medium" | "low";

export interface EconomicEvent {
  id: string;
  time: string;
  timeMs: number;
  currency: string;
  flag: string;
  event: string;
  impact: ImpactLevel;
  forecast?: string;
  previous?: string;
}

function buildEventsForToday(): EconomicEvent[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const at = (h: number, min: number) => {
    const dt = new Date(y, m, d, h, min, 0);
    return { time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), ms: dt.getTime() };
  };

  const events: Omit<EconomicEvent, "id">[] = [
    {
      time: at(8, 30).time, timeMs: at(8, 30).ms,
      currency: "USD", flag: "🇺🇸",
      event: "Core CPI (MoM)", impact: "high",
      forecast: "0.3%", previous: "0.4%",
    },
    {
      time: at(10, 0).time, timeMs: at(10, 0).ms,
      currency: "USD", flag: "🇺🇸",
      event: "Initial Jobless Claims", impact: "high",
      forecast: "215K", previous: "221K",
    },
    {
      time: at(12, 30).time, timeMs: at(12, 30).ms,
      currency: "EUR", flag: "🇪🇺",
      event: "ECB Interest Rate Decision", impact: "high",
      forecast: "3.50%", previous: "3.75%",
    },
    {
      time: at(14, 0).time, timeMs: at(14, 0).ms,
      currency: "EUR", flag: "🇪🇺",
      event: "ECB Press Conference", impact: "high",
      forecast: "—", previous: "—",
    },
    {
      time: at(15, 30).time, timeMs: at(15, 30).ms,
      currency: "USD", flag: "🇺🇸",
      event: "Philadelphia Fed Manufacturing", impact: "medium",
      forecast: "1.5", previous: "-4.5",
    },
    {
      time: at(16, 0).time, timeMs: at(16, 0).ms,
      currency: "GBP", flag: "🇬🇧",
      event: "UK Retail Sales (MoM)", impact: "medium",
      forecast: "0.2%", previous: "0.4%",
    },
    {
      time: at(18, 0).time, timeMs: at(18, 0).ms,
      currency: "USD", flag: "🇺🇸",
      event: "FOMC Member Speech", impact: "medium",
      forecast: "—", previous: "—",
    },
    {
      time: at(20, 30).time, timeMs: at(20, 30).ms,
      currency: "JPY", flag: "🇯🇵",
      event: "BoJ Summary of Opinions", impact: "medium",
      forecast: "—", previous: "—",
    },
  ];

  return events.map((e, i) => ({ ...e, id: `ev-${i}` }));
}

export function buildWeekEvents(): EconomicEvent[] {
  const today = buildEventsForToday();
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const at = (dayOffset: number, h: number, min: number, id: string): Pick<EconomicEvent, "id" | "time" | "timeMs"> => {
    const dt = new Date(y, m, d + dayOffset, h, min, 0);
    return { id, time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), timeMs: dt.getTime() };
  };

  const extra: EconomicEvent[] = [
    { ...at(1, 8, 30, "w1-1"), currency: "USD", flag: "🇺🇸", event: "Core PCE Price Index (MoM)", impact: "high", forecast: "0.2%", previous: "0.3%" },
    { ...at(1, 10, 0, "w1-2"), currency: "USD", flag: "🇺🇸", event: "University of Michigan Sentiment", impact: "medium", forecast: "77.5", previous: "76.9" },
    { ...at(1, 14, 0, "w1-3"), currency: "EUR", flag: "🇪🇺", event: "Eurozone CPI Flash (YoY)", impact: "high", forecast: "2.3%", previous: "2.4%" },
    { ...at(2, 8, 30, "w2-1"), currency: "USD", flag: "🇺🇸", event: "Nonfarm Payrolls", impact: "high", forecast: "195K", previous: "228K" },
    { ...at(2, 8, 30, "w2-2"), currency: "USD", flag: "🇺🇸", event: "Unemployment Rate", impact: "high", forecast: "4.1%", previous: "4.1%" },
    { ...at(2, 14, 0, "w2-3"), currency: "CAD", flag: "🇨🇦", event: "BoC Rate Statement", impact: "high", forecast: "2.75%", previous: "3.00%" },
    { ...at(3, 9, 45, "w3-1"), currency: "USD", flag: "🇺🇸", event: "S&P Global Services PMI", impact: "medium", forecast: "53.5", previous: "54.4" },
    { ...at(3, 10, 0, "w3-2"), currency: "USD", flag: "🇺🇸", event: "ISM Non-Manufacturing PMI", impact: "medium", forecast: "52.7", previous: "53.5" },
    { ...at(3, 15, 0, "w3-3"), currency: "GBP", flag: "🇬🇧", event: "MPC Member Speech", impact: "medium", forecast: "—", previous: "—" },
    { ...at(4, 8, 30, "w4-1"), currency: "USD", flag: "🇺🇸", event: "PPI ex Food & Energy (MoM)", impact: "high", forecast: "0.2%", previous: "0.1%" },
    { ...at(4, 10, 0, "w4-2"), currency: "USD", flag: "🇺🇸", event: "Wholesale Inventories (MoM)", impact: "low", forecast: "0.3%", previous: "0.5%" },
    { ...at(4, 20, 0, "w4-3"), currency: "JPY", flag: "🇯🇵", event: "BoJ Interest Rate Decision", impact: "high", forecast: "0.50%", previous: "0.50%" },
  ];

  return [...today, ...extra].sort((a, b) => a.timeMs - b.timeMs);
}

export const TODAY_EVENTS: EconomicEvent[] = buildEventsForToday();
export const WEEK_EVENTS: EconomicEvent[] = buildWeekEvents();
