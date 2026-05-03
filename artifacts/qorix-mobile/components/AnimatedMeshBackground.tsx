import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface AnimatedMeshBackgroundProps {
  height?: number;
  intensity?: number;
}

export function AnimatedMeshBackground({ height = 720, intensity = 0.55 }: AnimatedMeshBackgroundProps) {
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);
  const t3 = useSharedValue(0);
  const t4 = useSharedValue(0);

  useEffect(() => {
    t1.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }), -1, true);
    t2.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.sin) }), -1, true);
    t3.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.inOut(Easing.sin) }), -1, true);
    t4.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t1, t2, t3, t4]);

  const blobBlue = useAnimatedStyle(() => ({
    transform: [
      { translateX: -120 + t1.value * 220 },
      { translateY: -60 + t1.value * 120 },
      { scale: 1 + t1.value * 0.35 },
    ],
    opacity: 0.30 * intensity + t1.value * 0.20 * intensity,
  }));

  const blobPurple = useAnimatedStyle(() => ({
    transform: [
      { translateX: 140 - t2.value * 220 },
      { translateY: 80 + t2.value * 80 },
      { scale: 1.1 + (1 - t2.value) * 0.3 },
    ],
    opacity: 0.32 * intensity + (1 - t2.value) * 0.22 * intensity,
  }));

  const blobPink = useAnimatedStyle(() => ({
    transform: [
      { translateX: 40 + t3.value * 160 },
      { translateY: 240 - t3.value * 200 },
      { scale: 0.9 + t3.value * 0.5 },
    ],
    opacity: 0.22 * intensity + t3.value * 0.18 * intensity,
  }));

  const blobCyan = useAnimatedStyle(() => ({
    transform: [
      { translateX: -80 - t4.value * 120 },
      { translateY: 360 + t4.value * 120 },
      { scale: 1 + (1 - t4.value) * 0.4 },
    ],
    opacity: 0.20 * intensity + (1 - t4.value) * 0.18 * intensity,
  }));

  return (
    <View pointerEvents="none" style={[styles.root, { height }]}>
      <Animated.View style={[styles.blobBox, { top: -40, left: -80 }, blobBlue]}>
        <LinearGradient
          colors={["rgba(59,130,246,1)", "rgba(59,130,246,0)"]}
          style={styles.blob}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      <Animated.View style={[styles.blobBox, { top: 60, right: -100 }, blobPurple]}>
        <LinearGradient
          colors={["rgba(168,85,247,1)", "rgba(168,85,247,0)"]}
          style={styles.blob}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      <Animated.View style={[styles.blobBox, { top: 280, left: 40 }, blobPink]}>
        <LinearGradient
          colors={["rgba(236,72,153,1)", "rgba(236,72,153,0)"]}
          style={styles.blob}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      <Animated.View style={[styles.blobBox, { top: 420, left: -60 }, blobCyan]}>
        <LinearGradient
          colors={["rgba(34,211,238,1)", "rgba(34,211,238,0)"]}
          style={styles.blob}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  blobBox: {
    position: "absolute",
    width: 320,
    height: 320,
  },
  blob: {
    width: "100%",
    height: "100%",
    borderRadius: 160,
  },
});
