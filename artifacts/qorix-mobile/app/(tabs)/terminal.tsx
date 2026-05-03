import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Touchable } from "@/components/Touchable";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CandlestickChart, generateCandles } from "@/components/CandlestickChart";
import { Sparkline } from "@/components/Sparkline";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_W } = Dimensions.get("window");
const BRAND_BLUE = "#60A5FA";
const BRAND_PURPLE = "#A855F7";
const BRAND_PINK = "#EC4899";
const ACCENT_GOLD = "#EAB308";

function hexToRgba(hex: string, alpha: number) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

interface Pair {
  id: string;
  symbol: string;
  pair: string;
  price: number;
  change: number;
  vol: string;
  startPrice: number;
}

const PAIRS: Pair[] = [
  { id: "btc", symbol: "BTC", pair: "USD", price: 78230.16, change: 0.04, vol: "$32.4B", startPrice: 78000 },
  { id: "eth", symbol: "ETH", pair: "USD", price: 3284.5, change: 1.42, vol: "$18.2B", startPrice: 3260 },
  { id: "sol", symbol: "SOL", pair: "USD", price: 148.7, change: 3.21, vol: "$4.1B", startPrice: 144 },
  { id: "bnb", symbol: "BNB", pair: "USD", price: 612.4, change: 0.81, vol: "$1.8B", startPrice: 608 },
];

interface TapeRow {
  id: string;
  time: string;
  side: "BUY" | "SELL";
  qty: string;
  price: number;
}

function genTape(price: number, count: number): TapeRow[] {
  const out: TapeRow[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const side: "BUY" | "SELL" = Math.random() > 0.5 ? "BUY" : "SELL";
    const drift = (Math.random() - 0.5) * price * 0.0008;
    const t = new Date(now.getTime() - i * 1500);
    out.push({
      id: `t-${i}-${Math.random()}`,
      time: t.toTimeString().slice(0, 8),
      side,
      qty: (Math.random() * 0.1 + 0.01).toFixed(3),
      price: +(price + drift).toFixed(2),
    });
  }
  return out;
}

