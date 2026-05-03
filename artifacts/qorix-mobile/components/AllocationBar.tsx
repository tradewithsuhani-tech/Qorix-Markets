import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface AllocationItem {
  label: string;
  value: number;
  color: string;
}

interface AllocationBarProps {
  items: AllocationItem[];
  total: number;
}

export function AllocationBar({ items, total }: AllocationBarProps) {
  const colors = useColors();

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { backgroundColor: colors.card2 }]}>
        {items.map((item, i) => {
          const pct = (item.value / total) * 100;
          return (
            <View
              key={item.label}
              style={{
                width: `${pct}%`,
                backgroundColor: item.color,
                borderRightWidth: i < items.length - 1 ? 2 : 0,
                borderRightColor: colors.background,
              }}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        {items.map((item) => {
          const pct = (item.value / total) * 100;
          return (
            <View key={item.label} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>{item.label}</Text>
              <Text style={[styles.value, { color: colors.foreground }]}>{pct.toFixed(0)}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  bar: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    flexDirection: "row",
  },
  legend: { gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  value: { fontSize: 12, fontFamily: "Inter_700Bold" },
});
