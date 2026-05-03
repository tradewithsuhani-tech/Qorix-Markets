import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface DailyPnLEntry {
  date: string;
  pnl: number;
  label: string;
}

interface DailyPnLBarsProps {
  entries: DailyPnLEntry[];
}

export function DailyPnLBars({ entries }: DailyPnLBarsProps) {
  const colors = useColors();
  const maxAbs = Math.max(...entries.map((e) => Math.abs(e.pnl)), 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.barsRow}>
        {entries.map((e) => {
          const up = e.pnl >= 0;
          const heightPct = (Math.abs(e.pnl) / maxAbs) * 100;
          const c = up ? colors.green : colors.red;
          return (
            <View key={e.date} style={styles.barCol}>
              <View style={styles.valueWrap}>
                <Text style={[styles.valueText, { color: c }]} numberOfLines={1}>
                  {up ? "+" : "-"}₹{Math.abs(e.pnl) >= 1000
                    ? `${(Math.abs(e.pnl) / 1000).toFixed(1)}K`
                    : Math.abs(e.pnl).toFixed(0)}
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.card2 }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${heightPct}%`,
                      backgroundColor: c,
                      opacity: 0.85,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.dayLabel, { color: colors.textMuted }]}>{e.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  barsRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 110 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  valueWrap: { height: 14 },
  valueText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  barTrack: {
    width: "100%",
    height: 70,
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: 4 },
  dayLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
});
