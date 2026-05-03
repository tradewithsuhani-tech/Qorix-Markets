import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { CRYPTO_METHODS, FX_RATE } from "@/constants/cryptoMethods";
import { usePortfolio } from "@/context/PortfolioContext";
import { useColors } from "@/hooks/useColors";

// Conservative network fee per asset (in native units)
const NETWORK_FEE: Record<string, number> = {
  usdt: 1,
  btc: 0.0002,
  eth: 0.0015,
  sol: 0.01,
  xrp: 0.25,
};

// Indicative spot price in USD per 1 unit of the native asset (May 2026 reference)
const USD_PRICE: Record<string, number> = {
  usdt: 1,
  btc: 67000,
  eth: 3300,
  sol: 145,
  xrp: 0.55,
};

const MIN_USD_WITHDRAWAL = 10;

// Loose address validators per chain — first-pass sanity check, not full cryptographic validation
const ADDRESS_RULES: Record<string, { test: (s: string) => boolean; hint: string }> = {
  usdt: {
    test: (s) => /^T[A-Za-z0-9]{33}$/.test(s),
    hint: "TRC20 addresses start with 'T' and are 34 characters long",
  },
  btc: {
    test: (s) =>
      /^bc1[a-z0-9]{39,59}$/.test(s) || /^[13][A-HJ-NP-Za-km-z1-9]{25,34}$/.test(s),
    hint: "Native SegWit (bc1...) or Legacy (1.../3...) addresses",
  },
  eth: {
    test: (s) => /^0x[a-fA-F0-9]{40}$/.test(s),
    hint: "ERC20 addresses start with '0x' and are 42 characters long",
  },
  sol: {
    test: (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s),
    hint: "Solana addresses are 32–44 base58 characters",
  },
  xrp: {
    test: (s) => /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(s),
    hint: "XRP addresses start with 'r' and are 25–35 characters",
  },
};

const generateRef = (seed: string, amount: number) => {
  const k = seed.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 36 ** 3);
  const mix = (k * 7919 + ts + rand) >>> 0;
  return `WT-${mix.toString(36).toUpperCase().slice(-6).padStart(6, "X")}`;
};

const formatCryptoAmount = (n: number): string => {
  if (n === 0) return "0";
  if (n < 0.001) return n.toFixed(8).replace(/\.?0+$/, "");
  if (n < 1) return n.toFixed(6).replace(/\.?0+$/, "");
  if (n < 100) return n.toFixed(4).replace(/\.?0+$/, "");
  return n.toFixed(2).replace(/\.?0+$/, "");
};

