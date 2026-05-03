import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type HapticKind = "selection" | "light" | "medium" | "heavy" | "none";

export interface TouchableProps extends Omit<PressableProps, "style" | "children"> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Press scale target. Default 0.97 */
  scaleTo?: number;
  /** Press opacity target. Default 0.92 */
  opacityTo?: number;
  /** Haptic feedback kind. Default "selection" */
  haptic?: HapticKind;
  /** Show subtle white highlight ripple on press. Default true */
  highlight?: boolean;
  /** Border radius for the highlight overlay (must match parent). Default 16 */
  highlightRadius?: number;
  /** Disable all touch effects (for pure layout wrappers). Default false */
  flat?: boolean;
}

function trigger(kind: HapticKind) {
  if (kind === "none") return;
  if (kind === "selection") return Haptics.selectionAsync();
  const map: Record<Exclude<HapticKind, "selection" | "none">, Haptics.ImpactFeedbackStyle> = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  };
  return Haptics.impactAsync(map[kind]);
}

/**
 * Premium touch wrapper. Spring scale, opacity dim, optional white highlight
 * ripple, optional haptic. Drop-in replacement for Pressable.
 */
export function Touchable({
  children,
  style,
  scaleTo = 0.97,
  opacityTo = 0.92,
  haptic = "selection",
  highlight = true,
  highlightRadius = 16,
  flat = false,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: TouchableProps) {
  const press = useSharedValue(0);

  const handleIn = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) => {
      if (!flat) {
        press.value = withTiming(1, {
          duration: 80,
          easing: Easing.out(Easing.quad),
        });
      }
      onPressIn?.(e);
    },
    [flat, press, onPressIn],
  );

  const handleOut = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) => {
      if (!flat) {
        press.value = withSpring(0, {
          damping: 14,
          stiffness: 240,
          mass: 0.5,
        });
      }
      onPressOut?.(e);
    },
    [flat, press, onPressOut],
  );

  const handlePress = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
      if (!disabled) trigger(haptic);
      onPress?.(e);
    },
    [haptic, disabled, onPress],
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, scaleTo]) }],
    opacity: interpolate(press.value, [0, 1], [1, opacityTo]),
  }));

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(press.value, [0, 1], [0, 0.08]),
  }));

  return (
    <Pressable
      onPressIn={handleIn}
      onPressOut={handleOut}
      onPress={handlePress}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, !flat && animStyle, disabled && { opacity: 0.5 }]}>
        {children}
        {highlight && !flat && !disabled && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "#FFFFFF",
                borderRadius: highlightRadius,
              },
              highlightStyle,
            ]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

interface PressableScaleProps {
  children: React.ReactNode;
  scale?: number;
}

/**
 * Tiny utility wrapper used inline for places that already manage their own
 * Pressable but want a shared spring scale shorthand. Currently re-exported
 * for convenience.
 */
export const PressableScale = ({ children }: PressableScaleProps) => (
  <View>{children}</View>
);
