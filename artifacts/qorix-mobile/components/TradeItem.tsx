import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Trade } from "@/context/PortfolioContext";
import { PnLBadge } from "./PnLBadge";

interface TradeItemProps {
  trade: Trade;
}

export function TradeItem({ trade }: TradeItemProps) {
  const colors = useColors();
  const isBuy = trade.side === "BUY";
  const sideColor = isBuy ? colors.green : colors.red;

  const date = new Date(trade.executedAt);
  const dateStr = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const timeStr = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.badge, { backgroundColor: isBuy ? "rgba(46,204,113,0.1)" : "rgba(231,76,60,0.1)" }]}>
        <Text style={[styles.badgeText, { color: sideColor }]}>{trade.side}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.symbol, { color: colors.foreground }]}>{trade.symbol}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {trade.qty} × ₹{trade.entryPrice.toLocaleString("en-IN")} → ₹{trade.exitPrice.toLocaleString("en-IN")}
        </Text>
      </View>
      <View style={styles.right}>
        <PnLBadge value={trade.pnl} size="sm" />
        <Text style={[styles.date, { color: colors.textMuted }]}>{dateStr} {timeStr}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  info: { flex: 1 },
  symbol: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  right: { alignItems: "flex-end", gap: 2 },
  date: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