export default function WithdrawCryptoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { withdraw, wallet } = usePortfolio();
  const params = useLocalSearchParams<{ id?: string; amount?: string }>();

  const crypto = useMemo(
    () => CRYPTO_METHODS.find((c) => c.id === params.id) ?? null,
    [params.id],
  );
  // params.amount is the USD value the user entered (currency switcher = USDT/USD on entry).
  const amountUsd = parseFloat(params.amount ?? "0") || 0;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  const [walletAddress, setWalletAddress] = useState("");
  const [destTag, setDestTag] = useState("");
  const [confirmAck, setConfirmAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const usdPrice = crypto ? USD_PRICE[crypto.id] ?? 1 : 1;
  // Convert the USD-denominated send amount into native asset units.
  const sendAmountCrypto = usdPrice > 0 ? amountUsd / usdPrice : 0;
  const feeCrypto = crypto ? NETWORK_FEE[crypto.id] ?? 0 : 0;
  const totalCrypto = sendAmountCrypto + feeCrypto;
  const totalDebitUsd = totalCrypto * usdPrice;
  const totalDebitInr = totalDebitUsd * FX_RATE;
  const exceedsBalance = totalDebitInr > wallet.balance;

  const paramError = !crypto
    ? "We couldn't find this network. Please go back and try again."
    : amountUsd <= 0
    ? "Please go back and enter a withdrawal amount first."
    : amountUsd < MIN_USD_WITHDRAWAL
    ? `Minimum crypto withdrawal is $${MIN_USD_WITHDRAWAL}.`
    : null;

  const trimmedAddr = walletAddress.trim();
  const addressValid =
    crypto && trimmedAddr.length > 0 ? ADDRESS_RULES[crypto.id]?.test(trimmedAddr) ?? false : false;
  const tagRequired = crypto?.id === "xrp";
  const tagValid = !tagRequired || (/^[0-9]{1,10}$/.test(destTag.trim()));
  const formValid =
    !!crypto && !paramError && addressValid && tagValid && confirmAck && !exceedsBalance;

  const pasteAddress = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      Haptics.selectionAsync();
      setWalletAddress(text.trim());
    }
  };

  const handleSubmit = async () => {
    if (!formValid || submitting || !crypto) return;
    setSubmitError(null);
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const refCode = generateRef(trimmedAddr + crypto.id, sendAmountCrypto);
    try {
      await withdraw(totalDebitInr, `Withdrawal – ${crypto.label} · ${crypto.network}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/withdraw-success",
        params: {
          kind: "crypto",
          amount: String(Math.round(totalDebitInr)),
          refCode,
          cryptoId: crypto.id,
          cryptoAmount: String(sendAmountCrypto),
          feeAmount: String(feeCrypto),
          walletAddress: trimmedAddr,
          ...(tagRequired ? { destTag: destTag.trim() } : {}),
        },
      });
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err instanceof Error ? err.message : "Withdrawal failed. Please try again.";
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  if (paramError || !crypto) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.errorWrap, { paddingTop: topPadding + 80 }]}>
          <View style={[styles.errorIcon, { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.4)" }]}>
            <Feather name="alert-circle" size={28} color={colors.red} />
          </View>
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Invalid withdrawal</Text>
          <Text style={[styles.errorSub, { color: colors.textSecondary }]}>
            {paramError ?? "We couldn't find this network or amount. Please go back and try again."}
          </Text>
          <Pressable
            onPress={() => router.replace("/withdraw")}
            accessibilityRole="button"
            accessibilityLabel="Back to withdraw"
            style={({ pressed }) => [styles.errorBtn, { backgroundColor: colors.purple, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.btnText}>Back to Withdraw</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const addressBorder =
    walletAddress.length === 0
      ? colors.border
      : addressValid
      ? colors.purple
      : colors.red;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.cryptoIcon,
                { backgroundColor: `${crypto.color}22`, borderColor: `${crypto.color}55` },
              ]}
            >
              <Text style={[styles.cryptoSymbol, { color: crypto.color }]}>{crypto.symbol}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>Withdraw {crypto.label}</Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
                Network: {crypto.network}
              </Text>
            </View>
          </View>
        </View>

        {/* Amount summary */}
        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.sumLabel, { color: colors.textMuted }]}>Send Amount</Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.sumValue, { color: colors.foreground }]}>
                {formatCryptoAmount(sendAmountCrypto)} <Text style={{ color: crypto.color }}>{crypto.label}</Text>
              </Text>
              <Text style={[styles.sumValueSub, { color: colors.textMuted }]}>
                ≈ ${amountUsd.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={[styles.sumLabel, { color: colors.textMuted }]}>Network Fee</Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.sumValue, { color: colors.orange }]}>
                {formatCryptoAmount(feeCrypto)} {crypto.label}
              </Text>
              <Text style={[styles.sumValueSub, { color: colors.textMuted }]}>
                ≈ ${(feeCrypto * usdPrice).toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={[styles.sumLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Total Debit
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.sumValueBig, { color: colors.foreground }]}>
                {formatCryptoAmount(totalCrypto)} {crypto.label}
              </Text>
              <Text style={[styles.sumValueSub, { color: colors.textMuted }]}>
                ≈ ₹{Math.round(totalDebitInr).toLocaleString("en-IN")}
              </Text>
            </View>
          </View>
          {exceedsBalance && (
            <View style={[styles.balErr, { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.32)" }]}>
              <Feather name="alert-circle" size={12} color={colors.red} />
              <Text style={[styles.balErrText, { color: colors.red }]}>
                Insufficient balance — total exceeds ₹{wallet.balance.toLocaleString("en-IN")}
              </Text>
            </View>
          )}
        </View>

        {/* Wallet address */}
        <View>
          <View style={styles.addrLabelRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Recipient Wallet Address</Text>
            <Pressable
              onPress={pasteAddress}
              accessibilityRole="button"
              accessibilityLabel="Paste wallet address"
              style={({ pressed }) => [
                styles.pasteBtn,
                { backgroundColor: "rgba(168,85,247,0.10)", borderColor: "rgba(168,85,247,0.3)", opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="clipboard" size={11} color={colors.purpleLight} />
              <Text style={[styles.pasteText, { color: colors.purpleLight }]}>Paste</Text>
            </Pressable>
          </View>
          <View
            style={[
              styles.addrBox,
              {
                backgroundColor: colors.input,
                borderColor: addressBorder,
                borderWidth: addressValid ? 1.5 : 1,
              },
            ]}
          >
            <TextInput
              value={walletAddress}
              onChangeText={setWalletAddress}
              placeholder={`Paste ${crypto.label} address`}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              style={[styles.addrInput, { color: colors.foreground }]}
            />
            {addressValid && <Feather name="check-circle" size={16} color={colors.green} />}
          </View>
          {walletAddress.length > 0 && !addressValid && (
            <Text style={[styles.fieldError, { color: colors.red }]}>
              {ADDRESS_RULES[crypto.id]?.hint ?? "Invalid address format"}
            </Text>
          )}
          {walletAddress.length === 0 && (
            <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
              {ADDRESS_RULES[crypto.id]?.hint ?? ""}
            </Text>
          )}
        </View>

        {/* XRP destination tag */}
        {tagRequired && (
          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Destination Tag <Text style={{ color: colors.red }}>(Required)</Text>
            </Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Feather name="hash" size={15} color={colors.textMuted} />
              <TextInput
                value={destTag}
                onChangeText={(v) => setDestTag(v.replace(/\D/g, "").slice(0, 10))}
                placeholder="Numeric tag from your exchange"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
          </View>
        )}

        {/* Network warning */}
        <View style={[styles.warnBox, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }]}>
          <Feather name="alert-triangle" size={14} color={colors.red} />
          <Text style={[styles.warnText, { color: colors.textSecondary }]}>
            Sending to a wrong address or network will result in{" "}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>permanent loss of funds</Text>.
            Verify the address belongs to a wallet that supports{" "}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{crypto.network}</Text>.
          </Text>
        </View>

        {/* Acknowledgement */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setConfirmAck((v) => !v);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: confirmAck }}
          accessibilityLabel="Confirm address and network"
          style={({ pressed }) => [
            styles.ackRow,
            {
              backgroundColor: confirmAck ? "rgba(168,85,247,0.08)" : colors.card,
              borderColor: confirmAck ? colors.purple : colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.ackBox,
              {
                backgroundColor: confirmAck ? colors.purple : "transparent",
                borderColor: confirmAck ? colors.purple : colors.borderBright,
              },
            ]}
          >
            {confirmAck && <Feather name="check" size={12} color="#fff" strokeWidth={3} />}
          </View>
          <Text style={[styles.ackText, { color: colors.textSecondary }]}>
            I&apos;ve verified the address and confirm it supports{" "}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{crypto.network}</Text>.
          </Text>
        </Pressable>

        {!!submitError && (
          <View style={[styles.warnBox, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.32)" }]}>
            <Feather name="alert-triangle" size={14} color={colors.red} />
            <Text style={[styles.warnText, { color: colors.red }]}>{submitError}</Text>
          </View>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={!formValid || submitting}
          accessibilityRole="button"
          accessibilityLabel="Submit crypto withdrawal"
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: formValid ? colors.purple : colors.secondary,
              opacity: pressed && formValid ? 0.85 : 1,
            },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.btnRow}>
              <Feather name="send" size={15} color={formValid ? "#fff" : colors.textMuted} />
              <Text style={[styles.btnText, { color: formValid ? "#fff" : colors.textMuted }]}>
                {formValid
                  ? `Withdraw ${formatCryptoAmount(sendAmountCrypto)} ${crypto.label}`
                  : exceedsBalance
                  ? "Insufficient Balance"
                  : !confirmAck
                  ? "Confirm Address First"
                  : "Enter Wallet Address"}
              </Text>
            </View>
          )}
        </Pressable>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Broadcast on-chain after compliance review · Reference saved on next page
        </Text>
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
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cryptoIcon: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  cryptoSymbol: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 26 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  summary: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sumLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sumValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sumValueBig: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sumValueSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  divider: { height: 1, backgroundColor: "rgba(148,163,184,0.08)" },
  balErr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  balErrText: { fontSize: 11, fontFamily: "Inter_600SemiBold", flex: 1 },
  addrLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  pasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  pasteText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  fieldError: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 5 },
  fieldHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 5, lineHeight: 15 },
  addrBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  addrInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    minHeight: 32,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as object) : {}),
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as object) : {}),
  },
  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  warnText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  ackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  ackBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  ackText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 18 },
  btn: { height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  footer: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
  errorWrap: { flex: 1, alignItems: "center", paddingHorizontal: 24, gap: 14 },
  errorIcon: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  errorTitle: { fontSize: 19, fontFamily: "Inter_700Bold", textAlign: "center" },
  errorSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 300 },
  errorBtn: {
    marginTop: 12, height: 48, paddingHorizontal: 32, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
});
