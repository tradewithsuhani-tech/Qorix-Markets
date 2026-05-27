import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { CRYPTO_METHODS, FX_RATE } from "@/constants/cryptoMethods";
import { useColors } from "@/hooks/useColors";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useGetWallet } from "@workspace/api-client-react";

const INR_METHODS = [
  { id: "bank", icon: "credit-card" as const, label: "Bank Transfer", sub: "NEFT / IMPS · within 24 hours" },
  { id: "upi", icon: "zap" as const, label: "UPI Transfer", sub: "Instant · directly to your UPI ID" },
];

const COMPLIANCE_RULES = [
  "Minimum withdrawal: ₹500 (or $10 crypto equivalent)",
  "Daily limit: ₹2,00,000 · admin approval above ₹50,000",
  "Withdrawals processed within 24 hours · crypto on-chain",
  "Wallet holdings are unaffected by deployed capital",
];

export default function WithdrawScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { flags } = useFeatureFlags();
  const walletQ = useGetWallet();
  const wRaw = walletQ.data as any;
  const wallet = {
    balance: (Number(wRaw?.mainBalance) || 0) * FX_RATE,
  };

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"INR" | "USDT">("INR");
  const [showAmtError, setShowAmtError] = useState(false);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!flags.inr_withdraw && currency === "INR") setCurrency("USDT");
  }, [flags.inr_withdraw, currency]);

  const isCrypto = currency === "USDT";
  const methodList = isCrypto ? CRYPTO_METHODS : INR_METHODS;
  const numAmount = parseFloat(amount.replace(/,/g, "")) || 0;
  const minAmount = currency === "INR" ? 500 : 10;
  const balanceInr = wallet.balance;
  const balanceUsd = balanceInr / FX_RATE;
  const maxAmount = currency === "INR" ? balanceInr : balanceUsd;
  const amountInr = currency === "INR" ? numAmount : numAmount * FX_RATE;
  const hasAmount = numAmount >= minAmount;
  const exceedsBalance = numAmount > maxAmount;
  const valid = hasAmount && !exceedsBalance;
  const symbol = currency === "INR" ? "₹" : "$";
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  const switchCurrency = (next: "INR" | "USDT") => {
    if (next === currency) return;
    Haptics.selectionAsync();
    if (numAmount > 0) {
      const converted = next === "USDT" ? numAmount / FX_RATE : numAmount * FX_RATE;
      setAmount(Math.round(converted).toString());
    }
    setShowAmtError(false);
    setCurrency(next);
  };

  const setQuickPercent = (pct: number) => {
    Haptics.selectionAsync();
    const val = Math.floor(maxAmount * pct);
    setAmount(val.toString());
    setShowAmtError(false);
  };

  const handleCryptoSelect = (id: string) => {
    if (!valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowAmtError(true);
      amountRef.current?.focus();
      return;
    }
    Haptics.selectionAsync();
    router.push({
      pathname: "/withdraw-crypto",
      params: { id, amount: numAmount.toString() },
    });
  };

  const handleInrSelect = (id: string) => {
    if (!valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowAmtError(true);
      amountRef.current?.focus();
      return;
    }
    Haptics.selectionAsync();
    router.push({
      pathname: id === "upi" ? "/withdraw-upi" : "/withdraw-bank",
      params: { amount: numAmount.toString() },
    });
  };

  useEffect(() => {
    if (Platform.OS === "web") return;
    const t = setTimeout(() => {
      amountRef.current?.focus();
    }, 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Withdraw Funds</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {isCrypto
              ? "Crypto withdrawals are broadcast on-chain after compliance review."
              : "INR payouts to your bank or UPI within 24 hours of approval."}
          </Text>
        </View>

        {/* Available balance */}
        <Card padding={14}>
          <View style={styles.balRow}>
            <Text style={[styles.balLabel, { color: colors.textSecondary }]}>Available Balance</Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.balValue, { color: colors.green }]}>
                ₹{balanceInr.toLocaleString("en-IN")}
              </Text>
              <Text style={[styles.balSub, { color: colors.textMuted }]}>
                ≈ ${balanceUsd.toFixed(2)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Compliance rules */}
        <View style={[styles.rules, { backgroundColor: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.25)" }]}>
          <View style={styles.rulesHeader}>
            <Feather name="info" size={13} color={colors.orange} />
            <Text style={[styles.rulesTitle, { color: colors.orange }]}>COMPLIANCE RULES</Text>
          </View>
          {COMPLIANCE_RULES.map((r) => (
            <View key={r} style={styles.ruleRow}>
              <View style={[styles.ruleDot, { backgroundColor: colors.orange }]} />
              <Text style={[styles.ruleText, { color: colors.textSecondary }]}>{r}</Text>
            </View>
          ))}
        </View>

        {/* Amount */}
        <View>
          <View style={styles.amountLabelRow}>
            <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>Withdrawal Amount</Text>
            {/* Currency switcher — INR hidden when inr_withdraw flag is off */}
            {flags.inr_withdraw && (
              <View style={[styles.currencySwitcher, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {(["INR", "USDT"] as const).map((c) => {
                  const active = currency === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => switchCurrency(c)}
                      accessibilityRole="button"
                      accessibilityLabel={`Switch to ${c}`}
                      style={[
                        styles.currencyOpt,
                        active && { backgroundColor: "rgba(168,85,247,0.18)", borderColor: colors.purple },
                      ]}
                    >
                      <Text style={[styles.currencyOptText, { color: active ? colors.purple : colors.textMuted }]}>
                        {c === "INR" ? "₹ INR" : "₮ USDT"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
          <View
            style={[
              styles.amountWrap,
              {
                backgroundColor: colors.input,
                borderColor:
                  numAmount > 0 && (!hasAmount || exceedsBalance)
                    ? colors.red
                    : valid
                    ? colors.purple
                    : colors.border,
                borderWidth: valid ? 1.5 : 1,
              },
            ]}
          >
            <Text style={[styles.rupee, { color: colors.purple }]}>{symbol}</Text>
            <TextInput
              ref={amountRef}
              style={[styles.amountInput, { color: colors.foreground }]}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={(v) => {
                setAmount(v);
                setShowAmtError(false);
              }}
              keyboardType="numeric"
              autoFocus={Platform.OS !== "web"}
            />
            {numAmount > 0 && isCrypto && (
              <Text style={[styles.fxHint, { color: colors.textMuted }]}>
                ≈ ₹{Math.round(amountInr).toLocaleString("en-IN")}
              </Text>
            )}
            {numAmount > 0 && !isCrypto && (
              <Text style={[styles.fxHint, { color: colors.textMuted }]}>
                ≈ ${(numAmount / FX_RATE).toFixed(2)}
              </Text>
            )}
          </View>
          {numAmount > 0 && !hasAmount && (
            <Text style={[styles.errorNote, { color: colors.red }]}>
              Minimum withdrawal is {symbol}
              {minAmount.toLocaleString(currency === "INR" ? "en-IN" : "en-US")}
            </Text>
          )}
          {exceedsBalance && (
            <Text style={[styles.errorNote, { color: colors.red }]}>
              Exceeds available balance ({symbol}
              {currency === "INR"
                ? Math.floor(maxAmount).toLocaleString("en-IN")
                : maxAmount.toFixed(2)}
              )
            </Text>
          )}
        </View>

        {/* Quick percent shortcuts */}
        <View style={styles.quickRow}>
          {[
            { label: "25%", pct: 0.25 },
            { label: "50%", pct: 0.5 },
            { label: "75%", pct: 0.75 },
            { label: "MAX", pct: 1 },
          ].map((q) => (
            <Pressable
              key={q.label}
              onPress={() => setQuickPercent(q.pct)}
              accessibilityRole="button"
              accessibilityLabel={`Set amount to ${q.label}`}
              style={({ pressed }) => [
                styles.quickBtn,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.quickText, { color: colors.textSecondary }]}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Method picker */}
        <View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {isCrypto ? "Send To Network" : "Payout Method"}
          </Text>
          <View style={styles.methods}>
            {methodList.map((m) => {
              const isCryptoItem = "symbol" in m;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    if (isCryptoItem) {
                      handleCryptoSelect(m.id);
                    } else {
                      handleInrSelect(m.id);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${m.label}`}
                  style={[
                    styles.methodCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  {isCryptoItem ? (
                    <View
                      style={[
                        styles.cryptoIcon,
                        {
                          backgroundColor: `${(m as typeof CRYPTO_METHODS[number]).color}22`,
                          borderColor: `${(m as typeof CRYPTO_METHODS[number]).color}55`,
                        },
                      ]}
                    >
                      <Text style={[styles.cryptoSymbol, { color: (m as typeof CRYPTO_METHODS[number]).color }]}>
                        {(m as typeof CRYPTO_METHODS[number]).symbol}
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.methodIcon,
                        { backgroundColor: "rgba(168,85,247,0.12)", borderColor: "rgba(168,85,247,0.3)" },
                      ]}
                    >
                      <Feather
                        name={(m as typeof INR_METHODS[number]).icon}
                        size={16}
                        color={colors.purpleLight}
                      />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[styles.methodLabel, { color: colors.foreground }]}>
                      {m.label}
                    </Text>
                    <Text numberOfLines={1} style={[styles.methodSub, { color: colors.textMuted }]}>
                      {m.sub}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
          {showAmtError && !valid && (
            <Text style={[styles.errorNote, { color: colors.red, marginTop: 8 }]}>
              {numAmount === 0
                ? `Enter an amount of at least ${symbol}${minAmount.toLocaleString(
                    currency === "INR" ? "en-IN" : "en-US",
                  )} to continue.`
                : exceedsBalance
                ? "Reduce the amount below your available balance to continue."
                : `Minimum withdrawal is ${symbol}${minAmount.toLocaleString(
                    currency === "INR" ? "en-IN" : "en-US",
                  )}`}
            </Text>
          )}
        </View>

        {/* Security note */}
        <View style={[styles.secNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="shield" size={13} color={colors.purple} />
          <Text style={[styles.secText, { color: colors.textMuted }]}>
            All withdrawals reviewed by compliance · 2FA verified · Anti-money-laundering checks
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  scroll: { paddingHorizontal: 16, gap: 16 },
  backBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  header: { gap: 6 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  balRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  balValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  balSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  rules: { padding: 12, borderRadius: 12, borderWidth: 1, gap: 6 },
  rulesHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  rulesTitle: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleDot: { width: 4, height: 4, borderRadius: 2 },
  ruleText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 16 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8 },
  amountLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  currencySwitcher: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  currencyOpt: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  currencyOptText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  amountWrap: {
    flexDirection: "row", alignItems: "center", borderRadius: 12,
    borderWidth: 1, paddingHorizontal: 16, height: 64, gap: 8,
  },
  rupee: { fontSize: 24, fontFamily: "Inter_700Bold" },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as object) : {}),
  },
  fxHint: { fontSize: 11, fontFamily: "Inter_500Medium" },
  errorNote: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  quickText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  methods: { gap: 8 },
  methodCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  methodIcon: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  cryptoIcon: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  cryptoSymbol: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 22 },
  methodLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  methodSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  secNote: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  secText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
});
