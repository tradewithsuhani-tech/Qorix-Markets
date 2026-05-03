import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Touchable } from "@/components/Touchable";
import { useColors } from "@/hooks/useColors";

export interface QuickAction {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color?: string;
  badge?: string;
}

interface QuickActionGridProps {
  actions: QuickAction[];
  onPress?: (id: string) => void;
}

export function QuickActionGrid({ actions, onPress }: QuickActionGridProps) {
  const colors = useColors();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.grid}>
        {actions.map((a) => {
          const tint = a.color ?? colors.purple;
          return (
            <Touchable
              key={a.id}
              onPress={() => onPress?.(a.id)}
              style={styles.cell}
              scaleTo={0.92}
              highlightRadius={14}
              haptic="light"
            >
              <View style={[styles.iconWrap, { backgroundColor: `${tint}20` }]}>
                <Feather name={a.icon} size={18} color={tint} />
                {a.badge && (
                  <View style={[styles.badge, { backgroundColor: colors.pink }]}>
                    <Text style={styles.badgeText}>{a.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, { color: colors.foreground }]} numberOfLines={1}>
                {a.label}
              </Text>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: { width: "25%", alignItems: "center", paddingVertical: 8, gap: 6 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 14,
    alignItems: "center",
  },
  badgeText: { fontSize: 8, fontFamily: "Inter_700Bold", color: "#fff" },
  label: { fontSize: 10, fontFamily: "Inter_500Medium" },
});