function Pulse({ color = "#22C55E" }: { color?: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, [v]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - v.value,
    transform: [{ scale: 1 + v.value * 1.6 }],
  }));
  return (
    <View style={pulseStyles.wrap}>
      <Animated.View style={[pulseStyles.ring, { borderColor: color }, ringStyle]} />
      <View style={[pulseStyles.dot, { backgroundColor: color }]} />
    </View>
  );
}
const pulseStyles = StyleSheet.create({
  wrap: { width: 8, height: 8, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 8, height: 8, borderRadius: 4, borderWidth: 1.2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

function CalibratingDots({ color }: { color: string }) {
  const a = useSharedValue(0);
  useEffect(() => {
    a.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
  }, [a]);
  const d1 = useAnimatedStyle(() => ({ opacity: 0.3 + Math.abs(Math.sin(a.value * Math.PI * 2)) * 0.7 }));
  const d2 = useAnimatedStyle(() => ({ opacity: 0.3 + Math.abs(Math.sin(a.value * Math.PI * 2 + 2)) * 0.7 }));
  const d3 = useAnimatedStyle(() => ({ opacity: 0.3 + Math.abs(Math.sin(a.value * Math.PI * 2 + 4)) * 0.7 }));
  return (
    <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
      <Animated.View style={[styles.calDot, { backgroundColor: color }, d1]} />
      <Animated.View style={[styles.calDot, { backgroundColor: color }, d2]} />
      <Animated.View style={[styles.calDot, { backgroundColor: color }, d3]} />
    </View>
  );
}

export default function TerminalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const green = colors.green;
  const red = colors.red;

  const [activePair] = useState<Pair>(PAIRS[0]);
  const [livePrice, setLivePrice] = useState(activePair.price);
  const [pnl, setPnl] = useState(5.6);
  const [pnlHistory, setPnlHistory] = useState<number[]>(() => {
    const out: number[] = [];
    let v = 0;
    for (let i = 0; i < 30; i++) {
      v += (Math.random() - 0.35) * 0.6;
      out.push(+v.toFixed(2));
    }
    return out;
  });
  const candles = useMemo(() => generateCandles(48, activePair.startPrice, 0.012), [activePair.id]);
  const [tape, setTape] = useState<TapeRow[]>(() => genTape(activePair.price, 24));
  const tapeIdRef = useRef(0);

  // Live price ticker
  useEffect(() => {
    setLivePrice(activePair.price);
    setTape(genTape(activePair.price, 24));
    tapeIdRef.current = 0;
  }, [activePair.id, activePair.price]);

  useEffect(() => {
    const id = setInterval(() => {
      setLivePrice((p) => +(p + (Math.random() - 0.5) * p * 0.0006).toFixed(2));
      setPnl((v) => {
        const next = +(v + (Math.random() - 0.5) * 0.4).toFixed(2);
        setPnlHistory((h) => [...h.slice(1), next]);
        return next;
      });
      // Append new tape row
      setTape((prev) => {
        const side: "BUY" | "SELL" = Math.random() > 0.5 ? "BUY" : "SELL";
        const drift = (Math.random() - 0.5) * activePair.price * 0.0008;
        const t = new Date();
        tapeIdRef.current += 1;
        const row: TapeRow = {
          id: `live-${tapeIdRef.current}`,
          time: t.toTimeString().slice(0, 8),
          side,
          qty: (Math.random() * 0.1 + 0.01).toFixed(3),
          price: +(activePair.price + drift).toFixed(2),
        };
        return [row, ...prev].slice(0, 30);
      });
    }, 1500);
    return () => clearInterval(id);
  }, [activePair.id, activePair.price]);

  const pnlPositive = pnl >= 0;
  const chartW = SCREEN_W - 32 - 24;
  const chartH = 200;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <View style={{ gap: 2 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Terminal</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            Live market & bot signals
          </Text>
        </View>
        <Pressable
          onPress={() => Haptics.selectionAsync()}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
          hitSlop={8}
        >
          <Feather name="settings" size={16} color={colors.foreground} />
        </Pressable>
      </Animated.View>

      {/* BOT TERMINAL CARD */}
      <Animated.View entering={FadeInDown.duration(400).delay(80)}>
        <View
          style={[
            styles.botCard,
            {
              backgroundColor: "#0F141B",
              borderColor: hexToRgba(green, 0.25),
            },
          ]}
        >
          <LinearGradient
            colors={[hexToRgba(green, 0.08), "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Bot Terminal header */}
          <View style={styles.botHead}>
            <View style={styles.botHeadLeft}>
              <View style={[styles.botIcon, { backgroundColor: hexToRgba(green, 0.16), borderColor: hexToRgba(green, 0.4) }]}>
                <Feather name="activity" size={13} color={green} />
              </View>
              <Text style={[styles.botTitle, { color: colors.foreground }]}>BOT TERMINAL</Text>
              <View style={[styles.livePill, { backgroundColor: hexToRgba(green, 0.14), borderColor: hexToRgba(green, 0.4) }]}>
                <Pulse color={green} />
                <Text style={[styles.livePillText, { color: green }]}>LIVE</Text>
              </View>
              <View style={[styles.pnlChip, { backgroundColor: hexToRgba(pnlPositive ? green : red, 0.12), borderColor: hexToRgba(pnlPositive ? green : red, 0.4) }]}>
                <Text style={[styles.pnlChipText, { color: pnlPositive ? green : red }]}>
                  {pnlPositive ? "+" : ""}${Math.abs(pnl).toFixed(2)}
                </Text>
              </View>
            </View>
            <Text style={[styles.todayText, { color: colors.textMuted }]}>+0.00% today</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.05)" }]} />

          {/* Pair price row */}
          <View style={styles.priceRow}>
            <View style={styles.priceRowLeft}>
              <Text style={[styles.pairName, { color: colors.foreground }]}>
                {activePair.symbol}/{activePair.pair}
              </Text>
              <View style={[styles.livePillSm, { backgroundColor: hexToRgba(green, 0.14), borderColor: hexToRgba(green, 0.4) }]}>
                <Pulse color={green} />
                <Text style={[styles.livePillTextSm, { color: green }]}>LIVE</Text>
              </View>
            </View>
            <View style={styles.priceRowRight}>
              <Text style={[styles.priceText, { color: green }]}>
                {livePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <View style={styles.priceChangeRow}>
                <Feather
                  name={activePair.change >= 0 ? "arrow-up" : "arrow-down"}
                  size={11}
                  color={activePair.change >= 0 ? green : red}
                />
                <Text style={[styles.priceChange, { color: activePair.change >= 0 ? green : red }]}>
                  {activePair.change >= 0 ? "+" : ""}
                  {activePair.change.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.05)" }]} />

          {/* Bot signal status */}
          <View style={styles.signalRow}>
            <View style={[styles.signalDot, { backgroundColor: ACCENT_GOLD }]} />
            <Text style={[styles.signalLbl, { color: colors.foreground }]}>BOT</Text>
            <Text style={[styles.signalText, { color: colors.textSecondary }]}>
              Calibrating signals
            </Text>
            <CalibratingDots color={ACCENT_GOLD} />
          </View>

          {/* Chart */}
          <View style={styles.chartWrap}>
            <CandlestickChart candles={candles} width={chartW} height={chartH} live />
            {/* Annotations overlay */}
            <View style={styles.chartAnnotations} pointerEvents="none">
              <View style={[styles.annoLeft, { borderColor: hexToRgba(red, 0.4) }]}>
                <Text style={[styles.annoText, { color: red }]}>SELL 0.01 · -$0.81</Text>
              </View>
              <View style={[styles.annoRight, { backgroundColor: hexToRgba(green, 0.16), borderColor: hexToRgba(green, 0.4) }]}>
                <Text style={[styles.annoTextRight, { color: green }]}>
                  {livePrice.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.05)" }]} />

          {/* LIVE TAPE */}
          <View style={styles.tapeHead}>
            <View style={styles.tapeHeadLeft}>
              <View style={[styles.tapeDot, { backgroundColor: green }]} />
              <Text style={[styles.tapeLbl, { color: colors.foreground }]}>LIVE TAPE</Text>
              <Text style={[styles.tapePair, { color: colors.textSecondary }]}>
                {activePair.symbol}/{activePair.pair}
              </Text>
            </View>
            <Text style={[styles.tapeCount, { color: BRAND_BLUE }]}>{tape.length}</Text>
          </View>

          <View style={styles.tapeBody}>
            {tape.slice(0, 7).map((r, i) => (
              <View
                key={r.id}
                style={[
                  styles.tapeRow,
                  { opacity: 1 - i * 0.08 },
                ]}
              >
                <Text style={[styles.tapeTime, { color: colors.textMuted }]}>{r.time}</Text>
                <Text style={[styles.tapeSide, { color: r.side === "BUY" ? green : red }]}>
                  {r.side}
                </Text>
                <Text style={[styles.tapeQty, { color: colors.textSecondary }]}>{r.qty}</Text>
                <Text style={[styles.tapePrice, { color: r.side === "BUY" ? green : red }]}>
                  {r.price.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.05)" }]} />

          {/* P&L Panel — Premium */}
          <View
            style={[
              styles.pnlPanel,
              {
                backgroundColor: "#0B1117",
                borderColor: pnlPositive
                  ? hexToRgba(green, 0.22)
                  : hexToRgba(red, 0.22),
              },
            ]}
          >
            {/* Ambient gradient glow */}
            <LinearGradient
              colors={[
                hexToRgba(pnlPositive ? green : red, 0.18),
                hexToRgba(pnlPositive ? green : red, 0.04),
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* Corner accent */}
            <View
              style={[
                styles.cornerGlow,
                { backgroundColor: hexToRgba(pnlPositive ? green : red, 0.5) },
              ]}
              pointerEvents="none"
            />

            {/* Hero row: P&L + sparkline */}
            <View style={styles.pnlHeroRow}>
              <View style={styles.pnlHeroLeft}>
                <View style={styles.pnlLabelRow}>
                  <View
                    style={[
                      styles.pnlLabelDot,
                      { backgroundColor: pnlPositive ? green : red },
                    ]}
                  />
                  <Text style={[styles.pnlLabel, { color: colors.textMuted }]}>
                    TODAY&apos;S P&amp;L
                  </Text>
                </View>
                <View style={styles.pnlAmountRow}>
                  <Text
                    style={[
                      styles.pnlSign,
                      { color: pnlPositive ? green : red },
                    ]}
                  >
                    {pnlPositive ? "+" : "−"}
                  </Text>
                  <Text
                    style={[
                      styles.pnlCurrency,
                      { color: pnlPositive ? green : red },
                    ]}
                  >
                    $
                  </Text>
                  <Text
                    style={[
                      styles.pnlAmount,
                      { color: pnlPositive ? green : red },
                    ]}
                  >
                    {Math.abs(pnl).toFixed(2)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.pnlPctChip,
                    {
                      backgroundColor: hexToRgba(
                        pnlPositive ? green : red,
                        0.14,
                      ),
                      borderColor: hexToRgba(pnlPositive ? green : red, 0.35),
                    },
                  ]}
                >
                  <Feather
                    name={pnlPositive ? "arrow-up-right" : "arrow-down-right"}
                    size={10}
                    color={pnlPositive ? green : red}
                  />
                  <Text
                    style={[
                      styles.pnlPctText,
                      { color: pnlPositive ? green : red },
                    ]}
                  >
                    {pnlPositive ? "+" : ""}
                    {((pnl / 1000) * 100).toFixed(2)}%
                  </Text>
                  <Text
                    style={[
                      styles.pnlPctSub,
                      { color: hexToRgba(pnlPositive ? green : red, 0.7) },
                    ]}
                  >
                    today
                  </Text>
                </View>
              </View>

              {/* Live mini equity sparkline */}
              <View style={styles.pnlSparkWrap}>
                <Sparkline
                  data={pnlHistory}
                  width={120}
                  height={70}
                  color={pnlPositive ? green : red}
                  strokeWidth={1.8}
                  showDot
                />
                <Text
                  style={[styles.pnlSparkLbl, { color: colors.textMuted }]}
                >
                  LAST 30 TICKS
                </Text>
              </View>
            </View>

            {/* Stat strip with mini progress indicators */}
            <View style={styles.pnlStatStrip}>
              <View style={styles.pnlStat}>
                <Text style={[styles.pnlStatLbl, { color: colors.textMuted }]}>
                  TRADES
                </Text>
                <View style={styles.pnlStatValRow}>
                  <Text
                    style={[styles.pnlStatVal, { color: colors.foreground }]}
                  >
                    {tape.length}
                  </Text>
                  <Text
                    style={[styles.pnlStatUnit, { color: colors.textMuted }]}
                  >
                    today
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.pnlStatVDiv,
                  { backgroundColor: "rgba(255,255,255,0.07)" },
                ]}
              />

              <View style={styles.pnlStat}>
                <Text style={[styles.pnlStatLbl, { color: colors.textMuted }]}>
                  WIN RATE
                </Text>
                <View style={styles.pnlStatValRow}>
                  <Text style={[styles.pnlStatVal, { color: green }]}>
                    68.4%
                  </Text>
                </View>
                <View
                  style={[
                    styles.winBarTrack,
                    { backgroundColor: "rgba(255,255,255,0.06)" },
                  ]}
                >
                  <LinearGradient
                    colors={[green, hexToRgba(green, 0.6)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.winBarFill, { width: "68.4%" }]}
                  />
                </View>
              </View>

              <View
                style={[
                  styles.pnlStatVDiv,
                  { backgroundColor: "rgba(255,255,255,0.07)" },
                ]}
              />

              <View style={styles.pnlStat}>
                <Text style={[styles.pnlStatLbl, { color: colors.textMuted }]}>
                  AVG / TRADE
                </Text>
                <View style={styles.pnlStatValRow}>
                  <Text
                    style={[styles.pnlStatVal, { color: colors.foreground }]}
                  >
                    ${(pnl / Math.max(tape.length, 1)).toFixed(3)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Bot status footer */}
            <View
              style={[
                styles.pnlBotRow,
                {
                  backgroundColor: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.05)",
                },
              ]}
            >
              <View style={styles.pnlBotLeft}>
                <Pulse color={green} />
                <Text
                  style={[styles.pnlBotText, { color: colors.foreground }]}
                >
                  Bot active
                </Text>
                <Text
                  style={[styles.pnlBotSep, { color: colors.textMuted }]}
                >
                  ·
                </Text>
                <Text
                  style={[
                    styles.pnlBotText,
                    { color: colors.textSecondary, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  auto-compounding
                </Text>
              </View>
              <View
                style={[
                  styles.pnlBotBadge,
                  {
                    backgroundColor: hexToRgba(BRAND_PURPLE, 0.14),
                    borderColor: hexToRgba(BRAND_PURPLE, 0.35),
                  },
                ]}
              >
                <Feather name="zap" size={9} color={BRAND_PURPLE} />
                <Text style={[styles.pnlBotBadgeText, { color: BRAND_PURPLE }]}>
                  PRO
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Quick action grid */}
      <Animated.View entering={FadeInDown.duration(400).delay(140)}>
        <Text style={[styles.sectionLbl, { color: colors.textMuted }]}>QUICK ACTIONS</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: "play", label: "Auto-Trade", accent: BRAND_PURPLE },
            { icon: "bar-chart-2", label: "Backtest", accent: BRAND_BLUE },
            { icon: "target", label: "Set Alert", accent: BRAND_PINK },
            { icon: "list", label: "Strategies", accent: ACCENT_GOLD },
          ].map((a) => (
            <Touchable
              key={a.label}
              style={[
                styles.actionCard,
                {
                  backgroundColor: "#11161E",
                  borderColor: "rgba(255,255,255,0.06)",
                },
              ]}
              scaleTo={0.96}
              highlightRadius={14}
              haptic="light"
            >
              <LinearGradient
                colors={[hexToRgba(a.accent, 0.32), hexToRgba(a.accent, 0.1)]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={[styles.actionIcon, { borderColor: hexToRgba(a.accent, 0.4) }]}
              >
                <Feather name={a.icon as keyof typeof Feather.glyphMap} size={15} color="#fff" />
              </LinearGradient>
              <Text style={[styles.actionLbl, { color: colors.foreground }]}>{a.label}</Text>
            </Touchable>
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontFamily: "Inter_500Medium" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  chips: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: { fontSize: 12.5, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  chipChange: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  botCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    overflow: "hidden",
  },
  botHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  botHeadLeft: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  botIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  botTitle: { fontSize: 12.5, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  livePillText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  pnlChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  pnlChipText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  todayText: { fontSize: 10.5, fontFamily: "Inter_500Medium" },

  divider: { height: 1, marginHorizontal: -12 },

  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceRowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceRowRight: { alignItems: "flex-end", gap: 2 },
  pairName: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  livePillSm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  livePillTextSm: { fontSize: 8.5, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  priceText: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  priceChangeRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  priceChange: { fontSize: 11, fontFamily: "Inter_700Bold" },

  signalRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  signalDot: { width: 6, height: 6, borderRadius: 3 },
  signalLbl: { fontSize: 10.5, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  signalText: { fontSize: 11.5, fontFamily: "Inter_500Medium", fontStyle: "italic", flex: 1 },
  calDot: { width: 4, height: 4, borderRadius: 2 },

  chartWrap: { position: "relative", alignItems: "center" },
  chartAnnotations: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  annoLeft: {
    position: "absolute",
    top: 30,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  annoText: { fontSize: 8, fontFamily: "Inter_700Bold" },
  annoRight: {
    position: "absolute",
    top: 90,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 4,
  },
  annoTextRight: { fontSize: 8.5, fontFamily: "Inter_700Bold" },

  tapeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tapeHeadLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  tapeDot: { width: 6, height: 6, borderRadius: 3 },
  tapeLbl: { fontSize: 10.5, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  tapePair: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tapeCount: { fontSize: 11, fontFamily: "Inter_700Bold" },

  tapeBody: { gap: 4 },
  tapeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tapeTime: { fontSize: 10.5, fontFamily: "Inter_500Medium", width: 62 },
  tapeSide: { fontSize: 10.5, fontFamily: "Inter_700Bold", width: 36 },
  tapeQty: { fontSize: 10.5, fontFamily: "Inter_500Medium", flex: 1 },
  tapePrice: { fontSize: 10.5, fontFamily: "Inter_700Bold", textAlign: "right" },

  pnlPanel: {
    marginHorizontal: -2,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    overflow: "hidden",
  },
  cornerGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 100,
    opacity: 0.18,
  },
  pnlHeroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  pnlHeroLeft: { flex: 1, gap: 6 },
  pnlLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  pnlLabelDot: { width: 5, height: 5, borderRadius: 2.5 },
  pnlLabel: {
    fontSize: 9.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  pnlAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 1 },
  pnlSign: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    lineHeight: 32,
    marginRight: 2,
  },
  pnlCurrency: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    lineHeight: 32,
    opacity: 0.85,
  },
  pnlAmount: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
    lineHeight: 32,
  },
  pnlPctChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  pnlPctText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  pnlPctSub: { fontSize: 10, fontFamily: "Inter_500Medium", marginLeft: 2 },
  pnlSparkWrap: { alignItems: "flex-end", gap: 4 },
  pnlSparkLbl: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },

  pnlStatStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "rgba(255,255,255,0.025)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  pnlStat: { flex: 1, alignItems: "flex-start", gap: 5, paddingHorizontal: 8 },
  pnlStatVDiv: { width: 1, marginVertical: 2 },
  pnlStatLbl: {
    fontSize: 8.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.9,
  },
  pnlStatValRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  pnlStatVal: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  pnlStatUnit: { fontSize: 9.5, fontFamily: "Inter_500Medium" },
  winBarTrack: {
    height: 3,
    width: "100%",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 2,
  },
  winBarFill: { height: 3, borderRadius: 2 },

  pnlBotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  pnlBotLeft: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  pnlBotText: { fontSize: 11.5, fontFamily: "Inter_700Bold" },
  pnlBotSep: { fontSize: 11.5 },
  pnlBotBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  pnlBotBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },

  sectionLbl: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.2, marginLeft: 4, marginBottom: 8 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionCard: {
    width: (SCREEN_W - 32 - 10) / 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  actionLbl: { fontSize: 12.5, fontFamily: "Inter_700Bold", letterSpacing: -0.1 },
});
