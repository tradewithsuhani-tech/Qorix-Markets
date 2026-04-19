import jsPDF from "jspdf";
import { format } from "date-fns";

interface ReportData {
  user: {
    fullName: string;
    email: string;
    id: number;
  };
  summary: {
    totalBalance: number;
    activeInvestment: number;
    totalProfit: number;
    profitBalance: number;
    tradingBalance: number;
    dailyProfitLoss: number;
    dailyProfitPercent: number;
    isTrading: boolean;
    riskLevel: string | null;
  };
  performance: {
    winRate: number;
    totalTrades: number;
    avgReturn: number;
    maxDrawdown: number;
    drawdown: number;
    riskScore: string;
  };
  vip?: {
    tier: string;
    label: string;
    profitBonus: number;
    withdrawalFee: number;
  };
}

const BRAND = {
  dark: [10, 12, 18] as [number, number, number],
  card: [18, 22, 32] as [number, number, number],
  accent: [59, 130, 246] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  text: [255, 255, 255] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  border: [30, 38, 55] as [number, number, number],
};

function drawRoundedRect(
  doc: jsPDF,
  x: number, y: number,
  w: number, h: number,
  r: number,
  fillColor: [number, number, number],
  strokeColor?: [number, number, number],
) {
  doc.setFillColor(...fillColor);
  if (strokeColor) {
    doc.setDrawColor(...strokeColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, r, r, "FD");
  } else {
    doc.roundedRect(x, y, w, h, r, r, "F");
  }
}

function pill(
  doc: jsPDF,
  text: string,
  x: number, y: number,
  color: [number, number, number],
  bgAlpha = 0.15,
) {
  const w = doc.getTextWidth(text) + 8;
  const h = 6;
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(x, y - 4, w, h, 1.5, 1.5, "F");
  doc.setTextColor(...color);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(text, x + 4, y);
}

