import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient as SvgLG, Path, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useColors } from "@/hooks/useColors";

interface BalanceCardProProps {
  balanceInr: number;
  balanceUsd: number;
  pnl24h: number;
  pnl24hPct: number;
  isHidden: boolean;
  onToggleHide: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onTransfer?: () => void;
}

export function BalanceCardPro({
  balanceInr,
  balanceUsd,
  pnl24h,
  pnl24hPct,
  isHidden,
  onToggleHide,
  onDeposit,
  onWithdraw,
  onTransfer,
}: BalanceCardProProps) {
  const colors = useColors();
  const isUp = pnl24h >= 0;
  const trendColor = isUp ? colors.green : colors.red;

  // shimmer sweep across card
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 5500, easing: Easing.linear }), -1, false);
  }, [sweep]);
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -260 + sweep.value * 720 }, { rotate: "16deg" }],
    opacity: sweep.value < 0.5 ? sweep.value * 0.7 : (1 - sweep.value) * 0.7,
  }));

  return (
    <LinearGradient
      colors={["#15192A", "#0E1220", "#0A0D17"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: "rgba(255,255,255,0.08)" }]}
    >
      {/* Aurora glow corners */}
      <View pointerEvents="none" style={styles.bgWrap}>
        <View style={[styles.glowTop, { backgroundColor: "#3B82F6" }]} />
        <View style={[styles.glowBottom, { backgroundColor: "#A855F7" }]} />
      </View>

      {/* Diagonal hairline accents */}
      <View pointerEvents="none" style={styles.hairlinesWrap}>
        <View style={styles.hairline1} />
        <View style={styles.hairline2} />
      </View>

      {/* Shimmer sweep */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.sweep, sweepStyle]}>
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.10)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>

      {/* Top row: label + LIVE pulse */}
      <View style={styles.topRow}>
        <Text style={[styles.eyebrowLabel, { color: colors.textSecondary }]}>PORTFOLIO BALANCE</Text>
        <View style={styles.liveWrap}>
          <LivePulse color={colors.green} />
          <Text style={[styles.liveText, { color: colors.green }]}>LIVE</Text>
        </View>
      </View>

      {/* Sub row: eye + INR pill */}
      <View style={styles.subTopRow}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); onToggleHide(); }}
          hitSlop={8}
          style={[styles.eyeBtn, { borderColor: "rgba(255,255,255,0.10)" }]}
        >
          <Feather name={isHidden ? "eye-off" : "eye"} size={12} color={colors.textSecondary} />
        </Pressable>
        <Pressable style={[styles.currencyChip, { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.10)" }]}>
          <View style={[styles.currencyDot, { backgroundColor: colors.purple }]} />
          <Text style={[styles.currencyText, { color: colors.foreground }]}>INR</Text>
          <Feather name="chevron-down" size={10} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Hero balance */}
      <View style={styles.balanceRow}>
        {isHidden ? (
          <Text style={[styles.balance, { color: colors.foreground }]}>••••••••</Text>
        ) : (
          <AnimatedNumber
            value={balanceInr}
            prefix="₹"
            decimals={2}
            style={[styles.balance, { color: colors.foreground }]}
          />
        )}
      </View>

      <Text style={[styles.usdValue, { color: colors.textMuted }]}>
        {isHidden ? "≈ $••••" : `≈ $${balanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Updated just now`}
      </Text>

      {/* PNL row with sparkline */}
      <View style={styles.pnlRow}>
        <View style={[styles.pnlPill, { backgroundColor: `${trendColor}1F`, borderColor: `${trendColor}66` }]}>
          <Feather name={isUp ? "trending-up" : "trending-down"} size={11} color={trendColor} />
          <Text style={[styles.pnlText, { color: trendColor }]}>
            {isHidden ? "••••" : `${isUp ? "+" : ""}₹${Math.abs(pnl24h).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          </Text>
          <Text style={[styles.pnlPct, { color: trendColor }]}>
            {isUp ? "+" : ""}{pnl24hPct.toFixed(2)}%
          </Text>
        </View>
        <Text style={[styles.pnlLabel, { color: colors.textMuted }]}>Today's PNL</Text>
        <View style={styles.sparkWrap}>
          <MiniSparkline width={84} height={32} color={trendColor} isUp={isUp} />
        </View>
      </View>

      {/* Premium action tiles */}
      <View style={styles.actionsGrid}>
        <ActionTile
          icon="arrow-down"
          label="Deposit"
          caption="Add funds"
          color={colors.green}
          tintTop="rgba(34,197,94,0.22)"
          tintBottom="rgba(34,197,94,0.02)"
          ringTop="rgba(34,197,94,0.55)"
          ringBottom="rgba(34,197,94,0.10)"
          onPress={onDeposit}
        />
        <ActionTile
          icon="arrow-up"
          label="Withdraw"
          caption="Cash out"
          color={colors.purple}
          tintTop="rgba(168,85,247,0.22)"
          tintBottom="rgba(168,85,247,0.02)"
          ringTop="rgba(168,85,247,0.55)"
          ringBottom="rgba(168,85,247,0.10)"
          onPress={onWithdraw}
        />
        <ActionTile
          icon="repeat"
          label="Transfer"
          caption="Move money"
          color={colors.blue}
          tintTop="rgba(59,130,246,0.22)"
          tintBottom="rgba(59,130,246,0.02)"
          ringTop="rgba(59,130,246,0.55)"
          ringBottom="rgba(59,130,246,0.10)"
          onPress={onTransfer}
        />
      </View>
    </LinearGradient>
  );
}

function LivePulse({ color }: { color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }), -1, false);
  }, [p]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + p.value * 2 }],
    opacity: 0.6 * (1 - p.value),
  }));
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { backgroundColor: color }, ringStyle]} />
      <View style={[styles.pulseDot, { backgroundColor: color }]} />
    </View>
  );
}

function MiniSparkline({
  width,
  height,
  color,
  isUp,
}: {
  width: number;
  height: number;
  color: string;
  isUp: boolean;
}) {
  const points = useMemo(() => {
    const n = 24;
    const arr: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const trend = isUp ? t * 1.0 : -t * 1.0;
      const noise = Math.sin(i * 1.7) * 0.28 + Math.cos(i * 2.3) * 0.18 + Math.sin(i * 0.9) * 0.12;
      arr.push(trend + noise);
    }
    return arr;
  }, [isUp]);

  const { line, fill } = useMemo(() => {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const padY = height * 0.12;
    const stepX = width / (points.length - 1);
    const ys = points.map((p) => height - padY - ((p - min) / range) * (height - padY * 2));
    let line = "";
    for (let i = 0; i < points.length; i++) {
      const x = i * stepX;
      line += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)} `;
    }
    const fill = `${line} L${width.toFixed(2)},${height} L0,${height} Z`;
    return { line, fill };
  }, [points, width, height]);

  const gid = `mspark_${isUp ? "up" : "dn"}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLG id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.50" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgLG>
      </Defs>
      <Path d={fill} fill={`url(#${gid})`} />
      <Path d={line} stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ActionTile({
  icon,
  label,
  caption,
  color,
  tintTop,
  tintBottom,
  ringTop,
  ringBottom,
  onPress,
}: {
  icon: keyof typeof import("@expo/vector-icons").Feather.glyphMap;
  label: string;
  caption: string;
  color: string;
  tintTop: string;
  tintBottom: string;
  ringTop: string;
  ringBottom: string;
  onPress?: () => void;
}) {
  const press = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.05 }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: press.value * 0.35,
  }));
  return (
    <Pressable
      onPressIn={() => {
        press.value = withTiming(1, { duration: 120 });
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 220 });
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={styles.actionTileWrap}
    >
      <Animated.View style={[styles.actionAnim, animStyle]}>
        {/* Outer soft halo */}
        <View
          pointerEvents="none"
          style={[
            styles.actionHalo,
            { backgroundColor: color, shadowColor: color },
          ]}
        />

        {/* Premium gradient circle */}
        <LinearGradient
          colors={[ringTop, ringBottom]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[
            styles.actionCircle,
            { borderColor: color, shadowColor: color },
          ]}
        >
          {/* Glossy inner top highlight */}
          <LinearGradient
            colors={["rgba(255,255,255,0.30)", "rgba(255,255,255,0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.6 }}
            style={styles.actionCircleHighlight}
            pointerEvents="none"
          />
          {/* Press flash */}
          <Animated.View
            pointerEvents="none"
            style={[styles.actionCircleFlash, { backgroundColor: "#fff" }, flashStyle]}
          />
          <Feather name={icon} size={22} color="#fff" />
        </LinearGradient>

        <Text style={styles.actionLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  bgWrap: { ...StyleSheet.absoluteFillObject },
  glowTop: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.10,
    top: -100,
    right: -70,
  },
  glowBottom: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.10,
    bottom: -90,
    left: -60,
  },
  hairlinesWrap: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  hairline1: {
    position: "absolute",
    top: -50,
    left: -100,
    width: 600,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    transform: [{ rotate: "20deg" }],
  },
  hairline2: {
    position: "absolute",
    bottom: -20,
    left: -100,
    width: 600,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    transform: [{ rotate: "20deg" }],
  },
  sweep: {
    position: "absolute",
    top: -80,
    width: 110,
    height: 360,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 1 },
  eyebrowLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.6 },
  liveWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  pulseWrap: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  pulseRing: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },
  subTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, zIndex: 1 },
  eyeBtn: {
    width: 26,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  currencyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  currencyDot: { width: 5, height: 5, borderRadius: 2.5 },
  currencyText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  balanceRow: { marginTop: 14, zIndex: 1 },
  balance: { fontSize: 38, fontFamily: "Inter_700Bold", letterSpacing: -1.5, lineHeight: 44 },
  usdValue: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2, zIndex: 1 },
  pnlRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, zIndex: 1 },
  pnlPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  pnlText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  pnlPct: { fontSize: 11, fontFamily: "Inter_700Bold" },
  pnlLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  sparkWrap: { marginLeft: "auto" },

  actionsGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    zIndex: 1,
  },
  actionTileWrap: { flex: 1, alignItems: "center" },
  actionAnim: { alignItems: "center", gap: 8 },
  actionHalo: {
    position: "absolute",
    top: 8,
    width: 56,
    height: 56,
    borderRadius: 28,
    opacity: 0.18,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    overflow: "hidden",
  },
  actionCircleHighlight: {
    position: "absolute",
    top: 2,
    left: 2,
    right: 2,
    height: 26,
    borderRadius: 28,
  },
  actionCircleFlash: {
    ...StyleSheet.absoluteFillObject,
  },
  actionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)", letterSpacing: 0.2 },
});
