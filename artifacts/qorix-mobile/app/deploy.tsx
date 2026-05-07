import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  useGetWallet,
  useStartInvestment,
} from "@workspace/api-client-react";
import { FX_RATE } from "@/lib/tx-mapper";

const BRAND_PURPLE = "#A855F7";
const BRAND_PINK = "#EC4899";
const BRAND_BLUE = "#60A5FA";

function hexToRgba(hex: string, alpha: number) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const RISK_META = {
  conservative: { color: BRAND_BLUE, label: "Conservative" },
  moderate:     { color: BRAND_PURPLE, label: "Moderate" },
  aggressive:   { color: BRAND_PINK, label: "Aggressive" },
} as const;

export default function DeployScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const walletQ = useGetWallet();
  const startMut = useStartInvestment();
  const wRaw = walletQ.data as any;
  const wallet = { balance: (Number(wRaw?.mainBalance) || 0) * FX_RATE };
  const deployCapital = async (amountInr: number, tier: string) => {
    await startMut.mutateAsync({
      data: { amount: amountInr / FX_RATE, riskLevel: tier },
    });
    await walletQ.refetch();
  };

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const numAmount = parseFloat(amount.replace(/,/g, "")) || 0;
  const isValid = numAmount >= 5000 && numAmount <= wallet.balance && !!user?.riskTier;
  const overBalance = numAmount > wallet.balance;

  const riskTier = (user?.riskTier ?? "moderate") as keyof typeof RISK_META;
  const riskMeta = RISK_META[riskTier];
  const botMap = { conservative: "ScalpBot v1.3", moderate: "MomentumBot v2.1", aggressive: "ArbitrageBot v3.0" };
  const returnMap = { conservative: "5–8%/mo", moderate: "10–15%/mo", aggressive: "18–25%/mo" };
  const lowMap = { conservative: 0.05, moderate: 0.10, aggressive: 0.18 };
  const highMap = { conservative: 0.08, moderate: 0.15, aggressive: 0.25 };
  // Historical max drawdown per tier — tight stop-loss, capped at 1.3%
  const drawdownHighMap = { conservative: 0.005, moderate: 0.0119, aggressive: 0.013 };
  const drawdownLabelMap = { conservative: "0.5%", moderate: "1.19%", aggressive: "1.3%" };
  const botName = botMap[riskTier];
  const expectedReturn = returnMap[riskTier];
  const minMonthlyReturn = numAmount * lowMap[riskTier];
  const maxMonthlyReturn = numAmount * highMap[riskTier];
  const maxDrawdown = numAmount * drawdownHighMap[riskTier];
  const drawdownLabel = drawdownLabelMap[riskTier];

  const [deployError, setDeployError] = useState<string | null>(null);
  const handleDeploy = async () => {
    if (!isValid) return;
    setDeployError(null);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await deployCapital(numAmount, riskTier);
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const e = err as { message?: string };
      setDeployError(e?.message ?? "Could not deploy capital. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // Stable transaction id generated once on success
  const txnId = React.useMemo(
    () => "TXN" + Math.random().toString(36).slice(2, 10).toUpperCase(),
    [success],
  );
  const deployedAt = React.useMemo(() => new Date(), [success]);
  const deployedTimeStr = deployedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const deployedDateStr = deployedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  if (success) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[styles.successScroll, { paddingTop: topPadding, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero success block */}
          <Animated.View entering={FadeInDown.duration(500)} style={styles.successHero}>
            <View style={styles.successIconWrap}>
              <View pointerEvents="none" style={[styles.successHalo, { backgroundColor: colors.green, shadowColor: colors.green }]} />
              <LinearGradient
                colors={[hexToRgba("#10D070", 0.55), hexToRgba("#10D070", 0.15)]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={[styles.successIconShell, { borderColor: hexToRgba("#10D070", 0.6) }]}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.32)", "rgba(255,255,255,0)"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.7 }}
                  style={styles.successIconHighlight}
                  pointerEvents="none"
                />
                <Feather name="check" size={44} color="#fff" />
              </LinearGradient>
            </View>
            <View style={[styles.successPill, { backgroundColor: hexToRgba("#10D070", 0.14), borderColor: hexToRgba("#10D070", 0.4) }]}>
              <View style={[styles.liveDot, { backgroundColor: colors.green }]} />
              <Text style={[styles.successPillText, { color: colors.green }]}>BOT NOW LIVE</Text>
            </View>
            <Text style={[styles.successTitle, { color: colors.foreground }]}>Capital Deployed</Text>
            <Text style={[styles.successAmount, { color: colors.foreground }]}>
              ₹{numAmount.toLocaleString("en-IN")}
            </Text>
            <Text style={[styles.successSub, { color: colors.textSecondary }]}>
              Funds are placed with {botName} and will start trading on the next market tick.
            </Text>
          </Animated.View>

          {/* Receipt card */}
          <Animated.View entering={FadeInDown.duration(500).delay(120)}>
            <LinearGradient
              colors={[hexToRgba(BRAND_PURPLE, 0.16), "rgba(17,22,30,0.95)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.receiptCard, { borderColor: hexToRgba(BRAND_PURPLE, 0.3) }]}
            >
              <Text style={[styles.receiptHeader, { color: colors.textMuted }]}>DEPLOYMENT RECEIPT</Text>

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Transaction ID</Text>
                <Text style={[styles.receiptValueMono, { color: colors.foreground }]}>{txnId}</Text>
              </View>
              <View style={[styles.receiptDivider, { backgroundColor: "rgba(255,255,255,0.06)" }]} />

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Strategy</Text>
                <View style={styles.receiptBotRow}>
                  <View style={[styles.receiptBotIcon, { backgroundColor: hexToRgba(riskMeta.color, 0.2), borderColor: hexToRgba(riskMeta.color, 0.5) }]}>
                    <Feather name="cpu" size={10} color={riskMeta.color} />
                  </View>
                  <Text style={[styles.receiptValue, { color: colors.foreground }]}>{botName}</Text>
                </View>
              </View>
              <View style={[styles.receiptDivider, { backgroundColor: "rgba(255,255,255,0.06)" }]} />

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Risk profile</Text>
                <View style={[styles.receiptTierChip, { backgroundColor: hexToRgba(riskMeta.color, 0.14), borderColor: hexToRgba(riskMeta.color, 0.4) }]}>
                  <View style={[styles.riskDot, { backgroundColor: riskMeta.color }]} />
                  <Text style={[styles.receiptTierText, { color: riskMeta.color }]}>{riskMeta.label}</Text>
                </View>
              </View>
              <View style={[styles.receiptDivider, { backgroundColor: "rgba(255,255,255,0.06)" }]} />

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Expected / mo</Text>
                <Text style={[styles.receiptValue, { color: colors.green }]}>
                  +₹{maxMonthlyReturn.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ({expectedReturn})
                </Text>
              </View>
              <View style={[styles.receiptDivider, { backgroundColor: "rgba(255,255,255,0.06)" }]} />

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Stop-loss</Text>
                <Text style={[styles.receiptValue, { color: colors.red }]}>
                  −₹{maxDrawdown.toLocaleString("en-IN", { maximumFractionDigits: 0 })} (−{drawdownLabel} cap)
                </Text>
              </View>
              <View style={[styles.receiptDivider, { backgroundColor: "rgba(255,255,255,0.06)" }]} />

              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Deployed at</Text>
                <Text style={[styles.receiptValue, { color: colors.foreground }]}>
                  {deployedTimeStr} · {deployedDateStr}
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Next-step timeline */}
          <Animated.View entering={FadeInDown.duration(500).delay(200)}>
            <View style={[styles.timelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.timelineHeader, { color: colors.foreground }]}>What happens next</Text>

              <View style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: colors.green, borderColor: hexToRgba("#10D070", 0.4) }]}>
                  <Feather name="check" size={9} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.timelineTitle, { color: colors.foreground }]}>Funds settled in trading pool</Text>
                  <Text style={[styles.timelineSub, { color: colors.textMuted }]}>Just now</Text>
                </View>
              </View>
              <View style={[styles.timelineLine, { backgroundColor: "rgba(255,255,255,0.08)" }]} />

              <View style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: hexToRgba(BRAND_PURPLE, 0.25), borderColor: hexToRgba(BRAND_PURPLE, 0.6) }]}>
                  <Feather name="zap" size={9} color={BRAND_PURPLE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.timelineTitle, { color: colors.foreground }]}>Bot picks first signal</Text>
                  <Text style={[styles.timelineSub, { color: colors.textMuted }]}>Within 2–5 minutes</Text>
                </View>
              </View>
              <View style={[styles.timelineLine, { backgroundColor: "rgba(255,255,255,0.08)" }]} />

              <View style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.12)" }]}>
                  <Feather name="trending-up" size={9} color={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.timelineTitle, { color: colors.foreground }]}>First payout settled</Text>
                  <Text style={[styles.timelineSub, { color: colors.textMuted }]}>Daily at 6:00 PM IST</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* CTAs */}
          <Animated.View entering={FadeInDown.duration(500).delay(280)} style={{ gap: 10, marginTop: 4 }}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.replace("/(tabs)/trades");
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
              <LinearGradient
                colors={[BRAND_PURPLE, BRAND_PINK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.deployBtn, { shadowColor: BRAND_PURPLE }]}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.20)", "rgba(255,255,255,0)"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.deployHighlight}
                  pointerEvents="none"
                />
                <View style={styles.deployBtnInner}>
                  <Feather name="activity" size={16} color="#fff" />
                  <Text style={[styles.deployBtnText, { color: "#fff" }]}>Track live trades</Text>
                </View>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.replace("/(tabs)");
              }}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="home" size={15} color={colors.foreground} />
              <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Back to dashboard</Text>
            </Pressable>

            <View style={styles.secureRow}>
              <Feather name="shield" size={11} color={colors.textMuted} />
              <Text style={[styles.secureText, { color: colors.textMuted }]}>
                Receipt mailed to your registered email
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <View style={styles.titleRow}>
              <LinearGradient
                colors={[BRAND_PURPLE, BRAND_PINK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.titleIcon}
              >
                <Feather name="zap" size={14} color="#fff" />
              </LinearGradient>
              <Text style={[styles.title, { color: colors.foreground }]}>Deploy Capital</Text>
            </View>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              Funds get assigned to your bot and start trading instantly
            </Text>
          </View>
        </Animated.View>

        {/* Wallet balance — premium gradient card */}
        <Animated.View entering={FadeInDown.duration(400).delay(60)}>
          <LinearGradient
            colors={[hexToRgba(BRAND_PURPLE, 0.22), hexToRgba(BRAND_PINK, 0.12), "rgba(17,22,30,0.95)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.balanceCard, { borderColor: hexToRgba(BRAND_PURPLE, 0.4), shadowColor: BRAND_PURPLE }]}
          >
            {/* Glossy highlight */}
            <LinearGradient
              colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.balanceHighlight}
              pointerEvents="none"
            />
            {/* Corner glow */}
            <View pointerEvents="none" style={[styles.balanceGlow, { backgroundColor: BRAND_PINK }]} />

            <View style={styles.balanceRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.balLabel, { color: hexToRgba(BRAND_PURPLE, 0.95) }]}>
                  AVAILABLE TO DEPLOY
                </Text>
                <Text style={[styles.balValue, { color: colors.foreground }]}>
                  ₹{wallet.balance.toLocaleString("en-IN")}
                </Text>
                <Text style={[styles.balSub, { color: colors.textMuted }]}>
                  Wallet · Instantly available
                </Text>
              </View>
              <View
                style={[
                  styles.riskPill,
                  {
                    backgroundColor: hexToRgba(riskMeta.color, 0.15),
                    borderColor: hexToRgba(riskMeta.color, 0.45),
                  },
                ]}
              >
                <View style={[styles.riskDot, { backgroundColor: riskMeta.color }]} />
                <Text style={[styles.riskPillText, { color: riskMeta.color }]}>{riskMeta.label}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* No risk tier */}
        {!user?.riskTier && (
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <Pressable
              onPress={() => router.push("/risk-select")}
              style={[styles.riskAlert, { backgroundColor: "rgba(231,76,60,0.08)", borderColor: "rgba(231,76,60,0.3)" }]}
            >
              <Feather name="alert-triangle" size={14} color={colors.red} />
              <Text style={[styles.riskAlertText, { color: colors.red }]}>
                Select a risk profile first
              </Text>
              <Feather name="chevron-right" size={14} color={colors.red} />
            </Pressable>
          </Animated.View>
        )}

        {/* Amount input */}
        <Animated.View entering={FadeInDown.duration(400).delay(120)} style={{ gap: 8 }}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Amount to Deploy</Text>
            <Pressable
              onPress={() => setAmount(String(wallet.balance))}
              style={({ pressed }) => [
                styles.maxBtn,
                {
                  backgroundColor: hexToRgba(BRAND_PURPLE, 0.14),
                  borderColor: hexToRgba(BRAND_PURPLE, 0.4),
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.maxBtnText, { color: BRAND_PURPLE }]}>MAX</Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.amountWrap,
              {
                backgroundColor: colors.input,
                borderColor: overBalance
                  ? colors.red
                  : numAmount >= 5000
                  ? hexToRgba(BRAND_PURPLE, 0.5)
                  : colors.border,
              },
            ]}
          >
            <Text style={[styles.rupee, { color: numAmount > 0 ? BRAND_PURPLE : colors.textMuted }]}>₹</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.foreground }]}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
            />
            {numAmount > 0 && (
              <Pressable onPress={() => setAmount("")} hitSlop={8}>
                <Feather name="x-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          <View style={styles.minRow}>
            <Feather name="info" size={11} color={overBalance ? colors.red : colors.textMuted} />
            <Text style={[styles.minNote, { color: overBalance ? colors.red : colors.textMuted }]}>
              {overBalance
                ? "Amount exceeds wallet balance"
                : "Minimum ₹5,000 · No lock-in period"}
            </Text>
          </View>
        </Animated.View>

        {/* Quick amount chips */}
        <Animated.View entering={FadeInDown.duration(400).delay(160)} style={styles.quickAmounts}>
          {[10000, 25000, 50000, 100000].map((amt) => {
            const selected = numAmount === amt;
            return (
              <Pressable
                key={amt}
                onPress={() => {
                  Haptics.selectionAsync();
                  setAmount(amt.toString());
                }}
                style={({ pressed }) => [
                  styles.quickBtn,
                  {
                    backgroundColor: selected ? hexToRgba(BRAND_PURPLE, 0.18) : colors.card,
                    borderColor: selected ? hexToRgba(BRAND_PURPLE, 0.55) : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.quickText,
                    { color: selected ? BRAND_PURPLE : colors.textSecondary },
                  ]}
                >
                  ₹{(amt / 1000).toFixed(0)}K
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Bot Info card */}
        {user?.riskTier && (
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <LinearGradient
              colors={[hexToRgba(riskMeta.color, 0.14), "rgba(17,22,30,0.95)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.botCard, { borderColor: hexToRgba(riskMeta.color, 0.35) }]}
            >
              <View style={styles.botIconWrap}>
                <View
                  pointerEvents="none"
                  style={[
                    styles.botIconHalo,
                    { backgroundColor: riskMeta.color, shadowColor: riskMeta.color },
                  ]}
                />
                <LinearGradient
                  colors={[hexToRgba(riskMeta.color, 0.7), hexToRgba(riskMeta.color, 0.18)]}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={[styles.botIcon, { borderColor: hexToRgba(riskMeta.color, 0.55) }]}
                >
                  <Feather name="cpu" size={16} color="#fff" />
                </LinearGradient>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.botNameRow}>
                  <Text style={[styles.botName, { color: colors.foreground }]} numberOfLines={1}>
                    {botName}
                  </Text>
                  <View style={[styles.liveChip, { backgroundColor: "rgba(16,208,112,0.15)", borderColor: "rgba(16,208,112,0.35)" }]}>
                    <View style={[styles.liveDot, { backgroundColor: colors.green }]} />
                    <Text style={[styles.liveText, { color: colors.green }]}>LIVE</Text>
                  </View>
                </View>
                <Text style={[styles.botSub, { color: colors.textMuted }]} numberOfLines={1}>
                  NSE/BSE + Crypto · Auto-managed · {expectedReturn}
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Projection — Profit vs Max Drawdown */}
        {numAmount >= 5000 && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={[styles.projCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.projHeader}>
                <Feather name="bar-chart-2" size={13} color={colors.foreground} />
                <Text style={[styles.projTitle, { color: colors.foreground }]}>Risk vs reward · monthly</Text>
                <View style={[styles.tierChip, { backgroundColor: hexToRgba(riskMeta.color, 0.14), borderColor: hexToRgba(riskMeta.color, 0.4) }]}>
                  <Text style={[styles.tierChipText, { color: riskMeta.color }]}>{riskMeta.label}</Text>
                </View>
              </View>

              <View style={styles.projRow}>
                {/* Profit cell */}
                <View
                  style={[
                    styles.projCell,
                    { backgroundColor: hexToRgba("#10D070", 0.10), borderColor: "rgba(16,208,112,0.32)" },
                  ]}
                >
                  <View style={styles.projCellTop}>
                    <Feather name="trending-up" size={11} color={colors.green} />
                    <Text style={[styles.projLabel, { color: colors.green }]}>Profit potential</Text>
                  </View>
                  <Text style={[styles.projValue, { color: colors.green }]} numberOfLines={1}>
                    +₹{maxMonthlyReturn.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[styles.projPct, { color: colors.green }]}>{expectedReturn}</Text>
                </View>

                {/* Drawdown cell */}
                <View
                  style={[
                    styles.projCell,
                    { backgroundColor: hexToRgba("#EF4444", 0.10), borderColor: "rgba(239,68,68,0.32)" },
                  ]}
                >
                  <View style={styles.projCellTop}>
                    <Feather name="trending-down" size={11} color={colors.red} />
                    <Text style={[styles.projLabel, { color: colors.red }]}>Max drawdown</Text>
                  </View>
                  <Text style={[styles.projValue, { color: colors.red }]} numberOfLines={1}>
                    −₹{maxDrawdown.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={[styles.projPct, { color: colors.red }]}>capped at −{drawdownLabel}</Text>
                </View>
              </View>

              {/* Range bar visualization */}
              <View style={styles.rangeWrap}>
                <View style={[styles.rangeTrack, { backgroundColor: hexToRgba(colors.foreground, 0.06) }]}>
                  <View style={styles.rangeLossSegment}>
                    <LinearGradient
                      colors={[hexToRgba("#EF4444", 0.6), hexToRgba("#EF4444", 0.25)]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.rangeFill}
                    />
                  </View>
                  <View style={[styles.rangeMidLine, { backgroundColor: hexToRgba(colors.foreground, 0.3) }]} />
                  <View style={styles.rangeProfitSegment}>
                    <LinearGradient
                      colors={[hexToRgba("#10D070", 0.25), hexToRgba("#10D070", 0.6)]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.rangeFill}
                    />
                  </View>
                </View>
                <View style={styles.rangeLabels}>
                  <Text style={[styles.rangeLabel, { color: colors.red }]}>−{drawdownLabel}</Text>
                  <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>0%</Text>
                  <Text style={[styles.rangeLabel, { color: colors.green }]}>+{expectedReturn.replace("/mo", "")}</Text>
                </View>
              </View>

              <View style={styles.projFootRow}>
                <Feather name="shield" size={11} color={colors.textMuted} />
                <Text style={[styles.projNote, { color: colors.textMuted }]}>
                  Hard stop-loss at −{drawdownLabel} · auto-exit if breached · 70–80% client share
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {deployError && (
          <View style={{ marginTop: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.08)", flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <Text style={{ flex: 1, fontSize: 12.5, color: "#EF4444", fontFamily: "Inter_500Medium" }}>{deployError}</Text>
            <Pressable onPress={() => setDeployError(null)} hitSlop={8}>
              <Feather name="x" size={16} color="#EF4444" />
            </Pressable>
          </View>
        )}

        {/* Deploy CTA */}
        <Animated.View entering={FadeInDown.duration(400).delay(240)} style={{ marginTop: 4 }}>
          <Pressable
            onPress={handleDeploy}
            disabled={!isValid || loading}
            style={({ pressed }) => [{ opacity: pressed && isValid ? 0.9 : 1 }]}
          >
            {isValid ? (
              <LinearGradient
                colors={[BRAND_PURPLE, BRAND_PINK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.deployBtn, { shadowColor: BRAND_PURPLE }]}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.20)", "rgba(255,255,255,0)"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.deployHighlight}
                  pointerEvents="none"
                />
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.deployBtnInner}>
                    <Feather name="zap" size={16} color="#fff" />
                    <Text style={[styles.deployBtnText, { color: "#fff" }]}>
                      Deploy ₹{numAmount.toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            ) : (
              <View style={[styles.deployBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0 }]}>
                <View style={styles.deployBtnInner}>
                  <Feather name="zap" size={16} color={colors.textMuted} />
                  <Text style={[styles.deployBtnText, { color: colors.textMuted }]}>
                    {numAmount === 0
                      ? "Enter amount to deploy"
                      : numAmount < 5000
                      ? "Minimum ₹5,000"
                      : overBalance
                      ? "Insufficient balance"
                      : "Deploy"}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>

          <View style={styles.secureRow}>
            <Feather name="lock" size={11} color={colors.textMuted} />
            <Text style={[styles.secureText, { color: colors.textMuted }]}>
              Funds secured · SEBI-registered partner brokers
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 16 },

  // Header
  header: { gap: 14 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  headerTitleWrap: { gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleIcon: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.6 },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  // Balance card
  balanceCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    overflow: "hidden",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  balanceHighlight: {
    position: "absolute", top: 0, left: 0, right: 0, height: 60,
  },
  balanceGlow: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    top: -90, right: -70, opacity: 0.10,
  },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  balLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.5, marginBottom: 6 },
  balValue: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.8 },
  balSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },
  riskPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  riskDot: { width: 6, height: 6, borderRadius: 3 },
  riskPillText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },

  // Risk alert
  riskAlert: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  riskAlertText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },

  // Amount input
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  maxBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
  },
  maxBtnText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  amountWrap: {
    flexDirection: "row", alignItems: "center", borderRadius: 14,
    borderWidth: 1, paddingHorizontal: 16, height: 68, gap: 10,
  },
  rupee: { fontSize: 26, fontFamily: "Inter_700Bold" },
  amountInput: { flex: 1, fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.8 },
  minRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  minNote: { fontSize: 11, fontFamily: "Inter_500Medium" },

  // Quick chips
  quickAmounts: { flexDirection: "row", gap: 8 },
  quickBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, alignItems: "center",
  },
  quickText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  // Bot info card
  botCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 14, borderWidth: 1,
  },
  botIconWrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  botIconHalo: {
    position: "absolute", width: 40, height: 40, borderRadius: 12,
    opacity: 0.20, shadowOpacity: 0.85, shadowRadius: 12, shadowOffset: { width: 0, height: 2 },
  },
  botIcon: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  botNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  botName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  botSub: { fontSize: 11.5, fontFamily: "Inter_500Medium", marginTop: 2 },
  liveChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1,
  },
  liveDot: { width: 4, height: 4, borderRadius: 2 },
  liveText: { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },

  // Projection
  projCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  projHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  projTitle: { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: -0.1 },
  tierChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  tierChipText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  projRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  projCell: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "flex-start", gap: 4 },
  projCellTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  projLabel: { fontSize: 10.5, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  projValue: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  projPct: { fontSize: 10.5, fontFamily: "Inter_600SemiBold", opacity: 0.85 },
  rangeWrap: { gap: 5 },
  rangeTrack: {
    flexDirection: "row",
    alignItems: "center",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  rangeLossSegment: { flex: 1, height: "100%" },
  rangeProfitSegment: { flex: 2, height: "100%" },
  rangeFill: { flex: 1, height: "100%" },
  rangeMidLine: { width: 2, height: 12, borderRadius: 1 },
  rangeLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 },
  rangeLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  projFootRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  projNote: { flex: 1, fontSize: 10.5, fontFamily: "Inter_500Medium" },

  // Deploy CTA
  deployBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  deployHighlight: {
    position: "absolute", top: 0, left: 0, right: 0, height: 28,
  },
  deployBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  deployBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 10 },
  secureText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  // Success page
  successScroll: { paddingHorizontal: 16, gap: 16 },
  successHero: { alignItems: "center", gap: 10, paddingVertical: 16 },
  successIconWrap: {
    width: 96, height: 96, alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  successHalo: {
    position: "absolute", width: 96, height: 96, borderRadius: 28,
    opacity: 0.22,
    shadowOpacity: 0.85, shadowRadius: 24, shadowOffset: { width: 0, height: 4 },
  },
  successIconShell: {
    width: 88, height: 88, borderRadius: 26, borderWidth: 1,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  successIconHighlight: {
    position: "absolute", top: 1, left: 1, right: 1, height: 40, borderRadius: 26,
  },
  successPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  successPillText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginTop: 4 },
  successAmount: { fontSize: 36, fontFamily: "Inter_700Bold", letterSpacing: -1.2 },
  successSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19, paddingHorizontal: 16 },

  // Receipt
  receiptCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 0, overflow: "hidden" },
  receiptHeader: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.5, marginBottom: 6 },
  receiptRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 9, gap: 10,
  },
  receiptLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  receiptValue: { fontSize: 12.5, fontFamily: "Inter_700Bold", letterSpacing: -0.1 },
  receiptValueMono: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  receiptDivider: { height: 1 },
  receiptBotRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  receiptBotIcon: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  receiptTierChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  receiptTierText: { fontSize: 10.5, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },

  // Timeline
  timelineCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  timelineHeader: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: -0.1, marginBottom: 4 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timelineDot: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  timelineTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  timelineSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  timelineLine: { width: 1, height: 14, marginLeft: 11 },

  // Secondary CTA
  secondaryBtn: {
    height: 48, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
  },
  secondaryBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
