import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useRouter } from "expo-router";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { StopTradingDialog } from "@/components/StopTradingDialog";
import { StrategyStoppedDialog } from "@/components/StrategyStoppedDialog";
import { usePortfolio } from "@/context/PortfolioContext";
import { useColors } from "@/hooks/useColors";

interface DeployedStrategyCardProps {
  onStop?: () => void;
}

const BRAND_PURPLE = "#A855F7";
const BRAND_PINK = "#EC4899";
const BRAND_BLUE = "#60A5FA";
const GREEN = "#22C55E";
const RED = "#EF4444";

const fmtINRWhole = (n: number) =>
  Math.floor(Math.abs(n)).toLocaleString("en-IN");
const fmtINRDec = (n: number) =>
  (Math.abs(n) - Math.floor(Math.abs(n))).toFixed(2).slice(1);

function PulseRing({ color, size = 10 }: { color: string; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 2.4, duration: 1300, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
      <View
        style={{
          width: size * 0.65,
          height: size * 0.65,
          borderRadius: (size * 0.65) / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function DeployedStrategyCard({ onStop }: DeployedStrategyCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { portfolio, stopStrategy } = usePortfolio();
  const [autoCompound, setAutoCompound] = useState(true);
  const [confirmStop, setConfirmStop] = useState(false);
  const [stoppedSuccess, setStoppedSuccess] = useState(false);
  const [snapshot, setSnapshot] = useState<{ capital: number; pnl: number } | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);

  if (!portfolio || portfolio.deployedAmount <= 0) return null;

  const tradingAmount = portfolio.deployedAmount;
  const currentValue = portfolio.currentNAV;
  const delta = currentValue - tradingAmount;
  const deltaPct = tradingAmount > 0 ? (delta / tradingAmount) * 100 : 0;
  const isUp = delta >= 0;
  const deltaColor = isUp ? GREEN : RED;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderBright }]}>
      {/* Top hairline */}
      <LinearGradient
        colors={[BRAND_BLUE, BRAND_PURPLE, BRAND_PINK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topAccent}
      />

      {/* Ambient glows */}
      <LinearGradient
        colors={[BRAND_PURPLE + "1F", "transparent"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.glowTR}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", BRAND_PINK + "14"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glowBL}
        pointerEvents="none"
      />

      {/* LIVE pill */}
      <View style={styles.liveRow}>
        <View style={[styles.livePill, { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.4)" }]}>
          <PulseRing color={GREEN} size={7} />
          <Text style={[styles.liveText, { color: GREEN }]}>BOT TRADING LIVE</Text>
        </View>
      </View>

      {/* Dual amount row: Trading vs Current */}
      <View style={styles.dualRow}>
        {/* Trading amount */}
        <View style={styles.amtBlock}>
          <Text style={[styles.amtLabel, { color: colors.textMuted }]}>TRADING AMOUNT</Text>
          <View style={styles.amtValueRow}>
            <Text style={[styles.amtRupee, { color: colors.foreground }]}>₹</Text>
            <Text style={[styles.amtWhole, { color: colors.foreground }]}>{fmtINRWhole(tradingAmount)}</Text>
            <Text style={[styles.amtDec, { color: colors.textSecondary }]}>{fmtINRDec(tradingAmount)}</Text>
          </View>
        </View>

        {/* Vertical brand divider */}
        <LinearGradient
          colors={["transparent", BRAND_PURPLE + "55", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.vDiv}
        />

        {/* Current value */}
        <View style={styles.amtBlock}>
          <View style={styles.curHeaderRow}>
            <Text style={[styles.amtLabel, { color: colors.textMuted }]}>CURRENT VALUE</Text>
            <View style={styles.tinyPulse}>
              <PulseRing color={deltaColor} size={5} />
            </View>
          </View>
          <View style={styles.amtValueRow}>
            <Text style={[styles.amtRupee, { color: colors.foreground }]}>₹</Text>
            <AnimatedNumber
              value={Math.floor(currentValue)}
              formatter={(n) => Math.floor(n).toLocaleString("en-IN")}
              duration={650}
              style={[styles.amtWhole, { color: colors.foreground }]}
            />
            <Text style={[styles.amtDec, { color: colors.textSecondary }]}>{fmtINRDec(currentValue)}</Text>
          </View>
          <View style={[styles.deltaPill, { backgroundColor: deltaColor + "1F", borderColor: deltaColor + "55" }]}>
            <Feather name={isUp ? "arrow-up-right" : "arrow-down-right"} size={9} color={deltaColor} />
            <Text style={[styles.deltaText, { color: deltaColor }]}>
              {isUp ? "+" : "−"}₹{fmtINRWhole(delta)} ({isUp ? "+" : ""}{deltaPct.toFixed(2)}%)
            </Text>
          </View>
        </View>
      </View>

      {/* Auto-compound row */}
      <View style={[styles.compoundRow, { borderColor: colors.border }]}>
        <View style={styles.compoundLeft}>
          <View style={styles.compoundIconHalo}>
            <View style={[styles.compoundIconRing, { borderColor: BRAND_PURPLE + "55" }]} />
            <LinearGradient
              colors={[BRAND_PURPLE, BRAND_PINK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.compoundIcon}
            >
              <Feather name="refresh-cw" size={14} color="#fff" />
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.compoundTitle, { color: colors.foreground }]}>Auto-Compounding</Text>
            <Text style={[styles.compoundSub, { color: colors.textMuted }]}>
              {autoCompound ? "Profits being reinvested" : "Profits will sit idle"}
            </Text>
          </View>
        </View>
        <Switch
          value={autoCompound}
          onValueChange={(v) => {
            setAutoCompound(v);
            Haptics.selectionAsync();
          }}
          trackColor={{ false: "rgba(255,255,255,0.1)", true: BRAND_PURPLE }}
          thumbColor="#fff"
          ios_backgroundColor="rgba(255,255,255,0.1)"
        />
      </View>

      {/* Stop Trading */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setConfirmStop(true);
        }}
        style={({ pressed }) => [
          styles.stopBtn,
          {
            borderColor: "rgba(239,68,68,0.45)",
            backgroundColor: pressed ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.1)",
          },
        ]}
      >
        <Feather name="square" size={13} color={RED} />
        <Text style={[styles.stopBtnText, { color: RED }]}>Stop Trading</Text>
      </Pressable>

      {stopError && (
        <View style={{ marginTop: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.08)", flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="alert-circle" size={14} color={RED} />
          <Text style={{ flex: 1, fontSize: 12, color: RED, fontFamily: "Inter_500Medium" }}>{stopError}</Text>
          <Pressable onPress={() => setStopError(null)} hitSlop={8}>
            <Feather name="x" size={14} color={RED} />
          </Pressable>
        </View>
      )}

      <StopTradingDialog
        visible={confirmStop}
        capitalAmount={currentValue}
        onCancel={() => setConfirmStop(false)}
        onConfirm={async () => {
          setConfirmStop(false);
          try {
            const res = await stopStrategy();
            setSnapshot({ capital: res.capitalReturned, pnl: res.finalPnL });
            setTimeout(() => setStoppedSuccess(true), 220);
          } catch (err) {
            const e = err as { message?: string };
            setStopError(e?.message ?? "Could not stop strategy. Please try again.");
          }
        }}
      />

      <StrategyStoppedDialog
        visible={stoppedSuccess}
        capitalAmount={snapshot?.capital ?? currentValue}
        totalPnL={snapshot?.pnl ?? delta}
        onDismiss={() => setStoppedSuccess(false)}
        onViewWallet={() => {
          setStoppedSuccess(false);
          router.push("/(tabs)/wallet");
        }}
        onRedeploy={() => {
          setStoppedSuccess(false);
          router.push("/deploy");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    overflow: "hidden",
    position: "relative",
  },
  topAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 2, opacity: 0.95 },
  glowTR: { position: "absolute", top: 0, right: 0, width: 220, height: 200, borderTopRightRadius: 22 },
  glowBL: { position: "absolute", bottom: 0, left: 0, width: 200, height: 180, borderBottomLeftRadius: 22 },

  liveRow: { flexDirection: "row" },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  liveText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.7 },

  dualRow: { flexDirection: "row", alignItems: "stretch", gap: 12, paddingVertical: 4 },
  amtBlock: { flex: 1, gap: 8 },
  curHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tinyPulse: { width: 6, height: 6, alignItems: "center", justifyContent: "center" },
  amtLabel: { fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },
  amtValueRow: { flexDirection: "row", alignItems: "baseline" },
  amtRupee: { fontSize: 17, fontFamily: "Inter_700Bold", marginRight: 1 },
  amtWhole: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  amtDec: { fontSize: 12, fontFamily: "Inter_700Bold" },

  vDiv: { width: 1, alignSelf: "stretch" },

  deltaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  deltaText: { fontSize: 10.5, fontFamily: "Inter_700Bold" },

  compoundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  compoundLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11 },
  compoundIconHalo: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  compoundIconRing: { position: "absolute", width: 38, height: 38, borderRadius: 19, borderWidth: 1 },
  compoundIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  compoundTitle: { fontSize: 13.5, fontFamily: "Inter_700Bold" },
  compoundSub: { fontSize: 10.5, fontFamily: "Inter_400Regular", marginTop: 2 },

  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  stopBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
});
