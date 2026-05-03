import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function KycScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { submitKyc, user } = useAuth();

  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(user?.kycStatus === "pending");

  const formatAadhaar = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  };

  const handleSubmit = async () => {
    const rawAadhaar = aadhaar.replace(/\s/g, "");
    if (rawAadhaar.length !== 12) return;
    if (pan.length !== 10) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await submitKyc(rawAadhaar, pan.toUpperCase());
    setLoading(false);
    setSubmitted(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (submitted) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.pendingContent, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.successIcon, { backgroundColor: "rgba(201,168,76,0.1)", borderColor: colors.borderBright }]}>
            <Feather name="clock" size={36} color={colors.gold} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>KYC Under Review</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Your documents have been submitted and are being verified by our compliance team. This typically takes 2–24 hours.
          </Text>
          <View style={[styles.steps, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: "Documents submitted", done: true },
              { label: "Compliance review", done: false },
              { label: "Account activation", done: false },
            ].map((s) => (
              <View key={s.label} style={styles.stepRow}>
                <View style={[styles.stepDot, { backgroundColor: s.done ? colors.green : colors.border }]}>
                  {s.done && <Feather name="check" size={10} color="#fff" />}
                </View>
                <Text style={[styles.stepText, { color: s.done ? colors.foreground : colors.textSecondary }]}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={[styles.supportNote, { backgroundColor: "rgba(201,168,76,0.06)", borderColor: colors.borderBright }]}>
            <Feather name="mail" size={14} color={colors.gold} />
            <Text style={[styles.supportText, { color: colors.textSecondary }]}>
              You'll receive an email confirmation once your account is approved.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const rawAadhaar = aadhaar.replace(/\s/g, "");
  const isValid = rawAadhaar.length === 12 && pan.length === 10;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.tag, { color: colors.gold, backgroundColor: "rgba(201,168,76,0.1)", borderColor: colors.borderBright }]}>
            KYC VERIFICATION
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Verify your identity</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            As per SEBI/RBI guidelines, KYC is mandatory for all trading accounts.
          </Text>
        </View>

        <View style={styles.form}>
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Aadhaar Number</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Feather name="credit-card" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="XXXX XXXX XXXX"
                placeholderTextColor={colors.textMuted}
                value={aadhaar}
                onChangeText={(v) => setAadhaar(formatAadhaar(v))}
                keyboardType="number-pad"
                maxLength={14}
              />
              {rawAadhaar.length === 12 && <Feather name="check-circle" size={16} color={colors.green} />}
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>PAN Number</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Feather name="file-text" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="ABCDE1234F"
                placeholderTextColor={colors.textMuted}
                value={pan}
                onChangeText={(v) => setPan(v.toUpperCase().slice(0, 10))}
                autoCapitalize="characters"
                maxLength={10}
              />
              {pan.length === 10 && <Feather name="check-circle" size={16} color={colors.green} />}
            </View>
          </View>

          <View style={[styles.docNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="lock" size={14} color={colors.goldDim} />
            <Text style={[styles.docText, { color: colors.textMuted }]}>
              Documents are encrypted with AES-256-GCM and stored in a private, SEBI-compliant vault.
            </Text>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading || !isValid}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: isValid ? colors.gold : colors.secondary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.btnText, { color: isValid ? colors.primaryForeground : colors.textMuted }]}>
                Submit for Verification
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  pendingContent: { flex: 1, paddingHorizontal: 24, alignItems: "center" },
  header: { marginBottom: 28 },
  tag: {
    fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
    alignSelf: "flex-start", marginBottom: 12,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 8 },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  form: { gap: 14 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", borderRadius: 12,
    borderWidth: 1, paddingHorizontal: 14, height: 52, gap: 10,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  docNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  docText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  btn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  successIcon: {
    width: 88, height: 88, borderRadius: 28, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginBottom: 24, marginTop: 20,
  },
  steps: {
    width: "100%", borderRadius: 12, borderWidth: 1, padding: 16, gap: 12, marginVertical: 24,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepDot: {
    width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  stepText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  supportNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1, width: "100%",
  },
  supportText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
});
