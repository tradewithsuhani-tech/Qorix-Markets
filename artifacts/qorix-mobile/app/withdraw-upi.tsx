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

const UPI_REGEX = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,64}$/;

const UPI_HANDLES = ["@paytm", "@ybl", "@oksbi", "@okhdfcbank", "@axisbank", "@ibl", "@upi"];

const generateRef = (seed: string, amount: number) => {
  const k = seed.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 36 ** 3);
  const mix = (k * 7919 + ts + rand) >>> 0;
  return `WT-${mix.toString(36).toUpperCase().slice(-6).padStart(6, "X")}`;
};

const handleProvider = (upi: string): string => {
  const idx = upi.indexOf("@");
  if (idx < 0) return "UPI Transfer";
  const h = upi.slice(idx).toLowerCase();
  if (h === "@paytm") return "Paytm";
  if (h === "@ybl") return "PhonePe";
  if (h === "@oksbi" || h.startsWith("@oks")) return "Google Pay (SBI)";
  if (h.startsWith("@okhdfc")) return "Google Pay (HDFC)";
  if (h.startsWith("@okaxis")) return "Google Pay (Axis)";
  if (h.startsWith("@okicici")) return "Google Pay (ICICI)";
  if (h === "@axisbank") return "Axis Bank";
  if (h === "@ibl") return "Yes Bank";
  if (h === "@upi") return "BHIM UPI";
  return "UPI Transfer";
};

const MIN_INR_WITHDRAWAL = 500;

export default function WithdrawUpiScreen() {
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
      ? `Minimum UPI withdrawal is ₹${MIN_INR_WITHDRAWAL.toLocaleString("en-IN")}.`
      : numAmount > wallet.balance
      ? `Amount exceeds your available balance of ₹${wallet.balance.toLocaleString("en-IN")}.`
      : null;

  const [upiId, setUpiId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const upiTrimmed = upiId.trim().toLowerCase();
  const upiValid = UPI_REGEX.test(upiTrimmed);
  const formValid = upiValid && !paramError;

  const handleSubmit = async () => {
    if (!formValid || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const refCode = generateRef(upiTrimmed, numAmount);
    const provider = handleProvider(upiTrimmed);
    try {
      await withdraw(numAmount, `Withdrawal – ${provider} · UPI`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/withdraw-success",
        params: {
          kind: "upi",
          amount: String(numAmount),
          refCode,
          upiId: upiTrimmed,
          provider,
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
          <Text style={[styles.title, { color: colors.foreground }]}>UPI Transfer</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Enter your UPI ID and we&apos;ll transfer ₹{numAmount.toLocaleString("en-IN")}
            {" "}directly to your wallet.
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
            <Text style={[styles.feeBadgeText, { color: colors.green }]}>FREE · INSTANT</Text>
          </View>
        </View>

        {/* UPI ID */}
        <View>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Your UPI ID</Text>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.input,
                borderColor:
                  upiId.length > 0 && !upiValid
                    ? colors.red
                    : upiValid
                    ? colors.purple
                    : colors.border,
                borderWidth: upiValid ? 1.5 : 1,
              },
            ]}
          >
            <Feather name="at-sign" size={16} color={upiValid ? colors.purple : colors.textMuted} />
            <TextInput
              value={upiId}
              onChangeText={(v) => setUpiId(v.replace(/\s/g, ""))}
              placeholder="yourname@bank"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={Platform.OS === "ios" ? "ascii-capable" : "email-address"}
              style={[styles.input, { color: colors.foreground }]}
            />
            {upiValid && <Feather name="check-circle" size={16} color={colors.green} />}
          </View>
          {upiId.length > 0 && !upiValid && (
            <Text style={[styles.fieldError, { color: colors.red }]}>
              Enter a valid UPI ID (e.g. yourname@paytm)
            </Text>
          )}
          {upiValid && (
            <Text style={[styles.fieldOk, { color: colors.green }]}>
              <Feather name="shield" size={11} color={colors.green} /> {handleProvider(upiTrimmed)}
            </Text>
          )}
        </View>

        {/* Common UPI handles */}
        <View>
          <Text style={[styles.suggestLabel, { color: colors.textMuted }]}>Common handles</Text>
          <View style={styles.suggestRow}>
            {UPI_HANDLES.map((h) => (
              <Pressable
                key={h}
                onPress={() => {
                  Haptics.selectionAsync();
                  const at = upiId.indexOf("@");
                  const name = at < 0 ? upiId : upiId.slice(0, at);
                  setUpiId(name + h);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Use ${h} handle`}
                style={({ pressed }) => [
                  styles.suggestPill,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.suggestText, { color: colors.textSecondary }]}>{h}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Notice */}
        <View style={[styles.notice, { backgroundColor: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.25)" }]}>
          <Feather name="alert-triangle" size={14} color={colors.orange} />
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
            Double-check your UPI ID — transfers to incorrect IDs cannot be reversed.{" "}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>
              Funds typically arrive within minutes
            </Text>{" "}
            after compliance approval.
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
                {formValid ? `Withdraw ₹${numAmount.toLocaleString("en-IN")}` : "Enter UPI ID"}
              </Text>
            </View>
          )}
        </Pressable>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Verified via NPCI · Encrypted end-to-end · No hidden charges
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
  fieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as object) : {}),
  },
  fieldError: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 5 },
  fieldOk: { fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 5, letterSpacing: 0.3 },
  suggestLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 8 },
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  suggestText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
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
