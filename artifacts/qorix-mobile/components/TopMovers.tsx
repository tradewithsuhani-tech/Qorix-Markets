import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface Mover {
  symbol: string;
  changePct: number;
  pnl: number;
}

interface TopMoversProps {
  gainers: Mover[];
  losers: Mover[];
}

export function TopMovers({ gainers, losers }: TopMoversProps) {
  const colors = useColors();

  const renderRow = (m: Mover, isGainer: boolean) => {
    const c = isGainer ? colors.green : colors.red;
    const widthPct = Math.min(100, Math.abs(m.changePct) * 6);
    return (
      <View key={m.symbol} style={styles.row}>
        <Text style={[styles.symbol, { color: colors.foreground }]} numberOfLines={1}>
          {m.symbol}
        </Text>
        <View style={[styles.barTrack, { backgroundColor: colors.card2 }]}>
          <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: `${c}99` }]} />
        </View>
        <Text style={[styles.pct, { color: c }]}>
          {isGainer ? "+" : ""}{m.changePct.toFixed(2)}%
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.column}>
        <View style={styles.colHeader}>
          <Feather name="trending-up" size={12} color={colors.green} />
          <Text style={[styles.colTitle, { color: colors.green }]}>TOP GAINERS</Text>
        </View>
        {gainers.map((m) => renderRow(m, true))}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.column}>
        <View style={styles.colHeader}>
          <Feather name="trending-down" size={12} color={colors.red} />
          <Text style={[styles.colTitle, { color: colors.red }]}>TOP LOSERS</Text>
        </View>
        {losers.map((m) => renderRow(m, false))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 12 },
  column: { flex: 1, gap: 8 },
  colHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  colTitle: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  symbol: { fontSize: 11, fontFamily: "Inter_600SemiBold", width: 60 },
  barTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  pct: { fontSize: 10, fontFamily: "Inter_700Bold", width: 50, textAlign: "right" },
  divider: { width: 1 },
});
