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

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const BRAND_PURPLE = "#A855F7";
const BRAND_PINK = "#EC4899";
const BRAND_BLUE = "#60A5FA";

function hexToRgba(hex: string, alpha: number) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^\d{9,18}$/;

const BANK_HINTS: Record<string, string> = {
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  SBIN: "State Bank of India",
  AXIS: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  UTIB: "Axis Bank",
  PUNB: "Punjab National Bank",
  YESB: "Yes Bank",
  IDFB: "IDFC First Bank",
  INDB: "IndusInd Bank",
  BARB: "Bank of Baroda",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
};

export default function AddBankScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, addLinkedBank } = useAuth();
  const accountHolder = user?.name ?? "";

  const [accountNo, setAccountNo] = useState("");
  const [confirmAcc, setConfirmAcc] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);

  const detectedBank = useMemo(() => {
    const code = ifsc.trim().toUpperCase().slice(0, 4);
    return BANK_HINTS[code] ?? null;
  }, [ifsc]);

  const errors = useMemo(() => {
    const e: Record<string, string | null> = {};
    e.accountNo = ACCOUNT_RE.test(accountNo.trim())
      ? null
      : "9–18 digit account number";
    e.confirmAcc =
      confirmAcc.trim() === accountNo.trim() && confirmAcc.length > 0
        ? null
        : "Account numbers don't match";
    e.ifsc = IFSC_RE.test(ifsc.trim().toUpperCase())
      ? null
      : "Format: HDFC0001234";
    return e;
  }, [accountNo, confirmAcc, ifsc]);

  const isValid = Object.values(errors).every((x) => x === null);
  const completed = Object.values(errors).filter((x) => x === null).length;
  const total = 3;
  const progress = (completed / total) * 100;

  const fieldShow = (k: string) => attempted && touched[k];

  const topPadding = insets.top + (Platform.OS === "web" ? 16 : 16);

  const handleSubmit = async () => {
    // Linked-bank persistence endpoint is not yet live (next sprint).
    // Show a clear "coming soon" so users don't think the bank was saved.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // Use Alert for native parity with the rest of the mobile flow.
    // eslint-disable-next-line no-alert
    (require("react-native") as typeof import("react-native")).Alert.alert(
      "Bank linking coming soon",
      "We're securing the bank-verification pipeline (penny-drop + name match). It will go live within 48 hours and you'll be notified.",
      [{ text: "Got it" }]
    );
    return;
    // eslint-disable-next-line no-unreachable
    setAttempted(true);
    setTouched({ accountNo: true, confirmAcc: true, ifsc: true });
    if (!isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await new Promise((r) => setTimeout(r, 800));
      await addLinkedBank({
        bankName: detectedBank ?? "Bank",
        accountNumber: accountNo.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        accountHolder,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (
    key: string,
    label: string,
    icon: keyof typeof Feather.glyphMap,
    accent: string,
    value: string,
    onChange: (s: string) => void,
    placeholder: string,
    opts: {
      autoCapitalize?: "characters" | "none";
      keyboardType?: "default" | "number-pad";
      maxLength?: number;
      hint?: string;
    } = {}
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
            <Feather name={icon} size={13} color="#fff" />
          </LinearGradient>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
          {isOk && <Feather name="check-circle" size={13} color={colors.green} />}
        </View>
        <TextInput
          value={value}
          onChangeText={onChange}
          onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize={opts.autoCapitalize ?? "none"}
          keyboardType={opts.keyboardType ?? "default"}
          maxLength={opts.maxLength}
          editable={!submitting}
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: "rgba(255,255,255,0.03)",
              borderColor: showErr
                ? hexToRgba(colors.red, 0.5)
                : isOk
                  ? hexToRgba(colors.green, 0.4)
                  : "rgba(255,255,255,0.08)",
            },
          ]}
        />
        {showErr ? (
          <Text style={[styles.errText, { color: colors.red }]}>{err}</Text>
        ) : opts.hint ? (
          <Text style={[styles.hintText, { color: colors.textMuted }]}>{opts.hint}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: topPadding }]}>
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
          Add Bank Account
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
        {/* Coming-soon banner — submission is disabled until backend pipeline ships. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: hexToRgba("#EAB308", 0.4),
            backgroundColor: hexToRgba("#EAB308", 0.08),
            marginBottom: 4,
          }}
        >
          <Feather name="clock" size={16} color="#EAB308" />
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              lineHeight: 17,
              color: colors.foreground,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            Bank linking is launching soon. You can preview the form, but accounts aren't saved yet.
          </Text>
        </View>

        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View
            style={[
              styles.heroCard,
              { backgroundColor: "#11161E", borderColor: hexToRgba(BRAND_BLUE, 0.32) },
            ]}
          >
            <LinearGradient
              colors={[hexToRgba(BRAND_BLUE, 0.16), "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View pointerEvents="none" style={[styles.heroGlow, { backgroundColor: BRAND_PURPLE }]} />
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Link a new bank
            </Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
              Verified instantly via penny-drop. No physical document required.
            </Text>
            <View style={styles.progressBarWrap}>
              <View style={styles.progressBarLabels}>
                <Text style={[styles.progressLbl, { color: colors.textMuted }]}>
                  PROGRESS
                </Text>
                <Text style={[styles.progressVal, { color: colors.foreground }]}>
                  {completed} / {total}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                <LinearGradient
                  colors={[BRAND_BLUE, BRAND_PURPLE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progress}%` }]}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Account Holder — auto */}
        <Animated.View entering={FadeInDown.duration(400).delay(60)} style={styles.fieldCard}>
          <View style={styles.fieldHead}>
            <LinearGradient
              colors={[hexToRgba(BRAND_PURPLE, 0.32), hexToRgba(BRAND_PURPLE, 0.1)]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={[styles.fieldIcon, { borderColor: hexToRgba(BRAND_PURPLE, 0.4) }]}
            >
              <Feather name="user" size={13} color="#fff" />
            </LinearGradient>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Account Holder
            </Text>
            <View style={styles.lockPill}>
              <Feather name="lock" size={9} color={colors.textMuted} />
              <Text style={[styles.lockPillText, { color: colors.textMuted }]}>
                FROM KYC
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.input,
              styles.inputReadonly,
              {
                backgroundColor: "rgba(255,255,255,0.02)",
                borderColor: "rgba(255,255,255,0.06)",
              },
            ]}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
                fontFamily: "Inter_600SemiBold",
                letterSpacing: 0.3,
              }}
            >
              {accountHolder || "—"}
            </Text>
          </View>
          <Text style={[styles.hintText, { color: colors.textMuted }]}>
            Bank account name must match exactly
          </Text>
        </Animated.View>

        {/* Account number */}
        <Animated.View entering={FadeInDown.duration(400).delay(110)} style={styles.fieldCard}>
          {renderField(
            "accountNo",
            "Account Number",
            "home",
            BRAND_BLUE,
            accountNo,
            setAccountNo,
            "0123456789012",
            { keyboardType: "number-pad", maxLength: 18 }
          )}
          {renderField(
            "confirmAcc",
            "Confirm Account Number",
            "check-circle",
            BRAND_BLUE,
            confirmAcc,
            setConfirmAcc,
            "Re-enter account number",
            { keyboardType: "number-pad", maxLength: 18 }
          )}
        </Animated.View>

        {/* IFSC */}
        <Animated.View entering={FadeInDown.duration(400).delay(160)} style={styles.fieldCard}>
          {renderField(
            "ifsc",
            "IFSC Code",
            "hash",
            BRAND_PINK,
            ifsc,
            (s) => setIfsc(s.toUpperCase()),
            "HDFC0001234",
            {
              autoCapitalize: "characters",
              maxLength: 11,
              hint: "11-character bank branch code",
            }
          )}
          {detectedBank && (
            <View
              style={[
                styles.detectedCard,
                {
                  backgroundColor: hexToRgba(colors.green, 0.08),
                  borderColor: hexToRgba(colors.green, 0.3),
                },
              ]}
            >
              <Feather name="check-circle" size={13} color={colors.green} />
              <Text style={[styles.detectedText, { color: colors.foreground }]}>
                Detected: <Text style={{ fontFamily: "Inter_700Bold" }}>{detectedBank}</Text>
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Penny drop info */}
        <View
          style={[
            styles.consentCard,
            { borderColor: "rgba(96,165,250,0.25)", backgroundColor: "rgba(96,165,250,0.06)" },
          ]}
        >
          <Feather name="zap" size={13} color={BRAND_BLUE} />
          <Text style={[styles.consentText, { color: colors.textSecondary }]}>
            ₹1 will be deposited & instantly refunded to verify ownership. Usually takes &lt;30 seconds.
          </Text>
        </View>
      </ScrollView>

      {/* CTA */}
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
            colors={isValid ? [BRAND_BLUE, BRAND_PURPLE] : ["#2A2F38", "#2A2F38"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="link" size={16} color="#fff" />
                <Text style={styles.ctaText}>
                  {isValid ? "Verify & link bank" : `Complete ${total - completed} more`}
                </Text>
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
    gap: 14,
  },
  heroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 100,
    top: -100,
    right: -50,
    opacity: 0.08,
  },
  heroTitle: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3, zIndex: 1 },
  heroSub: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17, zIndex: 1 },
  progressBarWrap: { gap: 7, zIndex: 1 },
  progressBarLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressLbl: { fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  progressVal: { fontSize: 11, fontFamily: "Inter_700Bold" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },

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
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  inputReadonly: { justifyContent: "center" },
  errText: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginLeft: 4 },
  hintText: { fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: 4 },

  lockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  lockPillText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },

  detectedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  detectedText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },

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
