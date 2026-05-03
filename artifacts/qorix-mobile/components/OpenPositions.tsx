import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BotPulse } from "@/components/BotPulse";
import { useColors } from "@/hooks/useColors";

export interface OpenPosition {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  entryPrice: number;
  currentPrice: number;
  assetClass: "equity" | "fno" | "crypto";
}

interface OpenPositionsProps {
  positions: OpenPosition[];
}

export function OpenPositions({ positions }: OpenPositionsProps) {
  const colors = useColors();
  const [livePrices, setLivePrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(positions.map((p) => [p.id, p.currentPrice]))
  );

  // Drift current prices to simulate live ticks
  useEffect(() => {
    const id = setInterval(() => {
      setLivePrices((prev) => {
        const next: Record<string, number> = {};
        positions.forEach((p) => {
          const cur = prev[p.id] ?? p.currentPrice;
          const drift = (Math.random() - 0.49) * cur * 0.0015;
          next[p.id] = cur + drift;
        });
        return next;
      });
    }, 1500);
    return () => clearInterval(id);
  }, [positions]);

  const totalUnrealized = positions.reduce((sum, p) => {
    const cur = livePrices[p.id] ?? p.currentPrice;
    const sign = p.side === "BUY" ? 1 : -1;
    return sum + sign * (cur - p.entryPrice) * p.qty;
  }, 0);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>Open Positions</Text>
            <BotPulse color={colors.green} size={5} />
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {positions.length} active · live unrealized P&L
          </Text>
        </View>
        <View style={styles.totalWrap}>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>UNREALIZED</Text>
          <Text style={[styles.totalValue, {
            color: totalUnrealized >= 0 ? colors.green : colors.red,
          }]}>
            {totalUnrealized >= 0 ? "+" : ""}₹{Math.abs(totalUnrealized).toFixed(0)}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {positions.map((p, i) => {
          const cur = livePrices[p.id] ?? p.currentPrice;
          const sign = p.side === "BUY" ? 1 : -1;
          const pnl = sign * (cur - p.entryPrice) * p.qty;
          const pnlPct = sign * ((cur - p.entryPrice) / p.entryPrice) * 100;
          const up = pnl >= 0;
          const c = up ? colors.green : colors.red;

          const assetIcon = {
            equity: "bar-chart-2" as const,
            fno: "layers" as const,
            crypto: "hexagon" as const,
          }[p.assetClass];

          return (
            <View
              key={p.id}
              style={[
                styles.row,
                i < positions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.assetIcon, { backgroundColor: `${c}1A` }]}>
                <Feather name={assetIcon} size={13} color={c} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.symbol, { color: colors.foreground }]} numberOfLines={1}>
                    {p.symbol}
                  </Text>
                  <View style={[styles.sideBadge, {
                    backgroundColor: p.side === "BUY" ? "rgba(46,204,113,0.12)" : "rgba(231,76,60,0.12)",
                  }]}>
                    <Text style={[styles.sideText, {
                      color: p.side === "BUY" ? colors.green : colors.red,
                    }]}>
                      {p.side}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.priceText, { color: colors.textMuted }]} numberOfLines={1}>
                  {p.qty} @ ₹{p.entryPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })} → ₹{cur.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.pnlCol}>
                <Text style={[styles.pnlVal, { color: c }]}>
                  {up ? "+" : ""}₹{Math.abs(pnl).toFixed(0)}
                </Text>
                <Text style={[styles.pnlPct, { color: c }]}>
                  {up ? "+" : ""}{pnlPct.toFixed(2)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  header: { flexDirection: "row", alignItems: "flex-start" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  totalWrap: { alignItems: "flex-end" },
  totalLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  totalValue: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 2 },
  list: {},
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  assetIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  symbol: { fontSize: 13, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  sideBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  sideText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  priceText: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  pnlCol: { alignItems: "flex-end" },
  pnlVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  pnlPct: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 1 },
});
