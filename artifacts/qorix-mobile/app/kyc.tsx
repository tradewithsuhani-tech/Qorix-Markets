import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

interface DocStep {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  detail: string;
  accent: string;
  status: "verified" | "pending" | "missing";
}

type PreviewMode = "auto" | "approved" | "pending" | "none";

export default function KycScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ preview?: string }>();
  const { user } = useAuth();

  const initialPreview: PreviewMode =
    params.preview === "approved" ||
    params.preview === "pending" ||
    params.preview === "none"
      ? params.preview
      : "auto";
  const [preview, setPreview] = useState<PreviewMode>(initialPreview);

  const topPadding = insets.top + (Platform.OS === "web" ? 16 : 16);

  const effectiveStatus =
    preview === "auto" ? user?.kycStatus : preview;
  const isVerified = effectiveStatus === "approved";
  const isPending = effectiveStatus === "pending";

  const steps: DocStep[] = [
    {
      icon: "credit-card",
      title: "PAN Card",
      detail: isVerified ? "ABCXX1234L · Verified" : "Required for tax & compliance",
      accent: BRAND_PURPLE,
      status: isVerified ? "verified" : isPending ? "pending" : "missing",
    },
    {
      icon: "user-check",
      title: "Aadhaar Card",
      detail: isVerified ? "XXXX XXXX 4521 · eKYC verified" : "Identity & address proof",
      accent: BRAND_PINK,
      status: isVerified ? "verified" : isPending ? "pending" : "missing",
    },
    {
      icon: "camera",
      title: "Live Photo",
      detail: isVerified ? "Captured · Face match passed" : "Selfie for face match verification",
      accent: ACCENT_GOLD,
      status: isVerified ? "verified" : isPending ? "pending" : "missing",
    },
  ];

  const completed = steps.filter((s) => s.status === "verified").length;
  const progress = (completed / steps.length) * 100;

  const statusMeta = isVerified
    ? {
        label: "VERIFIED",
        color: colors.green,
        title: "You're fully verified",
        sub: "All trading & withdrawal limits unlocked",
        gradient: [colors.green, colors.green] as const,
      }
    : isPending
      ? {
          label: "UNDER REVIEW",
          color: ACCENT_GOLD,
          title: "Documents under review",
          sub: "Usually completes within 24 hours",
          gradient: [ACCENT_GOLD, "#F97316"] as const,
        }
      : {
          label: "INCOMPLETE",
          color: BRAND_PURPLE,
          title: "Complete your KYC",
          sub: "Required to enable withdrawals & higher limits",
          gradient: [BRAND_PURPLE, BRAND_BLUE] as const,
        };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
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
          Identity Verification
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
      >
        {/* Demo state preview switcher */}
        <View
          style={[
            styles.previewBar,
            { borderColor: "rgba(234,179,8,0.3)", backgroundColor: "rgba(234,179,8,0.06)" },
          ]}
        >
          <View style={styles.previewHead}>
            <Feather name="eye" size={11} color={ACCENT_GOLD} />
            <Text style={[styles.previewLbl, { color: ACCENT_GOLD }]}>PREVIEW STATE</Text>
          </View>
          <View style={styles.previewChips}>
            {(
              [
                { v: "auto" as PreviewMode, l: "Live" },
                { v: "approved" as PreviewMode, l: "Verified" },
                { v: "pending" as PreviewMode, l: "Pending" },
                { v: "none" as PreviewMode, l: "Not started" },
              ]
            ).map((opt) => {
              const active = preview === opt.v;
              return (
                <Pressable
                  key={opt.v}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPreview(opt.v);
                  }}
                  style={[
                    styles.previewChip,
                    {
                      backgroundColor: active
                        ? hexToRgba(ACCENT_GOLD, 0.18)
                        : "transparent",
                      borderColor: active ? ACCENT_GOLD : "rgba(255,255,255,0.08)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.previewChipText,
                      { color: active ? ACCENT_GOLD : colors.textMuted },
                    ]}
                  >
                    {opt.l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Status hero */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: "#11161E",
                borderColor: hexToRgba(statusMeta.color, 0.32),
              },
            ]}
          >
            <LinearGradient
              colors={[hexToRgba(statusMeta.color, 0.18), "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View
              pointerEvents="none"
              style={[styles.statusGlow, { backgroundColor: statusMeta.color }]}
            />

            <View style={styles.statusHead}>
              <LinearGradient
                colors={statusMeta.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statusIcon}
              >
                <Feather
                  name={isVerified ? "check" : isPending ? "clock" : "shield"}
                  size={22}
                  color="#fff"
                />
              </LinearGradient>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.statusPillRow}>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: hexToRgba(statusMeta.color, 0.16),
                        borderColor: hexToRgba(statusMeta.color, 0.45),
                      },
                    ]}
                  >
                    <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
                    <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
                      {statusMeta.label}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.statusTitle, { color: colors.foreground }]}>
                  {statusMeta.title}
                </Text>
                <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
                  {statusMeta.sub}
                </Text>
              </View>
            </View>

            {/* Progress */}
            <View style={styles.progressWrap}>
              <View style={styles.progressLabels}>
                <Text style={[styles.progressLbl, { color: colors.textMuted }]}>
                  COMPLETION
                </Text>
                <Text style={[styles.progressVal, { color: colors.foreground }]}>
                  {completed} / {steps.length}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                <LinearGradient
                  colors={statusMeta.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progress}%` }]}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Document checklist */}
        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>DOCUMENTS</Text>
        <View
          style={[
            styles.docCard,
            { backgroundColor: "#11161E", borderColor: "rgba(255,255,255,0.06)" },
          ]}
        >
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const stepColor =
              step.status === "verified"
                ? colors.green
                : step.status === "pending"
                  ? ACCENT_GOLD
                  : step.accent;
            return (
              <Animated.View
                key={step.title}
                entering={FadeInDown.duration(400).delay(80 + idx * 50)}
                style={[
                  styles.docRow,
                  {
                    borderBottomColor: "rgba(255,255,255,0.05)",
                    borderBottomWidth: isLast ? 0 : 1,
                  },
                ]}
              >
                <LinearGradient
                  colors={[hexToRgba(step.accent, 0.32), hexToRgba(step.accent, 0.1)]}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={[styles.docIcon, { borderColor: hexToRgba(step.accent, 0.4) }]}
                >
                  <Feather name={step.icon} size={15} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.docTitle, { color: colors.foreground }]}>
                    {step.title}
                  </Text>
                  <Text
                    style={[styles.docDetail, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {step.detail}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: hexToRgba(stepColor, 0.14),
                      borderColor: hexToRgba(stepColor, 0.45),
                    },
                  ]}
                >
                  {step.status === "verified" ? (
                    <Feather name="check" size={11} color={stepColor} />
                  ) : step.status === "pending" ? (
                    <Feather name="clock" size={11} color={stepColor} />
                  ) : (
                    <Feather name="alert-circle" size={11} color={stepColor} />
                  )}
                  <Text style={[styles.statusChipText, { color: stepColor }]}>
                    {step.status === "verified"
                      ? "Done"
                      : step.status === "pending"
                        ? "Review"
                        : "Required"}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>

        {/* Limits info */}
        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>YOUR LIMITS</Text>
        <View
          style={[
            styles.limitsCard,
            { backgroundColor: "#11161E", borderColor: "rgba(255,255,255,0.06)" },
          ]}
        >
          <View style={styles.limitRow}>
            <Text style={[styles.limitLbl, { color: colors.textMuted }]}>
              Daily Deposit
            </Text>
            <Text style={[styles.limitVal, { color: colors.foreground }]}>
              {isVerified ? "₹10,00,000" : "₹50,000"}
            </Text>
          </View>
          <View style={[styles.limitDiv, { backgroundColor: "rgba(255,255,255,0.05)" }]} />
          <View style={styles.limitRow}>
            <Text style={[styles.limitLbl, { color: colors.textMuted }]}>
              Daily Withdrawal
            </Text>
            <Text
              style={[
                styles.limitVal,
                { color: isVerified ? colors.foreground : colors.red },
              ]}
            >
              {isVerified ? "₹5,00,000" : "Locked"}
            </Text>
          </View>
          <View style={[styles.limitDiv, { backgroundColor: "rgba(255,255,255,0.05)" }]} />
          <View style={styles.limitRow}>
            <Text style={[styles.limitLbl, { color: colors.textMuted }]}>
              Max Portfolio
            </Text>
            <Text style={[styles.limitVal, { color: colors.foreground }]}>
              {isVerified ? "Unlimited" : "₹2,00,000"}
            </Text>
          </View>
        </View>

        {/* Linked banks (only when verified & on Live mode) */}
        {isVerified && preview === "auto" && user?.linkedBanks && (
          <>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
              LINKED BANK ACCOUNTS
            </Text>
            <View
              style={[
                styles.docCard,
                { backgroundColor: "#11161E", borderColor: "rgba(255,255,255,0.06)" },
              ]}
            >
              {user.linkedBanks.length === 0 ? (
                <View style={styles.bankEmpty}>
                  <Feather name="home" size={18} color={colors.textMuted} />
                  <Text style={[styles.bankEmptyText, { color: colors.textMuted }]}>
                    No bank accounts linked yet
                  </Text>
                </View>
              ) : (
                user.linkedBanks.map((b, idx) => {
                  const isLast = idx === user.linkedBanks!.length - 1;
                  return (
                    <View
                      key={b.id}
                      style={[
                        styles.docRow,
                        {
                          borderBottomColor: "rgba(255,255,255,0.05)",
                          borderBottomWidth: isLast ? 0 : 1,
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={[hexToRgba(BRAND_BLUE, 0.32), hexToRgba(BRAND_BLUE, 0.1)]}
                        start={{ x: 0.2, y: 0 }}
                        end={{ x: 0.8, y: 1 }}
                        style={[styles.docIcon, { borderColor: hexToRgba(BRAND_BLUE, 0.4) }]}
                      >
                        <Feather name="home" size={15} color="#fff" />
                      </LinearGradient>
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[styles.docTitle, { color: colors.foreground }]}>
                            {b.bankName}
                          </Text>
                          {b.isPrimary && (
                            <View
                              style={[
                                styles.primaryPill,
                                {
                                  backgroundColor: hexToRgba(colors.green, 0.16),
                                  borderColor: hexToRgba(colors.green, 0.4),
                                },
                              ]}
                            >
                              <Text style={[styles.primaryPillText, { color: colors.green }]}>
                                PRIMARY
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.docDetail, { color: colors.textMuted }]}>
                          ••••{b.accountNumber.slice(-4)} · {b.ifsc}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusChip,
                          {
                            backgroundColor: hexToRgba(colors.green, 0.14),
                            borderColor: hexToRgba(colors.green, 0.45),
                          },
                        ]}
                      >
                        <Feather name="check" size={11} color={colors.green} />
                        <Text style={[styles.statusChipText, { color: colors.green }]}>
                          Active
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/add-bank");
              }}
              style={({ pressed }) => [
                styles.addBankBtn,
                {
                  opacity: pressed ? 0.85 : 1,
                  borderColor: hexToRgba(BRAND_BLUE, 0.35),
                  backgroundColor: hexToRgba(BRAND_BLUE, 0.06),
                },
              ]}
            >
              <View
                style={[
                  styles.addBankIcon,
                  { backgroundColor: hexToRgba(BRAND_BLUE, 0.2) },
                ]}
              >
                <Feather name="plus" size={16} color={BRAND_BLUE} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[styles.addBankTitle, { color: colors.foreground }]}>
                  Add bank account
                </Text>
                <Text style={[styles.addBankSub, { color: colors.textMuted }]}>
                  Link more accounts for deposits & withdrawals
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
          </>
        )}

        {/* CTA */}
        {!isVerified && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/kyc-submit");
            }}
            style={({ pressed }) => [styles.ctaBtn, { opacity: pressed ? 0.9 : 1 }]}
          >
            <LinearGradient
              colors={[BRAND_PURPLE, BRAND_PINK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Feather name="upload" size={16} color="#fff" />
              <Text style={styles.ctaText}>
                {isPending ? "View submission status" : "Start verification"}
              </Text>
            </LinearGradient>
          </Pressable>
        )}

        <View
          style={[
            styles.helpCard,
            { borderColor: "rgba(96,165,250,0.25)", backgroundColor: "rgba(96,165,250,0.06)" },
          ]}
        >
          <Feather name="info" size={13} color={BRAND_BLUE} />
          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            Your documents are encrypted with AES-256 and processed by SEBI-licensed KYC providers.
          </Text>
        </View>
      </ScrollView>
    </View>
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

  statusCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
    position: "relative",
    gap: 18,
  },
  statusGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -110,
    right: -60,
    opacity: 0.1,
  },
  statusHead: { flexDirection: "row", gap: 14, alignItems: "flex-start", zIndex: 1 },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPillRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: { fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  statusTitle: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  statusSub: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },

  progressWrap: { gap: 8, zIndex: 1 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressLbl: { fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  progressVal: { fontSize: 11, fontFamily: "Inter_700Bold" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },

  groupLabel: {
    fontSize: 10.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginLeft: 4,
    marginTop: 4,
  },

  docCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, overflow: "hidden" },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  docIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  docTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  docDetail: { fontSize: 11, fontFamily: "Inter_500Medium" },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 10.5, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },

  limitsCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, overflow: "hidden" },
  limitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  limitLbl: { fontSize: 12.5, fontFamily: "Inter_500Medium" },
  limitVal: { fontSize: 13.5, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  limitDiv: { height: 1 },

  ctaBtn: { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
  },
  ctaText: { fontSize: 14.5, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.2 },

  helpCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  helpText: { flex: 1, fontSize: 11, fontFamily: "Inter_500Medium", lineHeight: 16 },

  previewBar: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  previewHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  previewLbl: { fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  previewChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  previewChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  previewChipText: { fontSize: 10.5, fontFamily: "Inter_700Bold" },

  primaryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  primaryPillText: { fontSize: 8.5, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  bankEmpty: {
    paddingVertical: 22,
    alignItems: "center",
    gap: 6,
  },
  bankEmptyText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  addBankBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  addBankIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  addBankTitle: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  addBankSub: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
