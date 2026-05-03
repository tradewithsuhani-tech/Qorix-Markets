import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface SegmentTabsProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
}

export function SegmentTabs({ options, value, onChange }: SegmentTabsProps) {
  const colors = useColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const active = opt === value;
        const inner = (
          <Text
            style={[
              styles.label,
              {
                color: active ? "#fff" : colors.textSecondary,
                fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
              },
            ]}
          >
            {opt}
          </Text>
        );
        if (active) {
          return (
            <Pressable
              key={opt}
              onPress={() => { Haptics.selectionAsync(); onChange(opt); }}
              style={styles.tabWrap}
            >
              <LinearGradient
                colors={["#3B82F6", "#8B5CF6", "#A855F7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tab}
              >
                {inner}
              </LinearGradient>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={opt}
            onPress={() => { Haptics.selectionAsync(); onChange(opt); }}
            style={[styles.tab, { backgroundColor: "transparent" }]}
          >
            {inner}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4, paddingRight: 16 },
  tabWrap: { borderRadius: 20, overflow: "hidden" },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  label: { fontSize: 13 },
});
