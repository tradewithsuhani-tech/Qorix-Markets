import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BotPulse } from "@/components/BotPulse";
import { useColors } from "@/hooks/useColors";

export interface LiveTradeRow {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  status: "RUNNING" | "PAUSED";
  managedBy: string;
}

interface LiveTradesPanelProps {
  trades: LiveTradeRow[];
}

export function LiveTradesPanel({ trades }: LiveTradesPanelProps) {
  const colors = useColors();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Live Trades</Text>
        <View style={styles.liveTag}>
          <Feather name="refresh-cw" size={10} color={colors.green} />
          <Text style={[styles.liveTagText, { color: colors.green }]}>LIVE</Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {trades.map((t) => {
          const isBuy = t.side === "BUY";
          const sideColor = isBuy ? colors.green : colors.red;
          return (
            <View
              key={t.id}
              style={[styles.row, { backgroundColor: colors.card2, borderColor: colors.border }]}
            >
              <View style={[styles.sideBar, { backgroundColor: sideColor }]} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.topLine}>
                  <Text style={[styles.symbol, { color: colors.foreground }]}>{t.symbol}</Text>
                  <View style={[styles.sidePill, { backgroundColor: `${sideColor}25` }]}>
                    <Text style={[styles.sidePillText, { color: sideColor }]}>{t.side}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <BotPulse color={colors.yellow} size={5} />
                  <Text style={[styles.statusText, { color: colors.foreground }]}>{t.status}</Text>
                </View>
                <View style={styles.bottomLine}>
                  <Text style={[styles.subText, { color: colors.textMuted }]}>In progress…</Text>
                  <Text style={[styles.managedText, { color: colors.textMuted }]} numberOfLines={1}>
                    Managed by {t.managedBy}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  liveTagText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingRight: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  sideBar: { width: 3, alignSelf: "stretch", marginRight: 10 },
  topLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  symbol: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  sidePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sidePillText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  bottomLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  subText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  managedText: { fontSize: 10, fontFamily: "Inter_400Regular", flex: 1, textAlign: "right" },
});
