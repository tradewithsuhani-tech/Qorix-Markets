import { Feather } from "@expo/vector-icons";
import {
  forgotPassword,
  resetPassword,
  verifyResetOtp,
} from "@workspace/api-client-react";
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

import { StyledInput } from "@/components/StyledInput";
import { useColors } from "@/hooks/useColors";

type Step = "email" | "otp" | "newPassword" | "done";

function extractError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  const anyErr = err as { data?: { error?: string }; message?: string };
  const raw = anyErr?.data?.error ?? anyErr?.message ?? fallback;
  if (/failed to fetch|network|internal server error/i.test(raw)) {
    return "Server unreachable. Please try again in a moment.";
  }
  return raw;
}

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState(""); // single-use token from step 2
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<Array<TextInput | null>>([]);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  // Resend cooldown timer
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // -------- Step 1: send OTP --------
  const handleSendOtp = async (resending = false) => {
    setError("");
    const e = email.trim();
    if (!e) return setError("Please enter your email address");
    if (!isValidEmail(e)) return setError("Please enter a valid email address");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await forgotPassword({ email: e });
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!resending) setStep("otp");
      setResendIn(30);
    } catch (err) {
      setLoading(false);
      setError(extractError(err, "Could not send reset code"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // -------- Step 2: verify OTP --------
  const handleVerifyOtp = async () => {
    setError("");
    if (otp.length !== 6) return setError("Please enter the 6-digit code");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await verifyResetOtp({ email: email.trim(), otp });
      setLoading(false);
      setResetToken(res.otp);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("newPassword");
    } catch (err) {
      setLoading(false);
      setError(extractError(err, "Invalid or expired code"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // -------- Step 3: set new password --------
  const handleResetPassword = async () => {
    setError("");
    if (newPw.length < 8) return setError("Password must be at least 8 characters");
    if (newPw !== confirmPw) return setError("Passwords don't match");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await resetPassword({
        email: email.trim(),
        otp: resetToken,
        newPassword: newPw,
      });
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("done");
    } catch (err) {
      setLoading(false);
      setError(extractError(err, "Could not reset password"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // -------- OTP input helpers --------
  const handleOtpDigit = (idx: number, value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const next = otp.split("");
      next[idx] = "";
      setOtp(next.join("").slice(0, 6));
      return;
    }
    if (cleaned.length > 1) {
      // pasted multi-digit
      const sliced = cleaned.slice(0, 6);
      setOtp(sliced);
      const focusIdx = Math.min(sliced.length, 5);
      otpRefs.current[focusIdx]?.focus();
      return;
    }
    const next = otp.split("");
    next[idx] = cleaned;
    const joined = next.join("").slice(0, 6);
    setOtp(joined);
    if (idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpBackspace = (idx: number) => {
    if (otp[idx]) {
      const next = otp.split("");
      next[idx] = "";
      setOtp(next.join(""));
    } else if (idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  // -------- Header content per step --------
  const headerIcon =
    step === "done" ? "check-circle" : step === "newPassword" ? "shield" : step === "otp" ? "mail" : "key";
  const titleText =
    step === "done"
      ? "Password updated"
      : step === "newPassword"
        ? "Create new password"
        : step === "otp"
          ? "Enter verification code"
          : "Forgot password?";
  const subText =
    step === "done"
      ? "Your password has been reset successfully. You can now sign in with your new password."
      : step === "newPassword"
        ? "Choose a strong password with at least 8 characters."
        : step === "otp"
          ? `We've sent a 6-digit code to ${email.trim()}. Enter it below to continue.`
          : "Enter your registered email and we'll send you a code to reset your password.";

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => {
            if (step === "otp") {
              setStep("email");
              setOtp("");
              setError("");
            } else if (step === "newPassword") {
              setStep("otp");
              setNewPw("");
              setConfirmPw("");
              setError("");
            } else {
              router.back();
            }
          }}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>

        <View style={styles.header}>
          <View
            style={[
              styles.logoWrap,
              { borderColor: colors.borderBright, backgroundColor: "rgba(201,168,76,0.08)" },
            ]}
          >
            <Feather name={headerIcon} size={28} color={colors.gold} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{titleText}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{subText}</Text>
        </View>

        {/* Step indicator */}
        {step !== "done" ? (
          <View style={styles.steps}>
            {[1, 2, 3].map((n) => {
              const active =
                (step === "email" && n === 1) ||
                (step === "otp" && n === 2) ||
                (step === "newPassword" && n === 3);
              const done =
                (step === "otp" && n === 1) ||
                (step === "newPassword" && (n === 1 || n === 2));
              return (
                <View
                  key={n}
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: active || done ? colors.gold : colors.border,
                      width: active ? 24 : 8,
                    },
                  ]}
                />
              );
            })}
          </View>
        ) : null}

        {/* Form per step */}
        <View style={styles.form}>
          {step === "email" ? (
            <StyledInput
              icon="mail"
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={() => handleSendOtp(false)}
            />
          ) : null}

          {step === "otp" ? (
            <>
              <View style={styles.otpRow}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <TextInput
                    key={i}
                    ref={(r) => {
                      otpRefs.current[i] = r;
                    }}
                    style={[
                      styles.otpInput,
                      {
                        backgroundColor: colors.card,
                        borderColor: otp[i] ? colors.gold : colors.border,
                        color: colors.foreground,
                      },
                    ]}
                    value={otp[i] ?? ""}
                    onChangeText={(v) => handleOtpDigit(i, v)}
                    onKeyPress={({ nativeEvent }) => {
                      if (nativeEvent.key === "Backspace") handleOtpBackspace(i);
                    }}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    autoComplete="sms-otp"
                  />
                ))}
              </View>

              <Pressable
                disabled={resendIn > 0 || loading}
                onPress={() => handleSendOtp(true)}
                style={styles.resendWrap}
              >
                <Text
                  style={[
                    styles.resendText,
                    { color: resendIn > 0 ? colors.textMuted : colors.gold },
                  ]}
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                </Text>
              </Pressable>
            </>
          ) : null}

          {step === "newPassword" ? (
            <>
              <StyledInput
                icon="lock"
                placeholder="New password (min 8 chars)"
                value={newPw}
                onChangeText={setNewPw}
                secureTextEntry={!showPw}
                returnKeyType="next"
                rightIcon={showPw ? "eye-off" : "eye"}
                onRightIconPress={() => setShowPw((v) => !v)}
              />
              <StyledInput
                icon="lock"
                placeholder="Confirm new password"
                value={confirmPw}
                onChangeText={setConfirmPw}
                secureTextEntry={!showPw}
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
              />
            </>
          ) : null}

          {error ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: "rgba(231,76,60,0.1)", borderColor: "rgba(231,76,60,0.3)" },
              ]}
            >
              <Feather name="alert-circle" size={14} color={colors.red} />
              <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>
            </View>
          ) : null}

          {step === "done" ? (
            <Pressable
              onPress={() => router.replace("/(auth)/login")}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.gold, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
                Back to Sign In
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={
                step === "email"
                  ? () => handleSendOtp(false)
                  : step === "otp"
                    ? handleVerifyOtp
                    : handleResetPassword
              }
              disabled={loading}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.gold, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
                  {step === "email"
                    ? "Send code"
                    : step === "otp"
                      ? "Verify code"
                      : "Reset password"}
                </Text>
              )}
            </Pressable>
          )}

          {step === "email" ? (
            <View
              style={[styles.infoNote, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather name="info" size={13} color={colors.goldDim} />
              <Text style={[styles.infoText, { color: colors.textMuted }]}>
                We won't reveal whether an account exists for security. Check spam folder if you
                don't see the email.
              </Text>
            </View>
          ) : null}
        </View>

        {step !== "done" ? (
          <Pressable onPress={() => router.push("/(auth)/login")} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.textSecondary }]}>
              Remember your password?{" "}
              <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold" }}>Sign in</Text>
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  header: { alignItems: "center", marginBottom: 20 },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
    textAlign: "center",
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  steps: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 24,
  },
  stepDot: { height: 8, borderRadius: 4 },
  form: { gap: 12, marginBottom: 24 },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  otpInput: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  resendWrap: { alignItems: "center", paddingVertical: 6 },
  resendText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  btn: {
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  infoText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 16,
  },
  link: { alignItems: "center", marginTop: 8 },
  linkText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
