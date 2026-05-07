import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TransferDirection } from "@/context/PortfolioContext";
import { useColors } from "@/hooks/useColors";
import {
  useGetWallet,
  useGetInvestment,
  useTransferToTrading,
} from "@workspace/api-client-react";

const MIN_TRANSFER = 100;
const FX_RATE = 83.42;
const QUICK_PCT = [25, 50, 75, 100] as const;

export default function TransferScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const walletQ = useGetWallet();
  const investmentQ = useGetInvestment();
  const transferMut = useTransferToTrading();
  const wRaw = walletQ.data as any;
  const inv = investmentQ.data as any;
  const wallet = { balance: (Number(wRaw?.mainBalance) || 0) * FX_RATE };
  const portfolio = inv
    ? {
        currentNAV:
          ((Number(inv.amount) || 0) + (Number(inv.totalProfit) || 0)) * FX_RATE,
      }
    : null;
  const transfer = async (dir: TransferDirection, amountInr: number) => {
    await transferMut.mutateAsync({
      data: {
        amount: amountInr / FX_RATE,
        direction: dir === "main_to_trading" ? "to_trading" : "to_main",
      },
    });
    await Promise.all([walletQ.refetch(), investmentQ.refetch()]);
  };

  const [direction, setDirection] = useState<TransferDirection>("main_to_trading");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState<{
    direction: TransferDirection;
    amount: number;
  } | null>(null);

  // Cleanup any pending success-toast timer if the screen unmounts mid-flash.
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);
  const bottomPadding = insets.bottom + 32;

  const tradingNav = portfolio?.currentNAV ?? 0;
  const mainBalance = wallet.balance;

  const isMainToTrading = direction === "main_to_trading";
  const fromBalance = isMainToTrading ? mainBalance : tradingNav;
  const toBalance = isMainToTrading ? tradingNav : mainBalance;

  const numAmount = parseFloat(amount) || 0;
  const hasAmount = numAmount > 0;
  const exceedsBalance = numAmount > fromBalance;
  const belowMin = hasAmount && numAmount < MIN_TRANSFER;
  const noPortfolio = !portfolio;

  const inputError = exceedsBalance
    ? `Maximum ${formatInr(fromBalance)}`
    : belowMin
    ? `Minimum transfer is ₹${MIN_TRANSFER}`
    : null;

  const valid = hasAmount && !exceedsBalance && !belowMin && !noPortfolio;

  // Swap animation
  const swapRotate = useSharedValue(0);
  const fromCardOffset = useSharedValue(0);
  const toCardOffset = useSharedValue(0);
  const lastClickRef = useRef(0);

  const swapStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swapRotate.value}deg` }],
  }));

  const handleSwap = () => {
    const now = Date.now();
    if (now - lastClickRef.current < 350) return;
    lastClickRef.current = now;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swapRotate.value = withTiming(swapRotate.value + 180, {
      duration: 360,
      easing: Easing.inOut(Easing.cubic),
    });
    fromCardOffset.value = withSequence(
      withTiming(8, { duration: 120 }),
      withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }),
    );
    toCardOffset.value = withSequence(
      withTiming(-8, { duration: 120 }),
      withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }),
    );
    setDirection((d) => (d === "main_to_trading" ? "trading_to_main" : "main_to_trading"));
    setSubmitError(null);
  };

  const handleQuickPct = (pct: number) => {
    if (fromBalance <= 0) return;
    Haptics.selectionAsync();
    const v = (fromBalance * pct) / 100;
    setAmount(Math.floor(v).toString());
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await transfer(direction, numAmount);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessFlash({ direction, amount: numAmount });
      setAmount("");
      setSubmitting(false);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setSuccessFlash(null), 2400);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSubmitError(err instanceof Error ? err.message : "Transfer failed.");
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Internal Transfer</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Move funds between wallets</Text>
        </View>
        <View style={[styles.instantPill, { backgroundColor: "rgba(34,197,94,0.10)", borderColor: "rgba(34,197,94,0.35)" }]}>
          <Feather name="zap" size={10} color={colors.green} />
          <Text style={[styles.instantPillText, { color: colors.green }]}>INSTANT</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={topPadding}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* From / To wallet stack */}
          <Animated.View entering={FadeInDown.duration(360)}>
            <Animated.View style={{ transform: [{ translateY: fromCardOffset }] }}>
              <WalletCard
                role="FROM"
                kind={isMainToTrading ? "main" : "trading"}
                balance={fromBalance}
                colors={colors}
              />
            </Animated.View>

            {/* Swap button overlapping */}
            <View style={styles.swapWrap}>
              <Pressable
                onPress={handleSwap}
                accessibilityRole="button"
                accessibilityLabel="Swap transfer direction"
                hitSlop={10}
                style={({ pressed }) => [
                  styles.swapBtn,
                  {
                    backgroundColor: colors.card2,
                    borderColor: "rgba(255,255,255,0.10)",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <LinearGradient
                  colors={[colors.brandStart, colors.brandMid, colors.brandEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.swapBtnInner}
                >
                  <Animated.View style={swapStyle}>
                    <Feather name="repeat" size={18} color="#fff" />
                  </Animated.View>
                </LinearGradient>
              </Pressable>
            </View>

            <Animated.View style={{ transform: [{ translateY: toCardOffset }] }}>
              <WalletCard
                role="TO"
                kind={isMainToTrading ? "trading" : "main"}
                balance={toBalance}
                colors={colors}
              />
            </Animated.View>
          </Animated.View>

          {/* Amount section */}
          <Animated.View entering={FadeInDown.duration(380).delay(80)}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TRANSFER AMOUNT</Text>
            <View
              style={[
                styles.amountCard,
                {
                  backgroundColor: colors.card,
                  borderColor: inputError ? "rgba(239,68,68,0.38)" : colors.border,
                },
              ]}
            >
              <View style={styles.amountInputRow}>
                <Text style={[styles.amountPrefix, { color: colors.textMuted }]}>₹</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.foreground }]}
                  value={amount}
                  onChangeText={(t) => {
                    const cleaned = t.replace(/[^0-9.]/g, "");
                    const dotCount = (cleaned.match(/\./g) ?? []).length;
                    if (dotCount > 1) return;
                    setAmount(cleaned);
                    setSubmitError(null);
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  selectionColor={colors.purple}
                  underlineColorAndroid="transparent"
                  autoFocus={false}
                />
              </View>

              <View style={styles.quickRow}>
                {QUICK_PCT.map((pct) => (
                  <Pressable
                    key={pct}
                    onPress={() => handleQuickPct(pct)}
                    disabled={fromBalance <= 0}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${pct} percent`}
                    style={({ pressed }) => [
                      styles.quickPill,
                      {
                        backgroundColor: colors.card2,
                        borderColor: "rgba(255,255,255,0.06)",
                        opacity: fromBalance <= 0 ? 0.4 : pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.quickPillText, { color: colors.textSecondary }]}>
                      {pct === 100 ? "MAX" : `${pct}%`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {!!inputError && (
                <View style={styles.errRow}>
                  <Feather name="alert-circle" size={11} color={colors.red} />
                  <Text style={[styles.errText, { color: colors.red }]}>{inputError}</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Summary preview */}
          {hasAmount && !inputError && (
            <Animated.View entering={FadeInDown.duration(280)}>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.sumLabel, { color: colors.textMuted }]}>From</Text>
                  <Text style={[styles.sumValue, { color: colors.foreground }]}>
                    {isMainToTrading ? "Main Wallet" : "Trading Wallet"}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.sumLabel, { color: colors.textMuted }]}>To</Text>
                  <Text style={[styles.sumValue, { color: colors.foreground }]}>
                    {isMainToTrading ? "Trading Wallet" : "Main Wallet"}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={[styles.sumLabel, { color: colors.textMuted }]}>Transfer Fee</Text>
                  <Text style={[styles.sumValue, { color: colors.green }]}>FREE</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.sumLabel, { color: colors.textMuted }]}>Processing Time</Text>
                  <Text style={[styles.sumValue, { color: colors.foreground }]}>Instant</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={[styles.sumLabelBold, { color: colors.foreground }]}>You&apos;re moving</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.sumValueBig, { color: colors.foreground }]}>
                      {formatInr(numAmount)}
                    </Text>
                    <Text style={[styles.sumValueSub, { color: colors.textMuted }]}>
                      ≈ ${(numAmount / FX_RATE).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {/* No portfolio notice */}
          {noPortfolio && (
            <View style={[styles.notice, { backgroundColor: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.30)" }]}>
              <Feather name="alert-triangle" size={14} color={colors.orange} />
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                  You haven&apos;t deployed capital yet. Set up your trading wallet first to enable internal transfers.
                </Text>
                <Pressable
                  onPress={() => router.push("/risk-select")}
                  accessibilityRole="button"
                  accessibilityLabel="Deploy capital now"
                  hitSlop={8}
                  style={({ pressed }) => [styles.deployLink, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.deployLinkText, { color: colors.purple }]}>Deploy now →</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Direction-aware disclaimer */}
          {!noPortfolio && (
            <View style={[styles.notice, { backgroundColor: "rgba(59,130,246,0.06)", borderColor: "rgba(59,130,246,0.25)" }]}>
              <Feather name="info" size={14} color={colors.blue} />
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                {isMainToTrading
                  ? "Funds moved to Trading are deployed to your active bot and will participate in the next trade cycle."
                  : "Funds moved to Main are withdrawable immediately. Active positions are not closed — only idle NAV is moved."}
              </Text>
            </View>
          )}

          {!!submitError && (
            <View style={[styles.notice, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.32)" }]}>
              <Feather name="alert-triangle" size={14} color={colors.red} />
              <Text style={[styles.noticeText, { color: colors.red }]}>{submitError}</Text>
            </View>
          )}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={!valid || submitting}
            accessibilityRole="button"
            accessibilityLabel="Confirm transfer"
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: valid ? colors.purple : colors.secondary,
                opacity: pressed && valid ? 0.85 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.submitRow}>
                <Feather name="repeat" size={15} color={valid ? "#fff" : colors.textMuted} />
                <Text style={[styles.submitText, { color: valid ? "#fff" : colors.textMuted }]}>
                  {hasAmount && !exceedsBalance && !belowMin
                    ? `Transfer ${formatInr(numAmount)} ${isMainToTrading ? "→ Trading" : "→ Main"}`
                    : exceedsBalance
                    ? "Insufficient Balance"
                    : belowMin
                    ? `Minimum ₹${MIN_TRANSFER}`
                    : "Enter Amount"}
                </Text>
              </View>
            )}
          </Pressable>

          <Text style={[styles.footer, { color: colors.textMuted }]}>
            Internal transfers are settled instantly with zero fees
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success toast */}
      {successFlash && (
        <Animated.View
          entering={FadeInDown.duration(280)}
          style={[
            styles.toast,
            {
              bottom: insets.bottom + 24,
              backgroundColor: colors.card,
              borderColor: "rgba(34,197,94,0.45)",
            },
          ]}
        >
          <View style={[styles.toastIcon, { backgroundColor: "rgba(34,197,94,0.16)" }]}>
            <Feather name="check" size={16} color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toastTitle, { color: colors.foreground }]}>Transfer complete</Text>
            <Text style={[styles.toastSub, { color: colors.textMuted }]}>
              {formatInr(successFlash.amount)}{" "}
              {successFlash.direction === "main_to_trading" ? "moved to Trading" : "moved to Main"}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function WalletCard({
  role,
  kind,
  balance,
  colors,
}: {
  role: "FROM" | "TO";
  kind: "main" | "trading";
  balance: number;
  colors: ReturnType<typeof useColors>;
}) {
  const isMain = kind === "main";
  const meta = isMain
    ? {
        title: "Main Wallet",
        subtitle: "Withdrawable balance",
        icon: "credit-card" as const,
        gradFrom: "rgba(168,85,247,0.20)",
        gradTo: "rgba(168,85,247,0.02)",
        ring: "rgba(168,85,247,0.55)",
        accent: colors.purple,
      }
    : {
        title: "Trading Wallet",
        subtitle: "Deployed capital · Live NAV",
        icon: "trending-up" as const,
        gradFrom: "rgba(59,130,246,0.20)",
        gradTo: "rgba(59,130,246,0.02)",
        ring: "rgba(59,130,246,0.55)",
        accent: colors.blue,
      };

  const isFrom = role === "FROM";

  return (
    <View
      style={[
        styles.walletCard,
        {
          backgroundColor: colors.card,
          borderColor: isFrom ? meta.ring : colors.border,
          shadowColor: meta.accent,
        },
      ]}
    >
      <LinearGradient
        colors={[meta.gradFrom, meta.gradTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.walletRow}>
        <LinearGradient
          colors={[meta.ring, "rgba(0,0,0,0)"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.walletIcon, { borderColor: meta.accent }]}
        >
          <Feather name={meta.icon} size={18} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <View style={styles.walletTitleRow}>
            <Text style={[styles.roleBadge, { color: meta.accent, borderColor: `${meta.accent}66` }]}>
              {role}
            </Text>
            <Text style={[styles.walletTitle, { color: colors.foreground }]}>{meta.title}</Text>
          </View>
          <Text style={[styles.walletSub, { color: colors.textMuted }]}>{meta.subtitle}</Text>
        </View>
      </View>
      <View style={styles.walletBalRow}>
        <Text style={[styles.walletBal, { color: colors.foreground }]}>{formatInr(balance)}</Text>
        <Text style={[styles.walletBalUsd, { color: colors.textMuted }]}>
          ≈ ${(balance / FX_RATE).toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

function formatInr(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  headerSubtitle: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  instantPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  instantPillText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },

  walletCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  walletRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  walletTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  roleBadge: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden",
  },
  walletTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  walletSub: { fontSize: 11, fontFamily: "Inter_500Medium" },
  walletBalRow: { marginTop: 12, flexDirection: "row", alignItems: "baseline", gap: 8 },
  walletBal: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  walletBalUsd: { fontSize: 11, fontFamily: "Inter_500Medium" },

  swapWrap: {
    alignItems: "center",
    marginVertical: -14,
    zIndex: 10,
  },
  swapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  swapBtnInner: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
    marginTop: 14,
    marginBottom: 8,
  },
  amountCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  amountInputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  amountPrefix: { fontSize: 26, fontFamily: "Inter_500Medium" },
  amountInput: {
    flex: 1,
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    padding: 0,
    letterSpacing: -0.5,
    borderWidth: 0,
    ...(Platform.OS === "web"
      ? ({ outlineStyle: "none", outlineWidth: 0, boxShadow: "none" } as object)
      : null),
  },
  quickRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  quickPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  quickPillText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  errRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
  errText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  summaryCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sumLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sumLabelBold: { fontSize: 13, fontFamily: "Inter_700Bold" },
  sumValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sumValueBig: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sumValueSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  divider: { height: 1, backgroundColor: "rgba(148,163,184,0.10)", marginVertical: 2 },

  notice: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  noticeText: { flex: 1, fontSize: 11.5, fontFamily: "Inter_500Medium", lineHeight: 16 },
  deployLink: { alignSelf: "flex-start" },
  deployLinkText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  submitBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  footer: { fontSize: 10.5, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 4 },

  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  toastIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  toastTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  toastSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
});
