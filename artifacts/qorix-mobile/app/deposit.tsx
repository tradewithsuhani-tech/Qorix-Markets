import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { CRYPTO_METHODS, FX_RATE } from "@/constants/cryptoMethods";
import { useColors } from "@/hooks/useColors";
import { useGetWallet, useDeposit } from "@workspace/api-client-react";

const INR_METHODS = [
  { id: "upi", icon: "zap" as const, label: "UPI", sub: "Instant · No charges" },
  { id: "netbanking", icon: "globe" as const, label: "Net Banking", sub: "Instant · Bank charges may apply" },
  { id: "imps", icon: "send" as const, label: "IMPS / NEFT", sub: "Within 30 mins · Free" },
];

export default function DepositScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const walletQ = useGetWallet();
  const depositMut = useDeposit();
  const wRaw = walletQ.data as any;
  const wallet = {
    balance: (Number(wRaw?.mainBalance) || 0) * FX_RATE,
  };
  const deposit = async (amountInr: number) => {
    await depositMut.mutateAsync({ data: { amount: amountInr / FX_RATE } });
    await walletQ.refetch();
  };

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("");
  const [currency, setCurrency] = useState<"INR" | "USDT">("INR");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showAmtError, setShowAmtError] = useState(false);
  const amountRef = useRef<TextInput>(null);

  const isCrypto = currency === "USDT";
  const methodList = isCrypto ? CRYPTO_METHODS : INR_METHODS;
  const numAmount = parseFloat(amount.replace(/,/g, "")) || 0;
  const minAmount = currency === "INR" ? 5000 : 60;
  const hasAmount = numAmount >= minAmount;
  // For INR flow only (crypto navigates to a separate page)
  const isValid = hasAmount && method !== "";
  const symbol = currency === "INR" ? "₹" : "$";
  const quickAmounts = currency === "INR" ? [5000, 10000, 25000, 50000] : [60, 120, 300, 600];
  // Convert numAmount to INR for the actual deposit submission
  const amountInr = currency === "INR" ? numAmount : numAmount * FX_RATE;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  const switchCurrency = (next: "INR" | "USDT") => {
    if (next === currency) return;
    Haptics.selectionAsync();
    // Convert the typed amount when switching currencies
    if (numAmount > 0) {
      const converted = next === "USDT" ? numAmount / FX_RATE : numAmount * FX_RATE;
      setAmount(Math.round(converted).toString());
    }
    // Reset payment method since INR vs crypto have different lists
    setMethod("");
    setShowAmtError(false);
    setCurrency(next);
  };

  const handleCryptoSelect = (id: string) => {
    if (!hasAmount) {
      // Need a valid amount before continuing to QR page
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowAmtError(true);
      amountRef.current?.focus();
      return;
    }
    Haptics.selectionAsync();
    router.push({
      pathname: "/deposit-crypto",
      params: { id, amount: numAmount.toString() },
    });
  };

  const handleInrSelect = (id: string) => {
    // UPI and Net Banking navigate to dedicated pages.
    // IMPS / NEFT keeps the inline flow with the bottom button.
    if (id === "upi" || id === "netbanking") {
      if (!hasAmount) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setShowAmtError(true);
        amountRef.current?.focus();
        return;
      }
      Haptics.selectionAsync();
      router.push({
        pathname: id === "upi" ? "/deposit-upi" : "/deposit-netbanking",
        params: { amount: numAmount.toString() },
      });
      return;
    }
    Haptics.selectionAsync();
    setMethod(id);
  };

  // Auto-focus on native only — on web, autoFocus causes the browser to
  // scrollIntoView and shift the layout horizontally inside the iframe.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const t = setTimeout(() => {
      amountRef.current?.focus();
    }, 350);
    return () => clearTimeout(t);
  }, []);

  const handleDeposit = async () => {
    if (!isValid) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await deposit(amountInr);
    setLoading(false);
    setSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => router.back(), 1800);
  };

  if (success) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.successContent, { paddingTop: topPadding }]}>
          <View style={[styles.successIcon, { backgroundColor: "rgba(46,204,113,0.1)", borderColor: "rgba(46,204,113,0.3)" }]}>
            <Feather name="check-circle" size={40} color={colors.green} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Deposit Successful!</Text>
          <Text style={[styles.successSub, { color: colors.textSecondary }]}>
            ₹{Math.round(amountInr).toLocaleString("en-IN")} has been credited to your wallet.
          </Text>
        </View>
      </View>
    );
  }

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
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Add Funds</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {isCrypto
              ? "Crypto deposits credited after on-chain confirmation."
              : "Funds are credited instantly via Razorpay secure gateway."}
          </Text>
        </View>

        {/* Current Balance */}
        <Card padding={14}>
          <View style={styles.balRow}>
            <Text style={[styles.balLabel, { color: colors.textSecondary }]}>Current Balance</Text>
            <Text style={[styles.balValue, { color: colors.green }]}>₹{wallet.balance.toLocaleString("en-IN")}</Text>
          </View>
        </Card>

        {/* Amount */}
        <View>
          <View style={styles.amountLabelRow}>
            <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>Deposit Amount</Text>
            {/* Currency switcher */}
            <View style={[styles.currencySwitcher, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {(["INR", "USDT"] as const).map((c) => {
                const active = currency === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => switchCurrency(c)}
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
          </View>
          <View style={[styles.amountWrap, { backgroundColor: colors.input, borderColor: numAmount > 0 && !hasAmount ? colors.red : hasAmount ? colors.purple : colors.border, borderWidth: hasAmount ? 1.5 : 1 }]}>
            <Text style={[styles.rupee, { color: colors.purple }]}>{symbol}</Text>
            <TextInput
              ref={amountRef}
              style={[styles.amountInput, { color: colors.foreground }]}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={setAmount}
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
              Minimum deposit is {symbol}{minAmount.toLocaleString(currency === "INR" ? "en-IN" : "en-US")}
            </Text>
          )}
        </View>

        {/* Quick amounts */}
        <View style={styles.quickRow}>
          {quickAmounts.map((a) => (
            <Pressable
              key={a}
              onPress={() => { Haptics.selectionAsync(); setAmount(a.toString()); }}
              style={({ pressed }) => [styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.quickText, { color: colors.textSecondary }]}>
                {currency === "INR"
                  ? `₹${(a / 1000).toFixed(0)}K`
                  : `$${a}`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Payment Methods (INR) or Crypto Networks (USDT) */}
        <View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {isCrypto ? "Crypto Currency" : "Payment Method"}
          </Text>
          <View style={styles.methods}>
            {methodList.map((m) => {
              const isCryptoItem = "symbol" in m;
              const navigatesAway =
                isCryptoItem || m.id === "upi" || m.id === "netbanking";
              const selected = !navigatesAway && method === m.id;
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
                  style={[
                    styles.methodCard,
                    {
                      backgroundColor: selected ? "rgba(168,85,247,0.10)" : colors.card,
                      borderColor: selected ? colors.purple : colors.border,
                      borderWidth: selected ? 1.5 : 1,
                    },
                  ]}
                >
                  {isCryptoItem ? (
                    <View
                      style={[
                        styles.cryptoIcon,
                        { backgroundColor: `${(m as typeof CRYPTO_METHODS[number]).color}22`, borderColor: `${(m as typeof CRYPTO_METHODS[number]).color}55` },
                      ]}
                    >
                      <Text style={[styles.cryptoSymbol, { color: (m as typeof CRYPTO_METHODS[number]).color }]}>
                        {(m as typeof CRYPTO_METHODS[number]).symbol}
                      </Text>
                    </View>
                  ) : (
                    <Feather name={(m as typeof INR_METHODS[number]).icon} size={18} color={selected ? colors.purple : colors.textSecondary} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={[styles.methodLabel, { color: selected ? colors.foreground : colors.textSecondary }]}
                    >
                      {m.label}
                    </Text>
                    <Text numberOfLines={1} style={[styles.methodSub, { color: colors.textMuted }]}>
                      {m.sub}
                    </Text>
                  </View>
                  {selected && <Feather name="check-circle" size={16} color={colors.purple} />}
                  {navigatesAway && <Feather name="chevron-right" size={18} color={colors.textMuted} />}
                </Pressable>
              );
            })}
          </View>
          {showAmtError && !hasAmount && (
            <Text style={[styles.errorNote, { color: colors.red, marginTop: 8 }]}>
              Enter a deposit amount of at least {symbol}
              {minAmount.toLocaleString(currency === "INR" ? "en-IN" : "en-US")} to continue.
            </Text>
          )}
        </View>

        {/* Security Note (INR only — crypto flow has its own on the next page) */}
        {!isCrypto && (
          <View style={[styles.secNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="shield" size={13} color={colors.purple} />
            <Text style={[styles.secText, { color: colors.textMuted }]}>
              Secured by Razorpay · HMAC-SHA256 verified · Anti-fraud protected
            </Text>
          </View>
        )}

        {/* Deposit button (INR only — crypto navigates to dedicated QR page) */}
        {!isCrypto && (
          <Pressable
            onPress={handleDeposit}
            disabled={!isValid || loading}
            style={({ pressed }) => [styles.btn, { backgroundColor: isValid ? colors.purple : colors.secondary, opacity: pressed ? 0.85 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.btnText, { color: isValid ? "#fff" : colors.textMuted }]}>
                Deposit {numAmount > 0 ? `${symbol}${numAmount.toLocaleString("en-IN")}` : "—"}
              </Text>
            )}
          </Pressable>
        )}
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
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8 },
  amountWrap: {
    flexDirection: "row", alignItems: "center", borderRadius: 12,
    borderWidth: 1, paddingHorizontal: 16, height: 64, gap: 8,
  },
  rupee: { fontSize: 24, fontFamily: "Inter_700Bold" },
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
  fxHint: { fontSize: 11, fontFamily: "Inter_500Medium" },
  cryptoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cryptoSymbol: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 22 },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as object) : {}),
  },
  errorNote: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  quickText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  methods: { gap: 8 },
  methodCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 12,
  },
  methodLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  methodSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  secNote: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  secText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  btn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  successContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  successIcon: {
    width: 96, height: 96, borderRadius: 30, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  successTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  successSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
});
