import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { BotPulse } from "@/components/BotPulse";
import { useColors } from "@/hooks/useColors";

const STRATEGIES = [
  { name: "Pattern Recognition", target: 92 },
  { name: "Risk Assessment", target: 87 },
  { name: "Volatility Analysis", target: 78 },
  { name: "Order Flow", target: 84 },
];

const THINKING_MESSAGES = [
  "Analyzing 1,284 candlestick patterns",
  "Evaluating 47 momentum signals",
  "Cross-referencing volatility surfaces",
  "Computing optimal entry windows",
  "Scanning institutional order flow",
  "Backtesting 12 strategy combinations",
];

interface AIBotStatusProps {
  botName: string;
  riskTier: string;
}

export function AIBotStatus({ botName, riskTier }: AIBotStatusProps) {
  const colors = useColors();
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState<number[]>(STRATEGIES.map(() => 0));
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Rotate thinking messages with fade transition
  useEffect(() => {
    const id = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.2, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
      ]).start(() => {
        setMsgIndex((i) => (i + 1) % THINKING_MESSAGES.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2800);
    return () => clearInterval(id);
  }, [fadeAnim]);

  // Animate progress bars on mount
  useEffect(() => {
    let mounted = true;
    const stepInterval = setInterval(() => {
      if (!mounted) return;
      setProgress((prev) =>
        prev.map((p, i) => {
          const target = STRATEGIES[i].target;
          if (Math.abs(p - target) < 0.5) {
            // Drift around target
            return target + (Math.random() - 0.5) * 6;
          }
          return p + (target - p) * 0.15;
        })
      );
    }, 120);
    return () => {
      mounted = false;
      clearInterval(stepInterval);
    };
  }, []);

  return (
    <LinearGradient
      colors={["rgba(74,158,255,0.10)", "rgba(15,19,24,1)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: "rgba(74,158,255,0.25)" }]}
    >
      <View style={styles.header}>
        <View style={[styles.aiIcon, { backgroundColor: "rgba(74,158,255,0.15)" }]}>
          <Feather name="cpu" size={16} color={colors.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>{botName}</Text>
            <View style={[styles.activePill, { backgroundColor: "rgba(46,204,113,0.12)" }]}>
              <BotPulse color={colors.green} size={5} />
              <Text style={[styles.activeText, { color: colors.green }]}>ACTIVE</Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Neural · {riskTier} risk profile
          </Text>
        </View>
      </View>

      <Animated.View style={[styles.thinkingBar, { opacity: fadeAnim, backgroundColor: colors.card2 }]}>
        <Feather name="zap" size={11} color={colors.gold} />
        <Text style={[styles.thinkingText, { color: colors.foreground }]}>
          {THINKING_MESSAGES[msgIndex]}…
        </Text>
      </Animated.View>

      <View style={styles.barsWrap}>
        {STRATEGIES.map((s, i) => (
          <View key={s.name} style={styles.barRow}>
            <Text style={[styles.barLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              {s.name}
            </Text>
            <View style={[styles.barTrack, { backgroundColor: colors.card2 }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(100, Math.max(0, progress[i]))}%`,
                    backgroundColor: colors.blue,
                  },
                ]}
              />
            </View>
            <Text style={[styles.barPct, { color: colors.foreground }]}>
              {progress[i].toFixed(0)}%
            </Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  aiIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 },
  activePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
  },
  activeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  subtitle: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  thinkingBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
  },
  thinkingText: { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 },
  barsWrap: { gap: 7 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { fontSize: 11, fontFamily: "Inter_500Medium", width: 110 },
  barTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  barPct: { fontSize: 11, fontFamily: "Inter_700Bold", width: 32, textAlign: "right" },
});