export function generateMonthlyReport(data: ReportData): void {
  const { user, summary, performance, vip } = data;
  const now = new Date();
  const reportMonth = format(now, "MMMM yyyy");
  const generatedAt = format(now, "dd MMM yyyy, HH:mm");
  const accountId = `QORIX-${String(user.id).padStart(6, "0")}`;

  const investment = summary.activeInvestment || summary.tradingBalance || 0;
  const totalProfit = summary.totalProfit || 0;
  const roi = investment > 0 ? (totalProfit / investment) * 100 : 0;
  const maxDrawdown = performance.maxDrawdown || 0;
  const winRate = performance.winRate || 0;
  const totalTrades = performance.totalTrades || 0;
  const avgReturn = performance.avgReturn || 0;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;

  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, W, H, "F");

  doc.setFillColor(59, 130, 246, 0.04 as any);
  doc.circle(W - 30, 30, 60, "F");

  const headerH = 52;
  drawRoundedRect(doc, 0, 0, W, headerH, 0, BRAND.card);

  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 4, headerH, "F");

  doc.setTextColor(...BRAND.accent);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("QORIX", 14, 18);

  doc.setTextColor(...BRAND.muted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("MARKETS", 14, 24);

  doc.setTextColor(...BRAND.text);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Monthly Performance Report", 14, 36);

  doc.setTextColor(...BRAND.muted);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${reportMonth}`, 14, 43);
  doc.text(`Generated: ${generatedAt}`, 14, 48);

  const rightX = W - 14;
  doc.setTextColor(...BRAND.muted);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("Account ID", rightX, 22, { align: "right" });
  doc.setTextColor(...BRAND.text);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(accountId, rightX, 29, { align: "right" });
  doc.setTextColor(...BRAND.muted);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(user.fullName, rightX, 36, { align: "right" });
  doc.text(user.email, rightX, 42, { align: "right" });

  if (vip && vip.tier !== "none") {
    const tierColors: Record<string, [number, number, number]> = {
      silver: [203, 213, 225],
      gold: [251, 191, 36],
      platinum: [34, 211, 238],
    };
    const c = tierColors[vip.tier] ?? BRAND.accent;
    pill(doc, `${vip.label.toUpperCase()} VIP`, rightX - doc.getTextWidth(`${vip.label.toUpperCase()} VIP`) - 4, 47, c);
  }

  let y = headerH + 10;

  doc.setTextColor(...BRAND.muted);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("KEY PERFORMANCE METRICS", 14, y);
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.3);
  doc.line(14, y + 2, W - 14, y + 2);

  y += 8;

  const kpiCards = [
    {
      label: "Total Investment",
      value: `$${investment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      color: BRAND.accent,
      sub: summary.isTrading ? "ACTIVE" : "INACTIVE",
    },
    {
      label: "Total Profit",
      value: `${totalProfit >= 0 ? "+" : ""}$${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      color: totalProfit >= 0 ? BRAND.green : BRAND.red,
      sub: `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}% ROI`,
    },
    {
      label: "ROI",
      value: `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`,
      color: roi >= 0 ? BRAND.green : BRAND.red,
      sub: "All-time return",
    },
    {
      label: "Max Drawdown",
      value: `-${maxDrawdown.toFixed(2)}%`,
      color: BRAND.red,
      sub: "Peak to trough",
    },
  ];

  const cardW = (W - 28 - 9) / 4;
  const cardH = 32;

  kpiCards.forEach((card, i) => {
    const cx = 14 + i * (cardW + 3);
    drawRoundedRect(doc, cx, y, cardW, cardH, 3, BRAND.card, BRAND.border);

    doc.setFillColor(...card.color);
    doc.roundedRect(cx, y, cardW, 1.5, 0, 0, "F");

    doc.setTextColor(...BRAND.muted);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(card.label.toUpperCase(), cx + 4, y + 8);

    doc.setTextColor(...card.color);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(card.value, cx + 4, y + 18);

    doc.setTextColor(...BRAND.muted);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(card.sub, cx + 4, y + 26);
  });

  y += cardH + 12;

  doc.setTextColor(...BRAND.muted);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("TRADING PERFORMANCE", 14, y);
  doc.setDrawColor(...BRAND.border);
  doc.line(14, y + 2, W - 14, y + 2);

  y += 8;

  const perfRows = [
    ["Win Rate", `${winRate.toFixed(1)}%`, winRate >= 60 ? "Excellent" : winRate >= 50 ? "Good" : "Below Average"],
    ["Total Trades", totalTrades.toString(), `${totalTrades} executed`],
    ["Avg Return Per Trade", `${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(2)}%`, avgReturn >= 0 ? "Profitable" : "Loss"],
    ["Max Drawdown", `-${maxDrawdown.toFixed(2)}%`, maxDrawdown < 5 ? "Low risk" : maxDrawdown < 15 ? "Moderate" : "High risk"],
    ["Current Drawdown", `-${(performance.drawdown || 0).toFixed(2)}%`, "Live"],
    ["Risk Profile", summary.riskLevel ? summary.riskLevel.charAt(0).toUpperCase() + summary.riskLevel.slice(1) : "—", `${performance.riskScore} risk score`],
  ];

  const colW = [(W - 28) * 0.38, (W - 28) * 0.28, (W - 28) * 0.34];
  const rowH = 9;

  drawRoundedRect(doc, 14, y, W - 28, rowH, 2, [22, 28, 42]);
  doc.setTextColor(...BRAND.muted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("METRIC", 18, y + 6);
  doc.text("VALUE", 18 + colW[0]!, y + 6);
  doc.text("STATUS", 18 + colW[0]! + colW[1]!, y + 6);
  y += rowH;

  perfRows.forEach((row, i) => {
    const bg: [number, number, number] = i % 2 === 0 ? BRAND.card : [14, 18, 28];
    drawRoundedRect(doc, 14, y, W - 28, rowH, 0, bg);

    doc.setTextColor(...BRAND.text);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(row[0]!, 18, y + 6);

    doc.setFont("helvetica", "bold");
    const valColor = row[0] === "Max Drawdown" || row[0] === "Current Drawdown"
      ? BRAND.red
      : row[0] === "Win Rate" || row[0] === "Avg Return Per Trade"
        ? (parseFloat(row[1]!) >= 0 ? BRAND.green : BRAND.red)
        : BRAND.text;
    doc.setTextColor(...valColor);
    doc.text(row[1]!, 18 + colW[0]!, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(row[2]!, 18 + colW[0]! + colW[1]!, y + 6);

    y += rowH;
  });

  y += 10;

  doc.setTextColor(...BRAND.muted);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("BALANCE BREAKDOWN", 14, y);
  doc.setDrawColor(...BRAND.border);
  doc.line(14, y + 2, W - 14, y + 2);

  y += 8;

  const balRows = [
    ["Main Balance", summary.totalBalance - summary.tradingBalance - summary.profitBalance],
    ["Trading Balance", summary.tradingBalance],
    ["Profit Balance", summary.profitBalance],
    ["Total Equity", summary.totalBalance],
  ];

  const barMaxW = (W - 28) * 0.5;
  const maxVal = Math.max(...balRows.map((r) => Math.abs(r[1] as number)), 1);

  balRows.forEach((row, i) => {
    const val = row[1] as number;
    const isTotal = row[0] === "Total Equity";
    const barW = Math.max(2, (Math.abs(val) / maxVal) * barMaxW);
    const barColor: [number, number, number] = isTotal ? BRAND.accent : i === 2 ? BRAND.green : [80, 100, 160];

    drawRoundedRect(doc, 14, y, W - 28, 10, 1.5, BRAND.card);

    doc.setTextColor(isTotal ? BRAND.text : BRAND.muted);
    doc.setFontSize(8);
    doc.setFont(isTotal ? "helvetica" : "helvetica", isTotal ? "bold" : "normal");
    doc.text(row[0] as string, 18, y + 7);

    doc.setFillColor(...barColor);
    doc.roundedRect(18 + 60, y + 3.5, barW, 3, 1, 1, "F");

    doc.setTextColor(...(isTotal ? BRAND.text : BRAND.muted));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(
      `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      W - 18,
      y + 7,
      { align: "right" },
    );

    y += 12;
  });

  y += 8;

  if (vip && vip.tier !== "none") {
    doc.setTextColor(...BRAND.muted);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("VIP MEMBERSHIP BENEFITS", 14, y);
    doc.setDrawColor(...BRAND.border);
    doc.line(14, y + 2, W - 14, y + 2);

    y += 8;

    const tierColors: Record<string, [number, number, number]> = {
      silver: [203, 213, 225],
      gold: [251, 191, 36],
      platinum: [34, 211, 238],
    };
    const tierColor = tierColors[vip.tier] ?? BRAND.accent;

    drawRoundedRect(doc, 14, y, W - 28, 20, 3, BRAND.card, BRAND.border);
    doc.setFillColor(...tierColor);
    doc.roundedRect(14, y, W - 28, 1.5, 0, 0, "F");

    doc.setTextColor(...tierColor);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${vip.label} Member`, 20, y + 10);

    doc.setTextColor(...BRAND.muted);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`+${(vip.profitBonus * 100).toFixed(0)}% Profit Bonus`, 20, y + 16);
    doc.text(`${(vip.withdrawalFee * 100).toFixed(1)}% Withdrawal Fee`, W - 14 - 50, y + 16);

    y += 28;
  }

  const footerY = H - 16;
  doc.setFillColor(...BRAND.card);
  doc.rect(0, footerY, W, 16, "F");
  doc.setFillColor(59, 130, 246);
  doc.rect(0, footerY, 4, 16, "F");

  doc.setTextColor(...BRAND.muted);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    "This report is generated automatically by Qorix Markets. Past performance is not indicative of future results.",
    14,
    footerY + 6,
  );
  doc.text(
    `© ${now.getFullYear()} Qorix Markets · ${accountId} · ${generatedAt}`,
    14,
    footerY + 11,
  );

  const fileName = `qorix-report-${format(now, "yyyy-MM")}-${accountId}.pdf`;
  doc.save(fileName);
}
