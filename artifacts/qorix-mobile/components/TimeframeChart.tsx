import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Sparkline } from "@/components/Sparkline";
import { useColors } from "@/hooks/useColors";

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "ALL";

interface TimeframeChartProps {
  data: Record<Timeframe, number[]>;
  width: number;
  height?: number;
  color: string;
}

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "ALL"];

export function TimeframeChart({ data, width, height = 90, color }: TimeframeChartProps) {
  const colors = useColors();
  const [tf, setTf] = useState<Timeframe>("1M");
  const series = data[tf];

  const first = series[0];
  const last = series[series.length - 1];
  const change = last - first;
  const changePct = (change / first) * 100;
  const up = change >= 0;
  const lineColor = up ? colors.green : colors.red;

  return (
    <View style={styles.wrap}>
      <View style={styles.chartArea}>
        <Sparkline
          data={series}
          width={width}
          height={height}
          color={lineColor}
          strokeWidth={2.5}
        />
      </View>
      <View style={styles.tfRow}>
        {TIMEFRAMES.map((t) => {
          const active = t === tf;
          return (
            <Pressable
              key={t}
              onPress={() => {
                Haptics.selectionAsync();
                setTf(t);
              }}
              style={[
                styles.tfBtn,
                active && {
                  backgroundColor: "rgba(201,168,76,0.18)",
                  borderColor: colors.borderBright,
                },
                !active && { borderColor: "transparent" },
              ]}
            >
              <Text
                style={[
                  styles.tfText,
                  { color: active ? colors.gold : colors.textMuted },
                ]}
              >
                {t}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.tfChange, { color: lineColor }]}>
        {up ? "+" : ""}₹{Math.abs(change).toFixed(0)} ({up ? "+" : ""}{changePct.toFixed(2)}%) · {tf}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  chartArea: { alignItems: "center" },
  tfRow: { flexDirection: "row", justifyContent: "center", gap: 4 },
  tfBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  tfText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tfChange: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});
