import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface PnLBadgeProps {
  value: number;
  prefix?: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export function PnLBadge({ value, prefix = "₹", size = "md", showIcon = true }: PnLBadgeProps) {
  const colors = useColors();
  const isPositive = value >= 0;
  const color = isPositive ? colors.green : colors.red;

  const fontSizes = { sm: 12, md: 14, lg: 20 };
  const iconSizes = { sm: 10, md: 12, lg: 16 };

  const formatted = Math.abs(value).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <View style={styles.row}>
      {showIcon && (
        <Feather
          name={isPositive ? "trending-up" : "trending-down"}
          size={iconSizes[size]}
          color={color}
          style={{ marginRight: 3 }}
        />
      )}
      <Text style={[styles.text, { color, fontSize: fontSizes[size] }]}>
        {isPositive ? "+" : "-"}{prefix}{formatted}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  text: { fontFamily: "Inter_600SemiBold" },
});
