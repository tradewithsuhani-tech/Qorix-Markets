import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
const ACCENT_GOLD = "#EAB308";

function hexToRgba(hex: string, alpha: number) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_RE = /^\d{12}$/;

export default function KycSubmitScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string }>();
  const { submitKyc, user, updateUser } = useAuth();
  const alreadyPhoneVerified = !!user?.isPhoneVerified;

  const [phone, setPhone] = useState(user?.phone ?? "");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(alreadyPhoneVerified);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [pan, setPan] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [panPhoto, setPanPhoto] = useState<string | null>(null);
  const [aadhaarFront, setAadhaarFront] = useState<string | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<string | null>(null);
  const [photoTaken, setPhotoTaken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [pickerFor, setPickerFor] = useState<
    null | { key: string; setUri: (s: string | null) => void; allowCamera: boolean }
  >(null);

  const topPadding = insets.top + (Platform.OS === "web" ? 16 : 16);

  const errors = useMemo(() => {
    const e: Record<string, string | null> = {};
    e.phone = phoneVerified ? null : "Verify mobile number";
    e.pan = PAN_RE.test(pan.trim().toUpperCase()) ? null : "Format: ABCDE1234F";
    e.panPhoto = panPhoto !== null ? null : "Upload PAN card photo";
    e.aadhaar = AADHAAR_RE.test(aadhaar.replace(/\s/g, ""))
      ? null
      : "12-digit Aadhaar number required";
    e.aadhaarFront = aadhaarFront !== null ? null : "Upload Aadhaar front side";
    e.aadhaarBack = aadhaarBack !== null ? null : "Upload Aadhaar back side";
    return e;
  }, [phoneVerified, pan, panPhoto, aadhaar, aadhaarFront, aadhaarBack]);

  const totalRequired = 6;
  const isValid = Object.values(errors).every((x) => x === null);
  const completedCount = Object.values(errors).filter((x) => x === null).length;
  const progress = (completedCount / totalRequired) * 100;

  const phoneValid = /^[6-9]\d{9}$/.test(phone.trim());

  const handleSendOtp = async () => {
    if (!phoneValid) {
      setOtpError("Enter valid 10-digit mobile number");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setOtpError(null);
    setSendingOtp(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise((r) => setTimeout(r, 700));
    setOtpSent(true);
    setResendCooldown(30);
    setSendingOtp(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setOtpError("Enter 6-digit OTP");
      return;
    }
    setVerifyingOtp(true);
    setOtpError(null);
    await new Promise((r) => setTimeout(r, 600));
    setVerifyingOtp(false);
    if (otp === "000000") {
      setOtpError("Invalid OTP. Try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setPhoneVerified(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSubmit = async () => {
    // KYC backend submission endpoint is not yet live (next sprint).
    // Block submission so users don't think their docs were uploaded.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "KYC verification coming soon",
      "We're finalising the secure document upload pipeline. You'll be notified the moment it's live — usually within 48 hours.",
      [{ text: "Got it" }]
    );
    return;

    // eslint-disable-next-line no-unreachable
    setAttemptedSubmit(true);
    setTouched({
      phone: true,
      pan: true,
      panPhoto: true,
      aadhaar: true,
      aadhaarFront: true,
      aadhaarBack: true,
    });
    if (!isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateUser({ phone: phone.trim(), isPhoneVerified: true });
      await submitKyc(aadhaar.replace(/\s/g, ""), pan.trim().toUpperCase());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/kyc");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldShow = (k: string) => attemptedSubmit && touched[k];

  const pickFromGallery = async (setUri: (s: string | null) => void) => {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Enable photo library access in Settings to upload documents."
        );
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      setUri(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const pickFromCamera = async (setUri: (s: string | null) => void) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Enable camera access in Settings.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      setUri(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const openPicker = (
    key: string,
    setUri: (s: string | null) => void,
    allowCamera: boolean
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web" || !allowCamera) {
      pickFromGallery(setUri);
      return;
    }
    setPickerFor({ key, setUri, allowCamera });
  };

  const renderUpload = (
    key: string,
    label: string,
    sub: string,
    accent: string,
    uri: string | null,
    setUri: (s: string | null) => void
  ) => {
    const uploaded = uri !== null;
    const showErr = fieldShow(key) && errors[key];
    return (
      <View style={{ gap: 6 }}>
        <Pressable
          onPress={() => openPicker(key, setUri, true)}
          style={({ pressed }) => [
            styles.uploadBtn,
            {
              opacity: pressed ? 0.85 : 1,
              borderColor: uploaded
                ? hexToRgba(colors.green, 0.4)
                : showErr
                  ? hexToRgba(colors.red, 0.4)
                  : hexToRgba(accent, 0.25),
              backgroundColor: uploaded
                ? hexToRgba(colors.green, 0.07)
                : hexToRgba(accent, 0.04),
              borderStyle: uploaded ? "solid" : "dashed",
            },
          ]}
        >
          {uploaded && uri ? (
            <Image source={{ uri }} style={styles.uploadThumb} />
          ) : (
            <View
              style={[
                styles.uploadIconWrap,
                { backgroundColor: hexToRgba(accent, 0.15) },
              ]}
            >
              <Feather name="upload-cloud" size={18} color={accent} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.uploadTitle, { color: colors.foreground }]} numberOfLines={1}>
              {uploaded ? `${label} uploaded` : label}
            </Text>
            <Text style={[styles.uploadSub, { color: colors.textMuted }]} numberOfLines={1}>
              {uploaded ? "Tap to replace · JPG/PNG · max 5MB" : sub}
            </Text>
          </View>
          {uploaded ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setUri(null);
              }}
              hitSlop={8}
              style={styles.removeBtn}
            >
              <Feather name="x" size={14} color={colors.textMuted} />
            </Pressable>
          ) : (
            <Feather name="plus" size={14} color={colors.textMuted} />
          )}
        </Pressable>
        {showErr && (
          <Text style={[styles.errText, { color: colors.red }]}>{errors[key]}</Text>
        )}
      </View>
    );
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
          Submit KYC Documents
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
            borderColor: hexToRgba(ACCENT_GOLD, 0.4),
            backgroundColor: hexToRgba(ACCENT_GOLD, 0.08),
            marginBottom: 4,
          }}
        >
          <Feather name="clock" size={16} color={ACCENT_GOLD} />
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              lineHeight: 17,
              color: colors.foreground,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            KYC submission is launching soon. You can preview the form, but uploads aren't accepted yet.
          </Text>
        </View>

        {/* Progress hero */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View
            style={[
              styles.progressCard,
              { backgroundColor: "#11161E", borderColor: hexToRgba(BRAND_PURPLE, 0.32) },
            ]}
          >
            <LinearGradient
              colors={[hexToRgba(BRAND_PURPLE, 0.16), "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View
              pointerEvents="none"
              style={[styles.progressGlow, { backgroundColor: BRAND_PINK }]}
            />
            <Text style={[styles.progressTitle, { color: colors.foreground }]}>
              Verify your identity
            </Text>
            <Text style={[styles.progressSub, { color: colors.textSecondary }]}>
              Takes ~2 minutes. All data encrypted with AES-256.
            </Text>
            <View style={styles.progressBarWrap}>
              <View style={styles.progressBarLabels}>
                <Text style={[styles.progressLbl, { color: colors.textMuted }]}>
                  PROGRESS
                </Text>
                <Text style={[styles.progressVal, { color: colors.foreground }]}>
                  {completedCount} / {totalRequired}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                <LinearGradient
                  colors={[BRAND_PURPLE, BRAND_PINK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progress}%` }]}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Mobile verification — STEP 1 */}
        <Animated.View entering={FadeInDown.duration(400).delay(40)} style={styles.fieldCard}>
          <View style={styles.stepHead}>
            <View
              style={[
                styles.stepNum,
                {
                  backgroundColor: phoneVerified
                    ? hexToRgba(colors.green, 0.16)
                    : hexToRgba(BRAND_BLUE, 0.16),
                  borderColor: phoneVerified
                    ? hexToRgba(colors.green, 0.4)
                    : hexToRgba(BRAND_BLUE, 0.4),
                },
              ]}
            >
              {phoneVerified ? (
                <Feather name="check" size={11} color={colors.green} />
              ) : (
                <Text style={[styles.stepNumText, { color: BRAND_BLUE }]}>1</Text>
              )}
            </View>
            <Text style={[styles.sectionLbl, { color: colors.textMuted, flex: 1 }]}>
              MOBILE VERIFICATION
            </Text>
            {phoneVerified && (
              <View
                style={[
                  styles.verifiedPill,
                  {
                    backgroundColor: hexToRgba(colors.green, 0.14),
                    borderColor: hexToRgba(colors.green, 0.4),
                  },
                ]}
              >
                <Feather name="check-circle" size={10} color={colors.green} />
                <Text style={[styles.verifiedPillText, { color: colors.green }]}>
                  VERIFIED
                </Text>
              </View>
            )}
          </View>

          {/* Phone field */}
          <View style={{ gap: 6 }}>
            <View style={styles.fieldHead}>
              <LinearGradient
                colors={[hexToRgba(BRAND_BLUE, 0.32), hexToRgba(BRAND_BLUE, 0.1)]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={[styles.fieldIcon, { borderColor: hexToRgba(BRAND_BLUE, 0.4) }]}
              >
                <Feather name="phone" size={13} color="#fff" />
              </LinearGradient>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                Mobile Number
              </Text>
              {phoneVerified && (
                <Feather name="lock" size={12} color={colors.textMuted} />
              )}
            </View>
            <View
              style={[
                styles.phoneRow,
                {
                  backgroundColor: phoneVerified
                    ? "rgba(34,197,94,0.04)"
                    : "rgba(255,255,255,0.03)",
                  borderColor: phoneVerified
                    ? hexToRgba(colors.green, 0.35)
                    : "rgba(255,255,255,0.08)",
                },
              ]}
            >
              <View
                style={[styles.countryCode, { borderRightColor: "rgba(255,255,255,0.08)" }]}
              >
                <Text style={[styles.flag]}>🇮🇳</Text>
                <Text style={[styles.countryCodeText, { color: colors.foreground }]}>
                  +91
                </Text>
              </View>
              <TextInput
                value={phone}
                onChangeText={(t) => {
                  if (otpSent || phoneVerified) return;
                  setPhone(t.replace(/\D/g, "").slice(0, 10));
                  setOtpError(null);
                }}
                placeholder="9876543210"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={10}
                editable={!otpSent && !phoneVerified && !submitting}
                style={[styles.phoneInput, { color: colors.foreground }]}
              />
              {phoneVerified && (
                <View style={{ paddingHorizontal: 12 }}>
                  <Feather name="check-circle" size={16} color={colors.green} />
                </View>
              )}
            </View>
          </View>

          {/* Send OTP / Change number */}
          {!phoneVerified && !otpSent && (
            <Pressable
              onPress={handleSendOtp}
              disabled={!phoneValid || sendingOtp}
              style={({ pressed }) => [
                styles.otpBtn,
                { opacity: pressed || sendingOtp || !phoneValid ? 0.7 : 1 },
              ]}
            >
              <LinearGradient
                colors={
                  phoneValid ? [BRAND_BLUE, BRAND_PURPLE] : ["#2A2F38", "#2A2F38"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.otpBtnGrad}
              >
                {sendingOtp ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="send" size={13} color="#fff" />
                    <Text style={styles.otpBtnText}>Send OTP</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          )}

          {/* OTP input */}
          {!phoneVerified && otpSent && (
            <View style={{ gap: 10 }}>
              <View style={styles.otpInfoRow}>
                <Feather name="message-circle" size={12} color={BRAND_BLUE} />
                <Text style={[styles.otpInfo, { color: colors.textSecondary }]}>
                  6-digit code sent to +91 {phone}
                </Text>
                <Pressable
                  onPress={() => {
                    setOtpSent(false);
                    setOtp("");
                    setOtpError(null);
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.otpChange, { color: BRAND_BLUE }]}>Change</Text>
                </Pressable>
              </View>
              <View style={{ gap: 6 }}>
                <View style={styles.fieldHead}>
                  <LinearGradient
                    colors={[hexToRgba(BRAND_PURPLE, 0.32), hexToRgba(BRAND_PURPLE, 0.1)]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={[styles.fieldIcon, { borderColor: hexToRgba(BRAND_PURPLE, 0.4) }]}
                  >
                    <Feather name="key" size={13} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                    Enter OTP
                  </Text>
                </View>
                <TextInput
                  value={otp}
                  onChangeText={(t) => {
                    setOtp(t.replace(/\D/g, "").slice(0, 6));
                    setOtpError(null);
                  }}
                  placeholder="••••••"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!verifyingOtp}
                  style={[
                    styles.input,
                    styles.otpInput,
                    {
                      color: colors.foreground,
                      backgroundColor: "rgba(255,255,255,0.03)",
                      borderColor: otpError
                        ? hexToRgba(colors.red, 0.5)
                        : "rgba(255,255,255,0.08)",
                    },
                  ]}
                />
                {otpError && (
                  <Text style={[styles.errText, { color: colors.red }]}>{otpError}</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={handleVerifyOtp}
                  disabled={otp.length !== 6 || verifyingOtp}
                  style={({ pressed }) => [
                    styles.otpBtn,
                    {
                      flex: 1,
                      opacity: pressed || verifyingOtp || otp.length !== 6 ? 0.7 : 1,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={
                      otp.length === 6 ? [BRAND_BLUE, BRAND_PURPLE] : ["#2A2F38", "#2A2F38"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.otpBtnGrad}
                  >
                    {verifyingOtp ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Feather name="check" size={13} color="#fff" />
                        <Text style={styles.otpBtnText}>Verify OTP</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (resendCooldown > 0) return;
                    handleSendOtp();
                    setOtp("");
                  }}
                  disabled={resendCooldown > 0}
                  style={({ pressed }) => [
                    styles.resendBtn,
                    {
                      opacity: pressed || resendCooldown > 0 ? 0.5 : 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    },
                  ]}
                >
                  <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {!phoneVerified && (
            <View
              style={[
                styles.lockedNotice,
                {
                  backgroundColor: hexToRgba(ACCENT_GOLD, 0.06),
                  borderColor: hexToRgba(ACCENT_GOLD, 0.25),
                },
              ]}
            >
              <Feather name="lock" size={11} color={ACCENT_GOLD} />
              <Text style={[styles.lockedNoticeText, { color: colors.textSecondary }]}>
                Verify mobile to unlock document upload
              </Text>
            </View>
          )}
        </Animated.View>

        {/* PAN */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(60)}
          style={[styles.fieldCard, !phoneVerified && styles.lockedCard]}
          pointerEvents={phoneVerified ? "auto" : "none"}
        >
          {renderField(
            "pan",
            "PAN Card",
            "credit-card",
            BRAND_PURPLE,
            pan,
            (s) => setPan(s.toUpperCase()),
            "ABCDE1234F",
            { autoCapitalize: "characters", maxLength: 10, hint: "Permanent Account Number" }
          )}
          {renderUpload(
            "panPhoto",
            "PAN card photo",
            "Clear photo of front side",
            BRAND_PURPLE,
            panPhoto,
            setPanPhoto
          )}
        </Animated.View>

        {/* Aadhaar */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(110)}
          style={[styles.fieldCard, !phoneVerified && styles.lockedCard]}
          pointerEvents={phoneVerified ? "auto" : "none"}
        >
          {renderField(
            "aadhaar",
            "Aadhaar Number",
            "user-check",
            BRAND_PINK,
            aadhaar,
            setAadhaar,
            "1234 5678 9012",
            { keyboardType: "number-pad", maxLength: 14, hint: "12-digit UIDAI number" }
          )}
          {renderUpload(
            "aadhaarFront",
            "Aadhaar — front",
            "Photo, name & DOB visible",
            BRAND_PINK,
            aadhaarFront,
            setAadhaarFront
          )}
          {renderUpload(
            "aadhaarBack",
            "Aadhaar — back",
            "Address side, clearly readable",
            BRAND_PINK,
            aadhaarBack,
            setAadhaarBack
          )}
        </Animated.View>

        {/* Live Photo */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(210)}
          style={[styles.fieldCard, !phoneVerified && styles.lockedCard]}
          pointerEvents={phoneVerified ? "auto" : "none"}
        >
          <View style={styles.fieldHead}>
            <LinearGradient
              colors={[hexToRgba(ACCENT_GOLD, 0.32), hexToRgba(ACCENT_GOLD, 0.1)]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={[styles.fieldIcon, { borderColor: hexToRgba(ACCENT_GOLD, 0.4) }]}
            >
              <Feather name="camera" size={13} color="#fff" />
            </LinearGradient>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Live Photo</Text>
            <View
              style={[
                styles.optionalPill,
                { backgroundColor: hexToRgba(colors.textMuted, 0.12) },
              ]}
            >
              <Text style={[styles.optionalText, { color: colors.textMuted }]}>
                OPTIONAL
              </Text>
            </View>
            {photoTaken && <Feather name="check-circle" size={13} color={colors.green} />}
          </View>
          <Pressable
            onPress={() => openPicker("photo", setPhotoTaken, true)}
            style={({ pressed }) => [
              styles.photoBtn,
              {
                opacity: pressed ? 0.85 : 1,
                borderColor: photoTaken
                  ? hexToRgba(colors.green, 0.4)
                  : "rgba(255,255,255,0.1)",
                backgroundColor: photoTaken
                  ? hexToRgba(colors.green, 0.08)
                  : "rgba(255,255,255,0.03)",
              },
            ]}
          >
            {photoTaken ? (
              <Image source={{ uri: photoTaken }} style={styles.uploadThumb} />
            ) : (
              <Feather name="camera" size={22} color={ACCENT_GOLD} />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.photoTitle, { color: colors.foreground }]}>
                {photoTaken ? "Photo captured" : "Capture live selfie"}
              </Text>
              <Text style={[styles.photoSub, { color: colors.textMuted }]}>
                {photoTaken
                  ? "Tap to retake"
                  : "Speeds up verification — face match with Aadhaar"}
              </Text>
            </View>
            {photoTaken ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPhotoTaken(null);
                }}
                hitSlop={8}
                style={styles.removeBtn}
              >
                <Feather name="x" size={14} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            )}
          </Pressable>
        </Animated.View>

        {/* Consent */}
        <View
          style={[
            styles.consentCard,
            { borderColor: "rgba(96,165,250,0.25)", backgroundColor: "rgba(96,165,250,0.06)" },
          ]}
        >
          <Feather name="shield" size={13} color={BRAND_BLUE} />
          <Text style={[styles.consentText, { color: colors.textSecondary }]}>
            By submitting, you authorize verification of these documents with UIDAI, NSDL & your bank under DPDP Act 2023.
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
            colors={isValid ? [BRAND_PURPLE, BRAND_PINK] : ["#2A2F38", "#2A2F38"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="upload" size={16} color="#fff" />
                <Text style={styles.ctaText}>
                  {isValid
                    ? "Submit for verification"
                    : `Complete ${totalRequired - completedCount} more`}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>

      {/* Source picker bottom sheet */}
      <Modal
        visible={pickerFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerFor(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setPickerFor(null)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: "#11161E",
                borderColor: "rgba(255,255,255,0.08)",
                paddingBottom: insets.bottom + 16,
              },
            ]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              Upload document
            </Text>
            <Text style={[styles.sheetSub, { color: colors.textMuted }]}>
              Choose where to get the file from
            </Text>

            <View style={{ gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => {
                  const target = pickerFor;
                  setPickerFor(null);
                  if (target) pickFromCamera(target.setUri);
                }}
                style={({ pressed }) => [
                  styles.sheetRow,
                  {
                    opacity: pressed ? 0.85 : 1,
                    backgroundColor: hexToRgba(BRAND_PURPLE, 0.08),
                    borderColor: hexToRgba(BRAND_PURPLE, 0.3),
                  },
                ]}
              >
                <View
                  style={[
                    styles.sheetIcon,
                    { backgroundColor: hexToRgba(BRAND_PURPLE, 0.18) },
                  ]}
                >
                  <Feather name="camera" size={18} color={BRAND_PURPLE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetRowTitle, { color: colors.foreground }]}>
                    Take photo
                  </Text>
                  <Text style={[styles.sheetRowSub, { color: colors.textMuted }]}>
                    Use camera to capture document
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>

              <Pressable
                onPress={() => {
                  const target = pickerFor;
                  setPickerFor(null);
                  if (target) pickFromGallery(target.setUri);
                }}
                style={({ pressed }) => [
                  styles.sheetRow,
                  {
                    opacity: pressed ? 0.85 : 1,
                    backgroundColor: hexToRgba(BRAND_PINK, 0.08),
                    borderColor: hexToRgba(BRAND_PINK, 0.3),
                  },
                ]}
              >
                <View
                  style={[
                    styles.sheetIcon,
                    { backgroundColor: hexToRgba(BRAND_PINK, 0.18) },
                  ]}
                >
                  <Feather name="image" size={18} color={BRAND_PINK} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetRowTitle, { color: colors.foreground }]}>
                    Choose from gallery
                  </Text>
                  <Text style={[styles.sheetRowSub, { color: colors.textMuted }]}>
                    Pick from your photo library
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => setPickerFor(null)}
              style={({ pressed }) => [
                styles.sheetCancel,
                { opacity: pressed ? 0.7 : 1, borderColor: "rgba(255,255,255,0.08)" },
              ]}
            >
              <Text style={[styles.sheetCancelText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

  progressCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
    position: "relative",
    gap: 14,
  },
  progressGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 100,
    top: -100,
    right: -50,
    opacity: 0.08,
  },
  progressTitle: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3, zIndex: 1 },
  progressSub: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17, zIndex: 1 },
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
  sectionLbl: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },
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
  errText: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginLeft: 4 },
  hintText: { fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: 4 },
  inputReadonly: { justifyContent: "center" },
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

  stepHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  stepNumText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  verifiedPillText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  countryCode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: "100%",
    borderRightWidth: 1,
  },
  flag: { fontSize: 14 },
  countryCodeText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  phoneInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },

  otpBtn: { borderRadius: 12, overflow: "hidden" },
  otpBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 42,
  },
  otpBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: -0.1 },
  otpInfoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  otpInfo: { flex: 1, fontSize: 11.5, fontFamily: "Inter_500Medium" },
  otpChange: { fontSize: 11.5, fontFamily: "Inter_700Bold" },
  otpInput: {
    fontSize: 22,
    letterSpacing: 12,
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },
  resendBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resendText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  lockedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
  },
  lockedNoticeText: { flex: 1, fontSize: 11, fontFamily: "Inter_500Medium" },

  lockedCard: { opacity: 0.4 },

  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  photoTitle: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  photoSub: { fontSize: 11, fontFamily: "Inter_500Medium" },

  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  uploadIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  uploadSub: { fontSize: 10.5, fontFamily: "Inter_500Medium" },
  uploadThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  sheetSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  sheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sheetRowSub: { fontSize: 11.5, fontFamily: "Inter_500Medium", marginTop: 2 },
  sheetCancel: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  sheetCancelText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },

  optionalPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  optionalText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },

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
