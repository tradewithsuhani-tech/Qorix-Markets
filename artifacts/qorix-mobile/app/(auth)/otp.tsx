import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function OtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyOtp } = useAuth();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(59);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (val: string, idx: number) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
    if (next.every((d) => d !== "")) handleVerify(next.join(""));
  };

  const handleKey = (e: any, idx: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const finalCode = code ?? otp.join("");
    if (finalCode.length !== 6) return;
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await verifyOtp(finalCode);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Invalid OTP");
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <View style={[styles.iconWrap, { borderColor: colors.borderBright, backgroundColor: "rgba(201,168,76,0.08)" }]}>
            <Feather name="message-square" size={28} color={colors.gold} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Verify your identity</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Enter the 6-digit OTP sent to{"\n"}
            <Text style={{ color: colors.gold }}>{email}</Text>
          </Text>
        </View>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputs.current[i] = r; }}
              style={[
                styles.otpBox,
                {
                  backgroundColor: colors.input,
                  borderColor: digit ? colors.gold : colors.border,
                  color: colors.foreground,
                },
              ]}
              maxLength={1}
              keyboardType="number-pad"
              value={digit}
              onChangeText={(v) => handleChange(v, i)}
              onKeyPress={(e) => handleKey(e, i)}
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: "rgba(231,76,60,0.1)", borderColor: "rgba(231,76,60,0.3)" }]}>
            <Feather name="alert-circle" size={14} color={colors.red} />
            <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => handleVerify()}
          disabled={loading || otp.some((d) => !d)}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: otp.every((d) => d) ? colors.gold : colors.secondary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.btnText, { color: otp.every((d) => d) ? colors.primaryForeground : colors.textMuted }]}>
              Verify OTP
            </Text>
          )}
        </Pressable>

        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={[styles.resendText, { color: colors.textMuted }]}>
              Resend OTP in{" "}
              <Text style={{ color: colors.gold }}>0:{countdown.toString().padStart(2, "0")}</Text>
            </Text>
          ) : (
            <Pressable onPress={() => setCountdown(59)}>
              <Text style={[styles.resendText, { color: colors.gold }]}>Resend OTP</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          For demo purposes, enter any 6 digits
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  backBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginBottom: 32,
  },
  header: { alignItems: "center", marginBottom: 36 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 22, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 8 },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  otpRow: { flexDirection: "row", gap: 10, justifyContent: "center", marginBottom: 20 },
  otpBox: {
    width: 46, height: 56, borderRadius: 12, borderWidth: 1.5,
    textAlign: "center", fontSize: 22, fontFamily: "Inter_700Bold",
  },
  errorBox: {
    flexDirection: "row", alignItems: "center", padding: 10,
    borderRadius: 8, borderWidth: 1, gap: 8, marginBottom: 12,
  },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  btn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  resendRow: { alignItems: "center", marginTop: 16 },
  resendText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  hint: { textAlign: "center", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 32 },
});
