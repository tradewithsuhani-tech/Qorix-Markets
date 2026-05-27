import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const BRAND_BLUE = "#60A5FA";
const BRAND_PURPLE = "#A855F7";
const BRAND_PINK = "#EC4899";
const INACTIVE = "#6B7280";

function NativeTabLayout() {
  const { flags } = useFeatureFlags();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Portfolio</Label>
      </NativeTabs.Trigger>
      {flags.bot_trading && (
        <NativeTabs.Trigger name="terminal">
          <Icon sf={{ default: "waveform.path.ecg", selected: "waveform.path.ecg" }} />
          <Label>Terminal</Label>
        </NativeTabs.Trigger>
      )}
      <NativeTabs.Trigger name="trades">
        <Icon sf={{ default: "arrow.left.arrow.right", selected: "arrow.left.arrow.right" }} />
        <Label>Trades</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wallet">
        <Icon sf={{ default: "creditcard", selected: "creditcard.fill" }} />
        <Label>Wallet</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const TAB_META: Record<
  string,
  { title: string; icon: keyof typeof Feather.glyphMap }
> = {
  index: { title: "Portfolio", icon: "bar-chart-2" },
  terminal: { title: "Terminal", icon: "activity" },
  trades: { title: "Trades", icon: "repeat" },
  wallet: { title: "Wallet", icon: "credit-card" },
  profile: { title: "Profile", icon: "user" },
};

interface TabItemProps {
  focused: boolean;
  meta: { title: string; icon: keyof typeof Feather.glyphMap };
  onPress: () => void;
  onLongPress: () => void;
  onLayout: (x: number, w: number) => void;
}

function TabItem({ focused, meta, onPress, onLongPress, onLayout }: TabItemProps) {
  const progress = useSharedValue(focused ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, {
      damping: 18,
      stiffness: 200,
      mass: 0.5,
    });
  }, [focused, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.94]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -1]) },
      { scale: interpolate(progress.value, [0, 1], [1, 1.06]) },
    ],
  }));

  const iconColor = useAnimatedStyle(() => ({
    opacity: 1,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [INACTIVE, "#FFFFFF"]),
    opacity: interpolate(progress.value, [0, 1], [0.85, 1]),
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onLayout={(e) => onLayout(e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 14, stiffness: 220, mass: 0.5 });
      }}
      style={styles.tabPressable}
    >
      <Animated.View style={[styles.tabInner, containerStyle]}>
        <Animated.View style={iconStyle}>
          <Animated.View style={iconColor}>
            <Feather
              name={meta.icon}
              size={21}
              color={focused ? BRAND_PURPLE : INACTIVE}
              strokeWidth={focused ? 2.5 : 2}
            />
          </Animated.View>
        </Animated.View>
        <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
          {meta.title}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: any) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";

  const [layouts, setLayouts] = useState<Record<number, { x: number; w: number }>>({});

  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);

  useEffect(() => {
    const layout = layouts[state.index];
    if (!layout) return;
    indicatorX.value = withSpring(layout.x, {
      damping: 22,
      stiffness: 220,
      mass: 0.7,
    });
    indicatorW.value = withSpring(layout.w, {
      damping: 22,
      stiffness: 220,
      mass: 0.7,
    });
  }, [state.index, layouts, indicatorX, indicatorW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: indicatorX.value + indicatorW.value / 2 - 40 },
    ],
    opacity: indicatorW.value > 0 ? 0.5 : 0,
  }));

  const onPress = (routeKey: string, routeName: string, isFocused: boolean) => {
    Haptics.selectionAsync();
    const event = navigation.emit({
      type: "tabPress",
      target: routeKey,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName as never);
    }
  };

  const onLongPress = (routeKey: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.emit({ type: "tabLongPress", target: routeKey });
  };

  return (
    <View
      style={[
        styles.barWrap,
        {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
      ]}
    >
      {/* Glass background */}
      {isIOS ? (
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(11,16,20,0.97)" },
          ]}
        />
      )}

      {/* Top hairline */}
      <View style={styles.hairline} pointerEvents="none" />

      {/* Active indicator track at top */}
      <View style={styles.indicatorTrack} pointerEvents="none">
        <Animated.View style={[styles.indicatorGlow, glowStyle]}>
          <LinearGradient
            colors={["transparent", BRAND_PURPLE, BRAND_PINK, BRAND_PURPLE, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.indicatorGlowGrad}
          />
        </Animated.View>
        <Animated.View style={[styles.indicator, indicatorStyle]}>
          <LinearGradient
            colors={[BRAND_BLUE, BRAND_PURPLE, BRAND_PINK]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.indicatorBar}
          />
        </Animated.View>
      </View>

      <View style={styles.tabs}>
        {state.routes.map((route: any, index: number) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const isFocused = state.index === index;
          return (
            <TabItem
              key={route.key}
              focused={isFocused}
              meta={meta}
              onPress={() => onPress(route.key, route.name, isFocused)}
              onLongPress={() => onLongPress(route.key)}
              onLayout={(x, w) =>
                setLayouts((prev) =>
                  prev[index]?.x === x && prev[index]?.w === w
                    ? prev
                    : { ...prev, [index]: { x, w } }
                )
              }
            />
          );
        })}
      </View>
    </View>
  );
}

function ClassicTabLayout() {
  const { flags } = useFeatureFlags();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Portfolio" }} />
      <Tabs.Screen name="terminal" options={{ title: "Terminal", href: flags.bot_trading ? undefined : null }} />
      <Tabs.Screen name="trades" options={{ title: "Trades" }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  barWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    overflow: "hidden",
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  indicatorTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 24,
  },
  indicator: {
    position: "absolute",
    top: 0,
    height: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorBar: {
    height: 2,
    width: "40%",
    borderRadius: 2,
  },
  indicatorGlow: {
    position: "absolute",
    top: -8,
    width: 80,
    height: 18,
    overflow: "hidden",
  },
  indicatorGlowGrad: {
    flex: 1,
    opacity: 0.7,
  },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
  },
  tabPressable: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: {
    fontSize: 9.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
