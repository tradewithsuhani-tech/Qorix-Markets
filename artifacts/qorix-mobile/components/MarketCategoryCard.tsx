import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Touchable } from "@/components/Touchable";
import { useColors } from "@/hooks/useColors";

export interface MarketCategory {
  id: string;
  name: string;
  subtitle: string;
  profitPct: number;
  icon: keyof typeof Feather.glyphMap;
  accent: "purple" | "pink" | "blue" | "green" | "orange";
}

interface MarketCategoryCardProps {
  category: MarketCategory;
  onPress?: () => void;
}

const ACCENT = {
  purple: "#A855F7",
  pink: "#EC4899",
  blue: "#60A5FA",
  green: "#10D070",
  orange: "#FB923C",
};

export function MarketCategoryCard({ category, onPress }: MarketCategoryCardProps) {
  const colors = useColors();
  const accent = ACCENT[category.accent];

  return (
    <Touchable
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      scaleTo={0.97}
      highlightRadius={14}
      haptic="selection"
    >
      <View style={[styles.iconCircle, { backgroundColor: `${accent}25` }]}>
        <Feather name={category.icon} size={16} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.foreground }]}>{category.name}</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
          {category.profitPct >= 0 ? "+" : ""}{category.profitPct.toFixed(1)}% {category.subtitle}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 13, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
});
