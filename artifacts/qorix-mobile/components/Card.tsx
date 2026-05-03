import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Touchable } from "@/components/Touchable";
import { useColors } from "@/hooks/useColors";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "elevated" | "gold";
  padding?: number;
  onPress?: () => void;
  haptic?: "selection" | "light" | "medium" | "heavy" | "none";
}

export function Card({
  children,
  style,
  variant = "default",
  padding = 16,
  onPress,
  haptic = "selection",
}: CardProps) {
  const colors = useColors();

  const getBg = () => {
    if (variant === "elevated") return colors.card2;
    if (variant === "gold") return "rgba(201,168,76,0.08)";
    return colors.card;
  };

  const getBorder = () => {
    if (variant === "gold") return colors.borderBright;
    return colors.border;
  };

  const cardStyle: ViewStyle = {
    backgroundColor: getBg(),
    borderColor: getBorder(),
    borderRadius: colors.radius,
    padding,
    borderWidth: 1,
    overflow: "hidden",
  };

  if (onPress) {
    return (
      <Touchable
        onPress={onPress}
        haptic={haptic}
        scaleTo={0.985}
        highlightRadius={colors.radius}
        style={[cardStyle, style]}
      >
        {children}
      </Touchable>
    );
  }

  return <View style={[styles.card, cardStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
