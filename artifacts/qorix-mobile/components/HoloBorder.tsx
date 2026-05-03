import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface HoloBorderProps {
  radius?: number;
  thickness?: number;
  children: React.ReactNode;
  style?: ViewStyle;
  duration?: number;
}

export function HoloBorder({ radius = 22, thickness = 1, children, style, duration = 7000 }: HoloBorderProps) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
  }, [t, duration]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${t.value * 360}deg` }],
  }));

  return (
    <View style={[{ borderRadius: radius, padding: thickness, overflow: "hidden" }, style]}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.gradWrap, animStyle]}>
          <LinearGradient
            colors={["#3B82F6", "#A855F7", "#EC4899", "#22D3EE", "#3B82F6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <View style={{ borderRadius: radius - thickness, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  gradWrap: {
    width: "200%",
    height: "200%",
    left: "-50%",
    top: "-50%",
  },
});
