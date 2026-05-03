import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface OrbitalAIHeroProps {
  scanned?: number;
  trades?: number;
  accuracy?: number;
  width: number;
}

const TOKENS: { sym: string; color: string; bg: string; r: number; speed: number; phase: number }[] = [
  { sym: "₿",  color: "#F7931A", bg: "rgba(247,147,26,0.18)",  r: 92, speed: 9000,  phase: 0 },
  { sym: "Ξ",  color: "#627EEA", bg: "rgba(98,126,234,0.18)",  r: 116, speed: 14000, phase: Math.PI * 0.55 },
  { sym: "◎",  color: "#9945FF", bg: "rgba(153,69,255,0.18)",  r: 70, speed: 7500,  phase: Math.PI * 1.1 },
  { sym: "◆",  color: "#22D3EE", bg: "rgba(34,211,238,0.18)",  r: 130, speed: 17000, phase: Math.PI * 1.7 },
];

export function OrbitalAIHero({ scanned = 12847, trades = 47, accuracy = 94.2, width }: OrbitalAIHeroProps) {
  const colors = useColors();

  // single master rotation
  const t = useSharedValue(0);
  // counter-rotation for halo grid
  const halo = useSharedValue(0);
  // breathing core
  const breath = useSharedValue(0);
  // shimmer sweep
  const shimmer = useSharedValue(0);
  // ring pulses
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);
  const pulse3 = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 12000, easing: Easing.linear }), -1, false);
    halo.value = withRepeat(withTiming(1, { duration: 28000, easing: Easing.linear }), -1, false);
    breath.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }), -1, true);
    shimmer.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1, false);
    pulse1.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) }), -1, false);
    pulse2.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) }), -1, false);
    pulse3.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) }), -1, false);
  }, [t, halo, breath, shimmer, pulse1, pulse2, pulse3]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${halo.value * 360}deg` }],
  }));

  const counterHaloStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-halo.value * 360}deg` }],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.08 }],
    opacity: 0.85 + breath.value * 0.15,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -200 + shimmer.value * 600 }, { rotate: "20deg" }],
    opacity: shimmer.value < 0.5 ? shimmer.value * 0.8 : (1 - shimmer.value) * 0.8,
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.8 + pulse1.value * 1.6 }],
    opacity: 0.55 * (1 - pulse1.value),
  }));
  const ring2Style = useAnimatedStyle(() => {
    const p = (pulse2.value + 0.33) % 1;
    return { transform: [{ scale: 0.8 + p * 1.6 }], opacity: 0.45 * (1 - p) };
  });
  const ring3Style = useAnimatedStyle(() => {
    const p = (pulse3.value + 0.66) % 1;
    return { transform: [{ scale: 0.8 + p * 1.6 }], opacity: 0.35 * (1 - p) };
  });

  const HEIGHT = 280;

  return (
    <View style={[styles.card, { width, height: HEIGHT, borderColor: colors.borderBright, backgroundColor: colors.card }]}>
      {/* deep gradient backdrop */}
      <LinearGradient
        colors={["#0E1626", "#0B1014", "#0F0820"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* radial-ish glow */}
      <View pointerEvents="none" style={styles.glowWrap}>
        <View style={[styles.glow, { backgroundColor: "#3B82F6", top: -40, left: -40 }]} />
        <View style={[styles.glow, { backgroundColor: "#A855F7", bottom: -40, right: -40 }]} />
      </View>

      {/* decorative grid halo (rotating) */}
      <Animated.View pointerEvents="none" style={[styles.haloRing, haloStyle]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.haloDot,
              {
                transform: [{ rotate: `${(i * 360) / 12}deg` }, { translateY: -110 }],
                backgroundColor: i % 3 === 0 ? "#A855F7" : i % 3 === 1 ? "#3B82F6" : "#EC4899",
              },
            ]}
          />
        ))}
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.haloRing, counterHaloStyle]}>
        {Array.from({ length: 24 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.haloTick,
              {
                transform: [{ rotate: `${(i * 360) / 24}deg` }, { translateY: -140 }],
                opacity: i % 2 === 0 ? 0.7 : 0.25,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* expanding pulse rings */}
      <View pointerEvents="none" style={styles.center}>
        <Animated.View style={[styles.pulseRing, ring1Style]} />
        <Animated.View style={[styles.pulseRing, ring2Style]} />
        <Animated.View style={[styles.pulseRing, ring3Style]} />
      </View>

      {/* orbiting tokens */}
      {TOKENS.map((tok, i) => (
        <OrbitalToken key={i} t={t} token={tok} />
      ))}

      {/* central core */}
      <View pointerEvents="none" style={styles.center}>
        <Animated.View style={coreStyle}>
          <LinearGradient
            colors={["#60A5FA", "#A855F7", "#EC4899"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.core}
          >
            <View style={styles.coreInner}>
              <Feather name="cpu" size={22} color="#fff" />
            </View>
          </LinearGradient>
        </Animated.View>
      </View>

      {/* shimmer sweep */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.18)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>

      {/* top-left status */}
      <View style={styles.topLeft}>
        <View style={[styles.statusPill, { borderColor: "rgba(34,197,94,0.4)", backgroundColor: "rgba(34,197,94,0.10)" }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.green }]} />
          <Text style={[styles.statusText, { color: colors.green }]}>AI ENGINE</Text>
        </View>
        <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Quantum Core · v4.2</Text>
      </View>

      {/* top-right boost */}
      <View style={styles.topRight}>
        <Text style={[styles.boostNum, { color: colors.foreground }]}>{accuracy.toFixed(1)}%</Text>
        <Text style={[styles.boostLabel, { color: colors.textMuted }]}>ACCURACY</Text>
      </View>

      {/* bottom stats bar (glassmorphism) */}
      <View style={styles.statsBar}>
        {Platform.OS !== "web" ? (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,20,30,0.55)" }]} />
        )}
        <View style={[StyleSheet.absoluteFill, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }]} />
        <View style={styles.statsRow}>
          <Stat label="SCANNED" value={scanned.toLocaleString()} accent="#60A5FA" />
          <View style={styles.divider} />
          <Stat label="TRADES" value={trades.toString()} accent="#A855F7" />
          <View style={styles.divider} />
          <Stat label="WIN RATE" value="92.7%" accent="#22C55E" />
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: "#fff" }]}>{value}</Text>
      <View style={styles.statLabelRow}>
        <View style={[styles.statDot, { backgroundColor: accent }]} />
        <Text style={[styles.statLabel, { color: "rgba(255,255,255,0.6)" }]}>{label}</Text>
      </View>
    </View>
  );
}

