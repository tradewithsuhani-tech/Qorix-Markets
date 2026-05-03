import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  disableTwoFactor,
  getTwoFactorStatus,
  setupTwoFactor,
  verifyTwoFactorSetup,
} from "@/lib/apiClient";
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
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}


type Step = "intro" | "method" | "setup" | "manage" | "disable";

export default function TwoFactorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [enabled, setEnabled] = useState<boolean>(!!user?.is2FAEnabled);
  const [step, setStep] = useState<Step>(enabled ? "manage" : "intro");
  const [method, setMethod] = useState<"app" | "sms">("app");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Setup state — populated by POST /security/2fa/setup
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  // Backup codes shown ONCE after verify-setup
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Disable form state
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  // Server is source of truth — local user.is2FAEnabled may be stale.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getTwoFactorStatus();
        if (!alive) return;
        setEnabled(s.enabled);
        setStep(s.enabled ? "manage" : "intro");
        if (user && (user as { is2FAEnabled?: boolean }).is2FAEnabled !== s.enabled) {
          await updateUser({ is2FAEnabled: s.enabled });
        }
      } catch {
        // Fall back to local user flag — UI still works.
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user enters the SETUP step, fetch a fresh QR + secret.
  useEffect(() => {
    if (step !== "setup" || method !== "app") return;
    if (qrDataUrl) return;
    let alive = true;
    setSetupLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await setupTwoFactor();
        if (!alive) return;
        setQrDataUrl(res.qrDataUrl);
        setManualCode(res.manualCode);
      } catch (err) {
        if (!alive) return;
        const e = err as { message?: string };
        setError(e?.message ?? "Could not start 2FA setup");
      } finally {
        if (alive) setSetupLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [step, method, qrDataUrl]);

  const handleEnable = async () => {
    if (otp.length !== 6) {
      setError("Enter 6-digit code");
      return;
    }
    setError(null);
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await verifyTwoFactorSetup(otp);
      setBackupCodes(res.backupCodes);
      setEnabled(true);
      await updateUser({ is2FAEnabled: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("manage");
      setOtp("");
      setQrDataUrl(null);
      setManualCode(null);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message ?? "Invalid code. Try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = () => {
    setDisablePassword("");
    setDisableCode("");
    setError(null);
    setStep("disable");
  };

  const handleConfirmDisable = async () => {
    if (!disablePassword || disableCode.length < 6) {
      setError("Enter password and 6-digit code");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await disableTwoFactor(disablePassword, disableCode);
      setEnabled(false);
      setBackupCodes([]);
      await updateUser({ is2FAEnabled: false });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setDisablePassword("");
      setDisableCode("");
      setStep("intro");
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message ?? "Could not disable 2FA");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
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
          Two-Factor Auth
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: "#11161E",
                borderColor: enabled
                  ? hexToRgba(colors.green, 0.35)
                  : hexToRgba(BRAND_BLUE, 0.3),
              },
            ]}
          >
            <LinearGradient
              colors={[
                enabled ? hexToRgba(colors.green, 0.14) : hexToRgba(BRAND_BLUE, 0.16),
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View
              pointerEvents="none"
              style={[styles.glow, { backgroundColor: enabled ? colors.green : BRAND_PURPLE }]}
            />
            <View style={[styles.heroIconWrap, { zIndex: 1 }]}>
              <View
                style={[
                  styles.heroIcon,
                  {
                    backgroundColor: enabled
                      ? hexToRgba(colors.green, 0.18)
                      : hexToRgba(BRAND_BLUE, 0.18),
                  },
                ]}
              >
                <Feather
                  name={enabled ? "shield-off" : "shield"}
                  size={22}
                  color={enabled ? colors.green : BRAND_BLUE}
                />
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: enabled
                      ? hexToRgba(colors.green, 0.16)
                      : hexToRgba(ACCENT_GOLD, 0.16),
                    borderColor: enabled
                      ? hexToRgba(colors.green, 0.4)
                      : hexToRgba(ACCENT_GOLD, 0.4),
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: enabled ? colors.green : ACCENT_GOLD },
                  ]}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    { color: enabled ? colors.green : ACCENT_GOLD },
                  ]}
                >
                  {enabled ? "ENABLED" : "DISABLED"}
                </Text>
              </View>
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground, zIndex: 1 }]}>
              {enabled ? "Your account is protected" : "Add extra login protection"}
            </Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary, zIndex: 1 }]}>
              {enabled
                ? "We'll ask for a code every time you sign in from a new device."
                : "Require a 6-digit code from your authenticator app or SMS each sign-in."}
            </Text>
          </View>
        </Animated.View>

        {/* INTRO — benefits */}
        {step === "intro" && (
          <>
            <Animated.View entering={FadeInDown.duration(400).delay(60)} style={styles.card}>
              <Text style={[styles.cardLbl, { color: colors.textMuted }]}>WHY ENABLE</Text>
              <View style={{ gap: 12 }}>
                {[
                  {
                    icon: "shield" as const,
                    color: BRAND_PURPLE,
                    title: "Account hijack protection",
                    sub: "Even if your password leaks, attackers can't sign in without your phone",
                  },
                  {
                    icon: "lock" as const,
                    color: BRAND_PINK,
                    title: "Required for large withdrawals",
                    sub: "Withdrawals above ₹1,00,000/day need 2FA",
                  },
                  {
                    icon: "zap" as const,
                    color: BRAND_BLUE,
                    title: "Takes 30 seconds",
                    sub: "One-time setup, faster than Aadhaar OTP",
                  },
                ].map((b, i) => (
                  <View key={i} style={styles.benefitRow}>
                    <LinearGradient
                      colors={[hexToRgba(b.color, 0.32), hexToRgba(b.color, 0.1)]}
                      start={{ x: 0.2, y: 0 }}
                      end={{ x: 0.8, y: 1 }}
                      style={[styles.benefitIcon, { borderColor: hexToRgba(b.color, 0.4) }]}
                    >
                      <Feather name={b.icon} size={14} color="#fff" />
                    </LinearGradient>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.benefitTitle, { color: colors.foreground }]}>
                        {b.title}
                      </Text>
                      <Text style={[styles.benefitSub, { color: colors.textMuted }]}>
                        {b.sub}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStep("method");
              }}
              style={({ pressed }) => [styles.ctaBtn, { opacity: pressed ? 0.9 : 1 }]}
            >
              <LinearGradient
                colors={[BRAND_BLUE, BRAND_PURPLE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                <Feather name="shield" size={16} color="#fff" />
                <Text style={styles.ctaText}>Enable 2FA</Text>
              </LinearGradient>
            </Pressable>
          </>
        )}

        {/* METHOD select */}
        {step === "method" && (
          <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 14 }}>
            <Text style={[styles.groupLbl, { color: colors.textMuted }]}>
              CHOOSE METHOD
            </Text>
            {(
              [
                {
                  k: "app" as const,
                  icon: "smartphone" as const,
                  color: BRAND_PURPLE,
                  title: "Authenticator app",
                  sub: "Google Authenticator, Authy, 1Password",
                  pill: "RECOMMENDED",
                  pillColor: colors.green,
                },
                {
                  k: "sms" as const,
                  icon: "message-circle" as const,
                  color: BRAND_PINK,
                  title: "SMS code",
                  sub: `Code sent to +91 ${user?.phone ?? "—"}`,
                  pill: null,
                  pillColor: null,
                },
              ] as const
            ).map((m) => {
              const selected = method === m.k;
              return (
                <Pressable
                  key={m.k}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setMethod(m.k);
                  }}
                  style={({ pressed }) => [
                    styles.methodCard,
                    {
                      opacity: pressed ? 0.9 : 1,
                      borderColor: selected
                        ? hexToRgba(m.color, 0.5)
                        : "rgba(255,255,255,0.08)",
                      backgroundColor: selected ? hexToRgba(m.color, 0.08) : "#11161E",
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[hexToRgba(m.color, 0.32), hexToRgba(m.color, 0.1)]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={[styles.methodIcon, { borderColor: hexToRgba(m.color, 0.4) }]}
                  >
                    <Feather name={m.icon} size={16} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.methodTitle, { color: colors.foreground }]}>
                        {m.title}
                      </Text>
                      {m.pill && m.pillColor && (
                        <View
                          style={[
                            styles.recommendedPill,
                            {
                              backgroundColor: hexToRgba(m.pillColor, 0.16),
                              borderColor: hexToRgba(m.pillColor, 0.4),
                            },
                          ]}
                        >
                          <Text style={[styles.recommendedPillText, { color: m.pillColor }]}>
                            {m.pill}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.methodSub, { color: colors.textMuted }]}>
                      {m.sub}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor: selected ? m.color : "rgba(255,255,255,0.15)",
                      },
                    ]}
                  >
                    {selected && (
                      <View style={[styles.radioInner, { backgroundColor: m.color }]} />
                    )}
                  </View>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStep("setup");
              }}
              style={({ pressed }) => [styles.ctaBtn, { opacity: pressed ? 0.9 : 1 }]}
            >
              <LinearGradient
                colors={[BRAND_BLUE, BRAND_PURPLE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                <Text style={styles.ctaText}>Continue</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* SETUP — show secret key or send SMS */}
        {step === "setup" && (
          <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 14 }}>
            <View style={styles.card}>
              <Text style={[styles.cardLbl, { color: colors.textMuted }]}>
                {method === "app" ? "STEP 1 — ADD TO APP" : "STEP 1 — VERIFY PHONE"}
              </Text>
              {method === "app" ? (
                <>
                  <Text style={[styles.setupHint, { color: colors.textSecondary }]}>
                    Open your authenticator app and either scan the QR code or enter this secret key manually.
                  </Text>
                  <View style={[styles.qrPlaceholder, { borderColor: hexToRgba(BRAND_PURPLE, 0.3) }]}>
                    {setupLoading || !qrDataUrl ? (
                      <ActivityIndicator color={BRAND_PURPLE} />
                    ) : (
                      <Image
                        source={{ uri: qrDataUrl }}
                        style={{ width: 200, height: 200, borderRadius: 8 }}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                  <View
                    style={[
                      styles.secretBox,
                      {
                        backgroundColor: hexToRgba(BRAND_PURPLE, 0.06),
                        borderColor: hexToRgba(BRAND_PURPLE, 0.3),
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.secretLbl, { color: colors.textMuted }]}>
                        SECRET KEY
                      </Text>
                      <Text style={[styles.secretVal, { color: colors.foreground }]}>
                        {manualCode ?? "Loading…"}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }}
                      hitSlop={8}
                      style={[styles.copyBtn, { backgroundColor: hexToRgba(BRAND_PURPLE, 0.18) }]}
                    >
                      <Feather name="copy" size={14} color={BRAND_PURPLE} />
                    </Pressable>
                  </View>
                </>
              ) : (
                <View
                  style={[
                    styles.smsBox,
                    {
                      backgroundColor: hexToRgba(BRAND_PINK, 0.06),
                      borderColor: hexToRgba(BRAND_PINK, 0.3),
                    },
                  ]}
                >
                  <Feather name="send" size={18} color={BRAND_PINK} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.smsTitle, { color: colors.foreground }]}>
                      Code sent
                    </Text>
                    <Text style={[styles.smsSub, { color: colors.textMuted }]}>
                      6-digit code sent to +91 {user?.phone ?? "—"}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={[styles.cardLbl, { color: colors.textMuted }]}>
                STEP 2 — ENTER CODE
              </Text>
              <TextInput
                value={otp}
                onChangeText={(t) => {
                  setOtp(t.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                placeholder="••••••"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                editable={!submitting}
                style={[
                  styles.otpInput,
                  {
                    color: colors.foreground,
                    backgroundColor: "rgba(255,255,255,0.03)",
                    borderColor: error
                      ? hexToRgba(colors.red, 0.5)
                      : "rgba(255,255,255,0.08)",
                  },
                ]}
              />
              {error && (
                <Text style={[styles.errText, { color: colors.red }]}>{error}</Text>
              )}
            </View>

            <Pressable
              onPress={handleEnable}
              disabled={otp.length !== 6 || submitting}
              style={({ pressed }) => [
                styles.ctaBtn,
                { opacity: pressed || submitting || otp.length !== 6 ? 0.7 : 1 },
              ]}
            >
              <LinearGradient
                colors={otp.length === 6 ? [BRAND_BLUE, BRAND_PURPLE] : ["#2A2F38", "#2A2F38"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="check" size={16} color="#fff" />
                    <Text style={styles.ctaText}>Verify & enable</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* MANAGE — already enabled */}
        {step === "manage" && (
          <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 14 }}>
            <View style={styles.card}>
              <Text style={[styles.cardLbl, { color: colors.textMuted }]}>
                BACKUP CODES
              </Text>
              <Text style={[styles.setupHint, { color: colors.textSecondary }]}>
                Save these codes in a safe place. Use one if you lose access to your authenticator.
              </Text>
              {backupCodes.length > 0 ? (
                <View style={styles.backupGrid}>
                  {backupCodes.map((code, i) => (
                    <View
                      key={i}
                      style={[
                        styles.backupCode,
                        {
                          backgroundColor: hexToRgba(BRAND_PURPLE, 0.06),
                          borderColor: hexToRgba(BRAND_PURPLE, 0.2),
                        },
                      ]}
                    >
                      <Text style={[styles.backupCodeText, { color: colors.foreground }]}>
                        {code}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.setupHint, { color: colors.textMuted }]}>
                  Backup codes are shown only once at setup time. Lost yours? Disable and re-enable 2FA to get a fresh set.
                </Text>
              )}
            </View>

            <Pressable
              onPress={handleDisable}
              style={({ pressed }) => [
                styles.disableBtn,
                {
                  opacity: pressed ? 0.85 : 1,
                  borderColor: hexToRgba(colors.red, 0.4),
                  backgroundColor: hexToRgba(colors.red, 0.06),
                },
              ]}
            >
              <Feather name="shield-off" size={16} color={colors.red} />
              <Text style={[styles.disableText, { color: colors.red }]}>
                Disable Two-Factor Auth
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* DISABLE — password + code form */}
        {step === "disable" && (
          <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 14 }}>
            <View style={styles.card}>
              <Text style={[styles.cardLbl, { color: colors.textMuted }]}>
                CONFIRM YOUR IDENTITY
              </Text>
              <Text style={[styles.setupHint, { color: colors.textSecondary }]}>
                Enter your password and a fresh 6-digit code (or 8-character backup code) to turn off Two-Factor Auth.
              </Text>
              <TextInput
                value={disablePassword}
                onChangeText={(t) => {
                  setDisablePassword(t);
                  setError(null);
                }}
                placeholder="Current password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                editable={!submitting}
                style={[
                  styles.otpInput,
                  {
                    color: colors.foreground,
                    backgroundColor: "rgba(255,255,255,0.03)",
                    borderColor: error ? hexToRgba(colors.red, 0.5) : "rgba(255,255,255,0.08)",
                    fontSize: 15,
                    letterSpacing: 0,
                    textAlign: "left",
                  },
                ]}
              />
              <TextInput
                value={disableCode}
                onChangeText={(t) => {
                  setDisableCode(t.replace(/[^0-9A-Za-z]/g, "").slice(0, 16));
                  setError(null);
                }}
                placeholder="6-digit code or backup code"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                editable={!submitting}
                style={[
                  styles.otpInput,
                  {
                    color: colors.foreground,
                    backgroundColor: "rgba(255,255,255,0.03)",
                    borderColor: error ? hexToRgba(colors.red, 0.5) : "rgba(255,255,255,0.08)",
                  },
                ]}
              />
              {error && (
                <Text style={[styles.errText, { color: colors.red }]}>{error}</Text>
              )}
            </View>

            <Pressable
              onPress={handleConfirmDisable}
              disabled={submitting || !disablePassword || disableCode.length < 6}
              style={({ pressed }) => [
                styles.disableBtn,
                {
                  opacity:
                    pressed || submitting || !disablePassword || disableCode.length < 6
                      ? 0.6
                      : 1,
                  borderColor: hexToRgba(colors.red, 0.4),
                  backgroundColor: hexToRgba(colors.red, 0.08),
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.red} />
              ) : (
                <>
                  <Feather name="shield-off" size={16} color={colors.red} />
                  <Text style={[styles.disableText, { color: colors.red }]}>
                    Confirm disable
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setError(null);
                setDisablePassword("");
                setDisableCode("");
                setStep("manage");
              }}
              style={({ pressed }) => ({
                alignSelf: "center",
                padding: 10,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                Cancel
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
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
    gap: 8,
  },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -110,
    right: -60,
    opacity: 0.08,
  },
  heroIconWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  heroTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  heroSub: { fontSize: 12.5, fontFamily: "Inter_500Medium", lineHeight: 18 },

  card: {
    backgroundColor: "#11161E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 14,
    gap: 12,
  },
  cardLbl: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },

  benefitRow: { flexDirection: "row", gap: 11 },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  benefitTitle: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  benefitSub: { fontSize: 11.5, fontFamily: "Inter_500Medium", lineHeight: 16 },

  groupLbl: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginLeft: 4,
  },

  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  methodTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  methodSub: { fontSize: 11.5, fontFamily: "Inter_500Medium" },
  recommendedPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  recommendedPillText: { fontSize: 8.5, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },

  setupHint: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  qrPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    alignSelf: "center",
    backgroundColor: "#0B1014",
    padding: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  qrGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 160,
    height: 160,
  },
  qrCell: { width: 20, height: 20 },

  secretBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  secretLbl: { fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 2 },
  secretVal: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 1.5 },
  copyBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  smsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  smsTitle: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  smsSub: { fontSize: 11.5, fontFamily: "Inter_500Medium", marginTop: 2 },

  otpInput: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 24,
    letterSpacing: 14,
    textAlign: "center",
    fontFamily: "Inter_700Bold",
  },
  errText: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginLeft: 4 },

  backupGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  backupCode: {
    width: "48%",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  backupCodeText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1 },

  disableBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  disableText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },

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
