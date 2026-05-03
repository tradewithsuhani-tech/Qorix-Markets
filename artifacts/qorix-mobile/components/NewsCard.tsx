import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  category: string;
  accent: [string, string];
  icon: keyof typeof Feather.glyphMap;
  isHot?: boolean;
}

interface NewsCardProps {
  item: NewsItem;
  onPress?: () => void;
}

export function NewsCard({ item, onPress }: NewsCardProps) {
  const colors = useColors();

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <LinearGradient colors={item.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb}>
        <Feather name={item.icon} size={22} color="#fff" />
      </LinearGradient>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.metaRow}>
          <Text style={[styles.category, { color: colors.purple }]}>{item.category}</Text>
          {item.isHot && (
            <View style={[styles.hotPill, { backgroundColor: colors.red }]}>
              <Feather name="zap" size={8} color="#fff" />
              <Text style={styles.hotText}>HOT</Text>
            </View>
          )}
        </View>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.footerRow}>
          <Text style={[styles.source, { color: colors.textMuted }]}>{item.source}</Text>
          <Text style={[styles.dot, { color: colors.textMuted }]}>·</Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>{item.time}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  thumb: { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  category: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  hotPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  hotText: { fontSize: 8, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5 },
  title: { fontSize: 13, fontFamily: "Inter_700Bold", lineHeight: 18 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  source: { fontSize: 10, fontFamily: "Inter_500Medium" },
  dot: { fontSize: 10 },
  time: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
