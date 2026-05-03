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

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signup } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const handleSignup = async () => {
    setError("");
    if (!name || !email || !phone || !password) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await signup(name, email, phone, password, referral, captchaToken ?? undefined);
    setLoading(false);
    setCaptchaToken(null);
    if (!result.success) {
      setError(result.error ?? "Signup failed");
    }
    // On success, AuthContext sets isAuthenticated; root layout redirects to home.
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
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
          <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Start your automated trading journey
          </Text>
        </View>

        <View style={styles.form}>
          <StyledInput
            icon="user"
            placeholder="Full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
            autoComplete="name"
          />
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
            icon="phone"
            placeholder="Phone number (10 digits)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            returnKeyType="next"
            autoComplete="tel"
          />
          <StyledInput
            icon="lock"
            placeholder="Password (min 8 chars)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
            returnKeyType="next"
            autoComplete="new-password"
            rightIcon={showPw ? "eye-off" : "eye"}
            onRightIconPress={() => setShowPw((v) => !v)}
          />
          <StyledInput
            icon="gift"
            placeholder="Referral code (optional)"
            value={referral}
            onChangeText={(t) => setReferral(t.toUpperCase())}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={handleSignup}
            autoComplete="off"
          />

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
            onPress={handleSignup}
            disabled={loading}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.gold, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Continue</Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.kycNote, { backgroundColor: "rgba(201,168,76,0.06)", borderColor: colors.borderBright }]}>
          <Feather name="info" size={14} color={colors.gold} />
          <Text style={[styles.kycText, { color: colors.textSecondary }]}>
            KYC verification (Aadhaar + PAN) required before trading. Account activation within 24 hours.
          </Text>
        </View>

        <Pressable onPress={() => router.back()} style={styles.link}>
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            Already have an account?{" "}
            <Text style={{ color: colors.gold, fontFamily: "Inter_600SemiBold" }}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  header: { marginBottom: 28 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 6 },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular" },
  form: { gap: 12, marginBottom: 20 },
  errorBox: {
    flexDirection: "row", alignItems: "center",
    padding: 10, borderRadius: 8, borderWidth: 1, gap: 8,
  },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  btn: { height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  kycNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16,
  },
  kycText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  link: { alignItems: "center" },
  linkText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
