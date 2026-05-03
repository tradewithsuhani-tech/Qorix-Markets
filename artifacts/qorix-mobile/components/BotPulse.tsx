import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface BotPulseProps {
  color: string;
  size?: number;
}

export function BotPulse({ color, size = 8 }: BotPulseProps) {
  const pulse1 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse1, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse1]);

  return (
    <View style={[styles.wrap, { width: size * 3, height: size * 3 }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size * 3,
            height: size * 3,
            borderRadius: size * 1.5,
            backgroundColor: color,
            opacity: pulse1.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [
              {
                scale: pulse1.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }),
              },
            ],
          },
        ]}
      />
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute" },
  dot: { position: "absolute" },
});
