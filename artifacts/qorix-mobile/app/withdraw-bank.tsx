import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePortfolio } from "@/context/PortfolioContext";
import { useColors } from "@/hooks/useColors";

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const generateRef = (seed: string, amount: number) => {
  const k = seed.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 36 ** 3);
  const mix = (k * 7919 + ts + rand) >>> 0;
  return `WT-${mix.toString(36).toUpperCase().slice(-6).padStart(6, "X")}`;
};

const maskAccount = (acc: string) => {
  if (acc.length <= 4) return acc;
  return "*".repeat(Math.max(0, acc.length - 4)) + acc.slice(-4);
};

// Best-effort bank short name from IFSC prefix (first 4 letters)
const BANK_FROM_IFSC: Record<string, string> = {
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  SBIN: "State Bank of India",
  AXIS: "Axis Bank",
  KKBK: "Kotak Mahindra",
  PUNB: "Punjab National Bank",
  IDFB: "IDFC FIRST Bank",
  YESB: "Yes Bank",
  UTIB: "Axis Bank",
  CITI: "Citibank",
  CNRB: "Canara Bank",
  BARB: "Bank of Baroda",
  IBKL: "IDBI Bank",
  INDB: "IndusInd Bank",
  RATN: "RBL Bank",
};

const MIN_INR_WITHDRAWAL = 500;