function OrbitalToken({
  t,
  token,
}: {
  t: SharedValue<number>;
  token: { sym: string; color: string; bg: string; r: number; speed: number; phase: number };
}) {
  const factor = 12000 / token.speed;
  const style = useAnimatedStyle(() => {
    const angle = t.value * Math.PI * 2 * factor + token.phase;
    const x = Math.cos(angle) * token.r;
    const y = Math.sin(angle) * token.r * 0.55;
    const depth = (Math.sin(angle) + 1) / 2;
    const scale = 0.7 + depth * 0.5;
    const opacity = 0.55 + depth * 0.45;
    return {
      transform: [{ translateX: x }, { translateY: y }, { scale }],
      opacity,
      zIndex: depth > 0.5 ? 5 : 1,
    } as any;
  });

  return (
    <View pointerEvents="none" style={styles.center}>
      <Animated.View style={[styles.token, { backgroundColor: token.bg, borderColor: token.color, shadowColor: token.color }, style]}>
        <Text style={[styles.tokenSym, { color: token.color }]}>{token.sym}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  glowWrap: { ...StyleSheet.absoluteFillObject },
  glow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.18,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    top: -30,
  },
  haloRing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    top: -30,
  },
  haloDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.7,
  },
  haloTick: {
    position: "absolute",
    width: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  pulseRing: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.6)",
  },
  core: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#A855F7",
    shadowOpacity: 0.8,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  coreInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(15,20,30,0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  token: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  tokenSym: { fontSize: 16, fontFamily: "Inter_700Bold" },
  shimmer: {
    position: "absolute",
    top: -50,
    width: 120,
    height: 380,
  },
  topLeft: { position: "absolute", top: 14, left: 14 },
  topRight: { position: "absolute", top: 14, right: 14, alignItems: "flex-end" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  subLabel: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 4 },
  boostNum: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  boostLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  statsBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
    overflow: "hidden",
  },
  statsRow: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  statDot: { width: 4, height: 4, borderRadius: 2 },
  statLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  divider: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.08)" },
});
