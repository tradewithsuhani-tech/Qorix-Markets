import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const BRAND_PURPLE = "#A855F7";
const BRAND_PINK = "#EC4899";
const BRAND_BLUE = "#60A5FA";
const ACCENT_GOLD = "#EAB308";

function hexToRgba(hex: string, alpha: number) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function getStrength(pwd: string) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}

const STRENGTH_META = [
  { label: "Too weak", color: "#6B7280" },
  { label: "Weak", color: "#EF4444" },
  { label: "Fair", color: "#EAB308" },
  { label: "Strong", color: "#22C55E" },
  { label: "Excellent", color: "#22C55E" },
];

export default function ChangePasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const strength = getStrength(next);
  const meta = STRENGTH_META[strength];

  const checks = useMemo(
    () => [
      { ok: next.length >= 8, label: "At least 8 characters" },
      { ok: /[A-Z]/.test(next) && /[a-z]/.test(next), label: "Upper & lowercase letters" },
      { ok: /\d/.test(next), label: "At least one number" },
      { ok: /[^A-Za-z0-9]/.test(next), label: "One special character" },
    ],
    [next]
  );

  const errors = useMemo(() => {
    const e: Record<string, string | null> = {};
    e.current = current.length >= 6 ? null : "Enter your current password";
    e.next =
      next.length < 8
        ? "Minimum 8 characters"
        : strength < 2
          ? "Password is too weak"
          : null;
    e.confirm = confirm === next && confirm.length > 0 ? null : "Passwords don't match";
    return e;
  }, [current, next, confirm, strength]);

  const isValid = Object.values(errors).every((x) => x === null);

  const handleSubmit = async () => {
    setAttempted(true);
    setTouched({ current: true, next: true, confirm: true });
    if (!isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const fieldShow = (k: string) => attempted && touched[k];

  const renderField = (
    key: string,
    label: string,
    value: string,
    onChange: (s: string) => void,
    placeholder: string,
    show: boolean,
    setShow: ((v: boolean) => void) | null,
    accent: string
  ) => {
    const err = errors[key];
    const showErr = fieldShow(key) && err;
    const isOk = !err && value.length > 0;
    return (
      <View style={{ gap: 6 }}>
        <View style={styles.fieldHead}>
          <LinearGradient
            colors={[hexToRgba(accent, 0.32), hexToRgba(accent, 0.1)]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[styles.fieldIcon, { borderColor: hexToRgba(accent, 0.4) }]}
          >
            <Feather name="lock" size={13} color="#fff" />
          </LinearGradient>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
          {isOk && <Feather name="check-circle" size={13} color={colors.green} />}
        </View>
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: "rgba(255,255,255,0.03)",
              borderColor: showErr
                ? hexToRgba(colors.red, 0.5)
                : isOk
                  ? hexToRgba(colors.green, 0.4)
                  : "rgba(255,255,255,0.08)",
            },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            style={[styles.input, { color: colors.foreground }]}
          />
          {setShow && (
            <Pressable
              onPress={() => setShow(!show)}
              hitSlop={8}
              style={styles.eyeBtn}
            >
              <Feather
                name={show ? "eye-off" : "eye"}
                size={16}
                color={colors.textMuted}
              />
            </Pressable>
          )}
        </View>
        {showErr && <Text style={[styles.errText, { color: colors.red }]}>{err}</Text>}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
          ]}
          hitSlop={8}
        >
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Change Password
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 140 },
        ]}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <View
            style={[
              styles.heroCard,
              { backgroundColor: "#11161E", borderColor: hexToRgba(BRAND_PURPLE, 0.3) },
            ]}
          >
            <LinearGradient
              colors={[hexToRgba(BRAND_PURPLE, 0.16), "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View pointerEvents="none" style={[styles.glow, { backgroundColor: BRAND_PINK }]} />
            <View style={[styles.heroIcon, { backgroundColor: hexToRgba(BRAND_PURPLE, 0.18) }]}>
              <Feather name="shield" size={20} color={BRAND_PURPLE} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Update password
            </Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
              You'll be signed out of all other devices after a successful change.
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(60)} style={styles.fieldCard}>
          {renderField(
            "current",
            "Current Password",
            current,
            setCurrent,
            "Enter current password",
            showCurrent,
            setShowCurrent,
            BRAND_BLUE
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(110)} style={styles.fieldCard}>
          {renderField(
            "next",
            "New Password",
            next,
            setNext,
            "Create strong password",
            showNext,
            setShowNext,
            BRAND_PURPLE
          )}

          {next.length > 0 && (
            <View style={{ gap: 8 }}>
              <View style={styles.strengthBars}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          i < strength
                            ? meta.color
                            : "rgba(255,255,255,0.08)",
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.strengthLbl, { color: colors.textMuted }]}>
                  STRENGTH
                </Text>
                <Text style={[styles.strengthVal, { color: meta.color }]}>
                  {meta.label}
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                {checks.map((c, i) => (
                  <View key={i} style={styles.checkRow}>
                    <Feather
                      name={c.ok ? "check-circle" : "circle"}
                      size={12}
                      color={c.ok ? colors.green : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.checkText,
                        { color: c.ok ? colors.foreground : colors.textMuted },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(160)} style={styles.fieldCard}>
          {renderField(
            "confirm",
            "Confirm New Password",
            confirm,
            setConfirm,
            "Re-enter new password",
            showNext,
            null,
            BRAND_PINK
          )}
        </Animated.View>

        <View
          style={[
            styles.consentCard,
            { borderColor: hexToRgba(ACCENT_GOLD, 0.25), backgroundColor: hexToRgba(ACCENT_GOLD, 0.06) },
          ]}
        >
          <Feather name="alert-triangle" size={13} color={ACCENT_GOLD} />
          <Text style={[styles.consentText, { color: colors.textSecondary }]}>
            Use a unique password you don't reuse anywhere else. Avoid your name, DOB, or PAN.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.ctaWrap,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: colors.background,
            borderTopColor: "rgba(255,255,255,0.06)",
          },
        ]}
      >
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            styles.ctaBtn,
            { opacity: pressed || submitting ? 0.85 : 1 },
          ]}
        >
          <LinearGradient
            colors={isValid ? [BRAND_PURPLE, BRAND_PINK] : ["#2A2F38", "#2A2F38"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.ctaText}>Update password</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  content: { paddingHorizontal: 16, gap: 14 },

  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
    position: "relative",
    gap: 10,
  },
  glow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 100,
    top: -100,
    right: -50,
    opacity: 0.08,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    zIndex: 1,
  },
  heroTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3, zIndex: 1 },
  heroSub: { fontSize: 12.5, fontFamily: "Inter_500Medium", lineHeight: 18, zIndex: 1 },

  fieldCard: {
    backgroundColor: "#11161E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 14,
    gap: 12,
  },
  fieldHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  fieldIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  fieldLabel: { flex: 1, fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  eyeBtn: { paddingLeft: 8 },
  errText: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginLeft: 4 },

  strengthBars: { flexDirection: "row", gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLbl: { fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  strengthVal: { fontSize: 11, fontFamily: "Inter_700Bold" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  checkText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  consentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  consentText: { flex: 1, fontSize: 11, fontFamily: "Inter_500Medium", lineHeight: 16 },

  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  ctaBtn: { borderRadius: 14, overflow: "hidden" },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
  },
  ctaText: { fontSize: 14.5, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.2 },
});