export default function WithdrawBankScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { withdraw, wallet } = usePortfolio();
  const params = useLocalSearchParams<{ amount?: string }>();

  const numAmount = parseFloat(params.amount ?? "0") || 0;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  const paramError =
    numAmount <= 0
      ? "Please go back and enter a withdrawal amount first."
      : numAmount < MIN_INR_WITHDRAWAL
      ? `Minimum bank withdrawal is ₹${MIN_INR_WITHDRAWAL.toLocaleString("en-IN")}.`
      : numAmount > wallet.balance
      ? `Amount exceeds your available balance of ₹${wallet.balance.toLocaleString("en-IN")}.`
      : null;

  const [accountName, setAccountName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [confirmAccountNo, setConfirmAccountNo] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nameValid = accountName.trim().length >= 3;
  const accValid = accountNo.length >= 9 && accountNo.length <= 18;
  const accMatches = accountNo === confirmAccountNo && accountNo.length > 0;
  const ifscValid = IFSC_REGEX.test(ifsc);
  const formValid = nameValid && accValid && accMatches && ifscValid && !paramError;

  const ifscPrefix = ifsc.slice(0, 4).toUpperCase();
  const inferredBank =
    ifscValid && BANK_FROM_IFSC[ifscPrefix] ? BANK_FROM_IFSC[ifscPrefix] : null;

  const handleSubmit = async () => {
    if (!formValid || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const refCode = generateRef(accountNo + ifsc, numAmount);
    const desc = inferredBank
      ? `Withdrawal – ${inferredBank} · NEFT/IMPS`
      : "Withdrawal – Bank Transfer · NEFT/IMPS";
    try {
      await withdraw(numAmount, desc);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/withdraw-success",
        params: {
          kind: "bank",
          amount: String(numAmount),
          refCode,
          holder: accountName.trim(),
          accountMasked: maskAccount(accountNo),
          ifsc: ifsc.toUpperCase(),
          bankName: inferredBank ?? "Bank Account",
        },
      });
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err instanceof Error ? err.message : "Withdrawal failed. Please try again.";
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  if (paramError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.errorWrap, { paddingTop: topPadding + 80 }]}>
          <View style={[styles.errorIcon, { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.4)" }]}>
            <Feather name="alert-circle" size={28} color={colors.red} />
          </View>
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            {numAmount <= 0 ? "Missing amount" : numAmount < MIN_INR_WITHDRAWAL ? "Amount too low" : "Insufficient balance"}
          </Text>
          <Text style={[styles.errorSub, { color: colors.textSecondary }]}>{paramError}</Text>
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
          <Text style={[styles.title, { color: colors.foreground }]}>Bank Account</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            We&apos;ll transfer ₹{numAmount.toLocaleString("en-IN")} via NEFT/IMPS to the account
            you provide. Verify carefully — incorrect details may delay the payout.
          </Text>
        </View>

        {/* Amount summary */}
        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>You&apos;ll Receive</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              ₹{numAmount.toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={[styles.feeBadge, { backgroundColor: "rgba(34,197,94,0.10)", borderColor: "rgba(34,197,94,0.32)" }]}>
            <Feather name="zap" size={11} color={colors.green} />
            <Text style={[styles.feeBadgeText, { color: colors.green }]}>FREE · NEFT/IMPS</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Account Holder Name</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Feather name="user" size={15} color={colors.textMuted} />
              <TextInput
                value={accountName}
                onChangeText={setAccountName}
                placeholder="As per bank records"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
            {accountName.length > 0 && !nameValid && (
              <Text style={[styles.fieldError, { color: colors.red }]}>Enter at least 3 characters</Text>
            )}
          </View>

          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Account Number</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Feather name="hash" size={15} color={colors.textMuted} />
              <TextInput
                value={accountNo}
                onChangeText={(v) => setAccountNo(v.replace(/\D/g, "").slice(0, 18))}
                placeholder="9–18 digits"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
            {accountNo.length > 0 && !accValid && (
              <Text style={[styles.fieldError, { color: colors.red }]}>Account number must be 9–18 digits</Text>
            )}
          </View>

          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Confirm Account Number</Text>
            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: colors.input,
                  borderColor:
                    confirmAccountNo.length > 0 && !accMatches ? colors.red : colors.border,
                },
              ]}
            >
              <Feather name="check-circle" size={15} color={colors.textMuted} />
              <TextInput
                value={confirmAccountNo}
                onChangeText={(v) => setConfirmAccountNo(v.replace(/\D/g, "").slice(0, 18))}
                placeholder="Re-enter to confirm"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
            {confirmAccountNo.length > 0 && !accMatches && (
              <Text style={[styles.fieldError, { color: colors.red }]}>Account numbers don&apos;t match</Text>
            )}
          </View>

          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>IFSC Code</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Feather name="globe" size={15} color={colors.textMuted} />
              <TextInput
                value={ifsc}
                onChangeText={(v) => setIfsc(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                placeholder="e.g. HDFC0001234"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                style={[styles.input, { color: colors.foreground }]}
              />
              {inferredBank && (
                <View
                  style={[
                    styles.bankPill,
                    { backgroundColor: "rgba(168,85,247,0.10)", borderColor: "rgba(168,85,247,0.3)" },
                  ]}
                >
                  <Text style={[styles.bankPillText, { color: colors.purpleLight }]} numberOfLines={1}>
                    {inferredBank}
                  </Text>
                </View>
              )}
            </View>
            {ifsc.length > 0 && !ifscValid && (
              <Text style={[styles.fieldError, { color: colors.red }]}>Invalid IFSC format</Text>
            )}
          </View>
        </View>

        {/* Compliance notice */}
        <View style={[styles.notice, { backgroundColor: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.25)" }]}>
          <Feather name="clock" size={14} color={colors.orange} />
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
            Withdrawals are reviewed and processed within{" "}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>24 hours</Text>.
            You&apos;ll be notified once funds are dispatched.
          </Text>
        </View>

        {!!submitError && (
          <View style={[styles.notice, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.32)" }]}>
            <Feather name="alert-triangle" size={14} color={colors.red} />
            <Text style={[styles.noticeText, { color: colors.red }]}>{submitError}</Text>
          </View>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={!formValid || submitting}
          accessibilityRole="button"
          accessibilityLabel="Submit withdrawal"
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
                {formValid ? `Withdraw ₹${numAmount.toLocaleString("en-IN")}` : "Fill Bank Details"}
              </Text>
            </View>
          )}
        </Pressable>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Encrypted end-to-end · Your bank details are never stored on-device
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
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },
  summaryValue: { fontSize: 24, fontFamily: "Inter_700Bold", marginTop: 4 },
  feeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  feeBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  form: { gap: 14 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6 },
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
  bankPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 140,
  },
  bankPillText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  fieldError: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 5 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  btn: { height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  footer: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
  errorWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorTitle: { fontSize: 19, fontFamily: "Inter_700Bold", textAlign: "center" },
  errorSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 300 },
  errorBtn: {
    marginTop: 12,
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
