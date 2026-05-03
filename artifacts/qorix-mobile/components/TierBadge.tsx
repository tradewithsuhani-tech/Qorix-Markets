import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface TierBadgeProps {
  tier: "Silver" | "Gold" | "Platinum" | "Diamond";
  progress: number; // 0..100 to next tier
  nextTier?: string;
  amountToNext?: number;
}

const TIER_CONFIG = {
  Silver: { color: "#A8A29E", icon: "award" as const },
  Gold: { color: "#C9A84C", icon: "award" as const },
  Platinum: { color: "#E8E8E8", icon: "star" as const },
  Diamond: { color: "#4A9EFF", icon: "star" as const },
};

export function TierBadge({ tier, progress, nextTier, amountToNext }: TierBadgeProps) {
  const colors = useColors();
  const cfg = TIER_CONFIG[tier];

  return (
    <LinearGradient
      colors={[`${cfg.color}1F`, "rgba(15,19,24,0.4)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.wrap, { borderColor: `${cfg.color}55` }]}
    >
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: `${cfg.color}25` }]}>
          <Feather name={cfg.icon} size={14} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={[styles.tierName, { color: cfg.color }]}>{tier} Tier</Text>
            {nextTier && amountToNext !== undefined && (
              <Text style={[styles.toNext, { color: colors.textMuted }]}>
                ₹{amountToNext.toLocaleString("en-IN")} to {nextTier}
              </Text>
            )}
          </View>
          <View style={[styles.track, { backgroundColor: colors.card2 }]}>
            <View
              style={[
                styles.fill,
                { width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: cfg.color },
              ]}
            />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, borderWidth: 1, padding: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  tierName: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  toNext: { fontSize: 10, fontFamily: "Inter_500Medium" },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
});
