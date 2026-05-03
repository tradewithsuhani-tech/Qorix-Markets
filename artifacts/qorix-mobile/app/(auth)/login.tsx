import { Feather } from "@expo/vector-icons";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyledInput } from "@/components/StyledInput";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const handleDemoLogin = async () => {
    setError("");
    setDemoLoading(true);
    setEmail("demo@autotrader.in");
    setPassword("demo1234");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await login("demo@autotrader.in", "demo1234");
    setDemoLoading(false);
    if (!result.success) setError(result.error ?? "Demo login failed");
  };

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await login(email, password, captchaToken ?? undefined);
    setLoading(false);
    setCaptchaToken(null);
    if (!result.success) {
      setError(result.error ?? "Login failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.logoWrap, { borderColor: colors.borderBright, backgroundColor: "rgba(201,168,76,0.08)" }]}>
            <Feather name="activity" size={28} color={colors.gold} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Sign in to your trading account
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <StyledInput
            icon="mail"
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            autoComplete="email"
          />

          <StyledInput
            icon="lock"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            autoComplete="current-password"
            rightIcon={showPw ? "eye-off" : "eye"}
            onRightIconPress={() => setShowPw((v) => !v)}
          />

          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotWrap}
            hitSlop={8}
          >
            <Text style={[styles.forgotText, { color: colors.gold }]}>
              Forgot password?
            </Text>
          </Pressable>

          <TurnstileWidget
            onToken={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "rgba(231,76,60,0.1)", borderColor: "rgba(231,76,60,0.3)" }]}>
              <Feather name="alert-circle" size={14} color={colors.red} />
              <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={loading || demoLoading}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.gold, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Sign In</Text>
            )}
          </Pressable>

          {/* Demo Login */}
          <Pressable
            onPress={handleDemoLogin}
            disabled={demoLoading || loading}
            style={({ pressed }) => [
              styles.demoBtn,
              {
                backgroundColor: "rgba(201,168,76,0.08)",
                borderColor: colors.borderBright,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {demoLoading ? (
              <ActivityIndicator color={colors.gold} size="small" />
            ) : (
              <>
                <Feather name="zap" size={14} color={colors.gold} />
                <Text style={[styles.demoBtnText, { color: colors.gold }]}>
                  Try Demo Account
                </Text>
              </>
            )}
          </Pressable>

          <View style={[styles.divider, { borderColor: colors.border }]} />

          <Pressable onPress={() => router.push("/(auth)/signup")} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.textSecondary }]}>
              Don't have an account?{" "}
              <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold" }}>Create one</Text>
            </Text>
          </Pressable>
        </View>

        <View style={[styles.secNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="shield" size={13} color={colors.goldDim} />
          <Text style={[styles.secText, { color: colors.textMuted }]}>
            256-bit encrypted · JWT secured · 2FA enabled
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 36 },
  logoWrap: {
    width: 64, height: 64, borderRadius: 20, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 6 },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular" },
  form: { gap: 12, marginBottom: 24 },
  errorBox: {
    flexDirection: "row", alignItems: "center",
    padding: 10, borderRadius: 8, borderWidth: 1, gap: 8,
  },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  btn: {
    height: 54, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  demoBtn: {
    height: 50, borderRadius: 12, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  demoBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  divider: { borderTopWidth: 1, marginVertical: 4 },
  link: { alignItems: "center" },
  linkText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  forgotWrap: { alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 4 },
  forgotText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  secNote: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8,
  },
  secText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
