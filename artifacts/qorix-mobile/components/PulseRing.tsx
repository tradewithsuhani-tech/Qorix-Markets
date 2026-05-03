import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface PulseRingProps {
  size?: number;
  color?: string;
  rings?: number;
  duration?: number;
  thickness?: number;
}

export function PulseRing({
  size = 14,
  color = "#22C55E",
  rings = 3,
  duration = 2200,
  thickness = 1.5,
}: PulseRingProps) {
  return (
    <View style={[styles.root, { width: size * 3, height: size * 3 }]}>
      {Array.from({ length: rings }).map((_, i) => (
        <Ring key={i} delay={(duration / rings) * i} color={color} duration={duration} size={size} thickness={thickness} />
      ))}
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            shadowColor: color,
          },
        ]}
      />
    </View>
  );
}

function Ring({
  delay,
  duration,
  color,
  size,
  thickness,
}: {
  delay: number;
  duration: number;
  color: string;
  size: number;
  thickness: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.cubic) }), -1, false),
    );
  }, [progress, delay, duration]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.5 + progress.value * 2.4 }],
    opacity: 0.6 * (1 - progress.value),
  }));

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          borderWidth: thickness,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center" },
  dot: {
    position: "absolute",
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  ring: { position: "absolute" },
});
