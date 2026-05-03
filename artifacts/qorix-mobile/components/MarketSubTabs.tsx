import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface MarketSubTabsProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
}

export function MarketSubTabs({ options, value, onChange }: MarketSubTabsProps) {
  const colors = useColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(opt);
            }}
            style={styles.tab}
          >
            <Text
              style={{
                fontSize: 13,
                fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                color: active ? colors.foreground : colors.textMuted,
              }}
            >
              {opt}
            </Text>
            <View
              style={[
                styles.underline,
                {
                  backgroundColor: active ? colors.purple : "transparent",
                  width: active ? 22 : 0,
                },
              ]}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 14, paddingRight: 16 },
  tab: { alignItems: "center", paddingVertical: 8 },
  underline: { height: 2.5, borderRadius: 2, marginTop: 6 },
});
