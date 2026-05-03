import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Sparkline } from "@/components/Sparkline";
import { Touchable } from "@/components/Touchable";
import { useColors } from "@/hooks/useColors";

export interface BotStrategy {
  id: string;
  name: string;
  description: string;
  returnsPct: number;
  data: number[];
  accent: "purple" | "pink" | "blue" | "green";
  active?: boolean;
}

interface BotStrategyCardProps {
  bot: BotStrategy;
  onSetup?: () => void;
  width: number;
}

const ACCENT_MAP = {
  purple: { color: "#A855F7", gradient: ["rgba(168,85,247,0.25)", "rgba(168,85,247,0.05)"] as const },
  pink: { color: "#EC4899", gradient: ["rgba(236,72,153,0.25)", "rgba(236,72,153,0.05)"] as const },
  blue: { color: "#60A5FA", gradient: ["rgba(96,165,250,0.25)", "rgba(96,165,250,0.05)"] as const },
  green: { color: "#10D070", gradient: ["rgba(16,208,112,0.25)", "rgba(16,208,112,0.05)"] as const },
};

export function BotStrategyCard({ bot, onSetup, width }: BotStrategyCardProps) {
  const colors = useColors();
  const accent = ACCENT_MAP[bot.accent];

  return (
    <LinearGradient
      colors={accent.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.card, { width, borderColor: `${accent.color}33` }]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: `${accent.color}25` }]}>
          <Feather name="cpu" size={14} color={accent.color} />
        </View>
        {bot.active && (
          <View style={[styles.activeDot, { backgroundColor: colors.green }]} />
        )}
      </View>

      <Text style={[styles.botName, { color: colors.foreground }]} numberOfLines={2}>
        {bot.name}
      </Text>

      <View style={styles.chartArea}>
        <Sparkline
          data={bot.data}
          width={width - 28}
          height={56}
          color={accent.color}
          strokeWidth={2}
          showDot={false}
        />
      </View>

      <View style={styles.bottomRow}>
        <View>
          <Text style={[styles.returnsLabel, { color: colors.textMuted }]}>Returns</Text>
          <Text style={[styles.returnsPct, { color: accent.color }]}>
            {bot.returnsPct >= 0 ? "+" : ""}{bot.returnsPct.toFixed(0)}%
          </Text>
        </View>
        <Touchable
          onPress={() => onSetup?.()}
          style={[
            styles.setupBtn,
            { backgroundColor: `${accent.color}22`, borderColor: `${accent.color}55` },
          ]}
          scaleTo={0.93}
          highlightRadius={20}
          haptic="light"
        >
          <Feather name="plus" size={11} color={accent.color} />
          <Text style={[styles.setupText, { color: accent.color }]}>Set up</Text>
        </Touchable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  botName: { fontSize: 13, fontFamily: "Inter_700Bold", lineHeight: 17 },
  chartArea: { alignItems: "center", marginVertical: 4 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  returnsLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  returnsPct: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 2 },
  setupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  setupText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
