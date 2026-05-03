import { Feather } from "@expo/vector-icons";
import {
  getGetReferralQueryKey,
  useGetReferral,
} from "@workspace/api-client-react";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { usePortfolio } from "@/context/PortfolioContext";
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

type RiskTier = "conservative" | "moderate" | "aggressive";

const RISK_LABEL: Record<RiskTier, string> = {
  conservative: "Conservative · 5–8%/mo",
  moderate: "Moderate · 10–15%/mo",
  aggressive: "Aggressive · 18–25%/mo",
};

interface MenuItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  accent?: string;
  onPress?: () => void;
  badge?: string;
  badgeColor?: string;
  action?: {
    label: string;
    color: string;
    onPress: () => void;
  };
}

interface MenuGroup {
  group: string;
  items: MenuItem[];
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const { portfolio, wallet } = usePortfolio();
  const isDemo = user?.id === "demo_001";
  const [referOpen, setReferOpen] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const referralQuery = useGetReferral({
    query: {
      // Scope the cache key by user id so cached referral data from a
      // previous account never leaks into another user's session.
      queryKey: [...getGetReferralQueryKey(), user?.id ?? "anon"],
      enabled: isAuthenticated && !isDemo,
      staleTime: 60_000,
    },
  });
  const referralCode =
    referralQuery.data?.referralCode ?? user?.referralCode ?? "";
  const referralStats = referralQuery.data;
  const referralUrl = referralCode
    ? `https://qorix.app/r/${referralCode}`
    : "https://qorix.app";

  const copyReferral = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 1600);
  };

  const shareReferral = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Auto-trade with Qorix — use my referral code ${referralCode || ""} and we both earn ₹500 on your first deposit. ${referralUrl}`,
      });
    } catch {
      /* user cancelled */
    }
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 16);

  const isRiskTier = (t: unknown): t is RiskTier =>
    t === "conservative" || t === "moderate" || t === "aggressive";

  const riskLabel = isRiskTier(user?.riskTier)
    ? RISK_LABEL[user.riskTier]
    : "Not selected";

  const riskColor = isRiskTier(user?.riskTier)
    ? user.riskTier === "conservative"
      ? colors.blue
      : user.riskTier === "moderate"
        ? colors.gold
        : colors.red
    : colors.textMuted;

  const totalPortfolio =
    (portfolio?.deployedAmount ?? 0) + (wallet?.balance ?? 0) + (wallet?.lockedAmount ?? 0);
  const totalPnL = portfolio?.totalPnL ?? 0;
  const totalPnLPct =
    portfolio && portfolio.deployedAmount > 0
      ? (totalPnL / portfolio.deployedAmount) * 100
      : 0;

  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((r) => setTimeout(r, 350));
    await logout();
  };

  const fmtINR = (n: number) =>
    `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

  const kycVerified = user?.kycStatus === "approved";
  const kycPending = user?.kycStatus === "pending";

  const menuGroups: MenuGroup[] = [
    {
      group: "Contact",
      items: [
        user?.isPhoneVerified
          ? {
              icon: "phone" as const,
              label: "Mobile Number",
              accent: BRAND_PINK,
              subtitle: user?.phone ? `+91 ${user.phone}` : "—",
              value: "Verified",
              valueColor: colors.green,
              badge: "✓",
              badgeColor: colors.green,
            }
          : {
              icon: "phone" as const,
              label: "Mobile Number",
              accent: BRAND_PINK,
              subtitle: user?.phone ? `+91 ${user.phone}` : "Pending KYC",
              value: "Pending",
              valueColor: ACCENT_GOLD,
            },
        {
          icon: "mail",
          label: "Email Address",
          accent: BRAND_BLUE,
          subtitle: user?.email ?? "—",
          value: "Verified",
          valueColor: colors.green,
          badge: "✓",
          badgeColor: colors.green,
        },
      ],
    },
    {
      group: "Security",
      items: [
        {
          icon: "key",
          label: "Password",
          accent: BRAND_PURPLE,
          subtitle: "Last changed: Never",
          action: {
            label: "Update",
            color: BRAND_BLUE,
            onPress: () => router.push("/change-password"),
          },
        },
        {
          icon: "lock",
          label: "Two-Factor Auth",
          accent: BRAND_BLUE,
          subtitle: user?.is2FAEnabled
            ? "Authenticator app · Active"
            : "Adds extra login protection",
          action: user?.is2FAEnabled
            ? {
                label: "Manage",
                color: colors.green,
                onPress: () => router.push("/two-factor"),
              }
            : {
                label: "Enable",
                color: ACCENT_GOLD,
                onPress: () => router.push("/two-factor"),
              },
        },
        {
          icon: "smartphone",
          label: "My Devices",
          accent: BRAND_PINK,
          subtitle: "See where your account is signed in",
          onPress: () => router.push("/devices"),
        },
      ],
    },
    {
      group: "Preferences & Help",
      items: [
        { icon: "globe", label: "Compliance", accent: BRAND_PURPLE, value: "SEBI/RBI" },
        { icon: "file-text", label: "Terms of Service", accent: BRAND_PINK, onPress: () => {} },
        { icon: "help-circle", label: "Help & Support", accent: BRAND_BLUE, onPress: () => {} },
      ],
    },
  ];

  return (
    <>
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPadding, paddingBottom: insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Premium hero header */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <View
          style={[
            styles.heroCard,
            { backgroundColor: "#0E141C", borderColor: "rgba(255,255,255,0.07)" },
          ]}
        >
          {/* Top brand hairline */}
          <LinearGradient
            colors={[BRAND_BLUE, BRAND_PURPLE, BRAND_PINK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroTopBar}
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={[styles.heroGlow, { backgroundColor: BRAND_PURPLE }]}
          />

          <View style={styles.heroTopRow}>
            <View style={styles.avatarWrap}>
              <View
                pointerEvents="none"
                style={[styles.avatarHalo, { backgroundColor: BRAND_PURPLE }]}
              />
              <LinearGradient
                colors={[BRAND_PURPLE, BRAND_PINK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {(user?.name ?? "T").slice(0, 2).toUpperCase()}
                </Text>
              </LinearGradient>
              {user?.kycStatus === "approved" && (
                <View style={[styles.kycCheck, { backgroundColor: colors.green, borderColor: "#0E141C" }]}>
                  <Feather name="check" size={9} color="#0B1014" />
                </View>
              )}
            </View>

            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.nameRow}>
                <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                  {user?.name ?? "Trader"}
                </Text>
                <View style={[styles.tierBadge, { borderColor: hexToRgba(ACCENT_GOLD, 0.5), backgroundColor: hexToRgba(ACCENT_GOLD, 0.1) }]}>
                  <Feather name="star" size={9} color={ACCENT_GOLD} />
                  <Text style={[styles.tierBadgeText, { color: ACCENT_GOLD }]}>PRO</Text>
                </View>
              </View>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {user?.email ?? "—"}
              </Text>
              <Text style={[styles.userId, { color: colors.textMuted }]}>
                ID · {user?.id?.slice(0, 16) ?? "—"}
              </Text>
            </View>
          </View>

          {/* Stat strip */}
          <View style={[styles.statStrip, { borderTopColor: "rgba(255,255,255,0.06)" }]}>
            <View style={styles.statCell}>
              <Text style={[styles.statLbl, { color: colors.textMuted }]}>PORTFOLIO</Text>
              <Text style={[styles.statVal, { color: colors.foreground }]}>
                {fmtINR(totalPortfolio)}
              </Text>
            </View>
            <View style={[styles.statDiv, { backgroundColor: "rgba(255,255,255,0.07)" }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statLbl, { color: colors.textMuted }]}>TOTAL P&amp;L</Text>
              <Text
                style={[
                  styles.statVal,
                  { color: totalPnL >= 0 ? colors.green : colors.red },
                ]}
              >
                {totalPnL >= 0 ? "+" : "-"}{fmtINR(totalPnL)}
              </Text>
              <Text
                style={[
                  styles.statSub,
                  { color: totalPnL >= 0 ? colors.green : colors.red },
                ]}
              >
                {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%
              </Text>
            </View>
            <View style={[styles.statDiv, { backgroundColor: "rgba(255,255,255,0.07)" }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statLbl, { color: colors.textMuted }]}>MEMBER</Text>
              <Text style={[styles.statVal, { color: colors.foreground }]}>
                Apr 2026
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Refer & Earn promo card */}
      <Animated.View entering={FadeInDown.duration(400).delay(80)}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setReferOpen(true);
          }}
          style={({ pressed }) => [
            styles.referCard,
            {
              backgroundColor: "#11161E",
              borderColor: "rgba(168,85,247,0.28)",
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <LinearGradient
            colors={[hexToRgba(BRAND_PURPLE, 0.18), hexToRgba(BRAND_PINK, 0.08), "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={[styles.referGlow, { backgroundColor: BRAND_PINK }]}
          />

          <LinearGradient
            colors={[BRAND_PURPLE, BRAND_PINK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.referIcon}
          >
            <Feather name="gift" size={18} color="#fff" />
          </LinearGradient>

          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.referTitleRow}>
              <Text style={[styles.referTitle, { color: colors.foreground }]}>
                Refer &amp; Earn
              </Text>
              <View style={[styles.referAmountPill, { backgroundColor: hexToRgba(ACCENT_GOLD, 0.14), borderColor: hexToRgba(ACCENT_GOLD, 0.45) }]}>
                <Text style={[styles.referAmountText, { color: ACCENT_GOLD }]}>
                  {referralStats && referralStats.totalEarned > 0
                    ? `₹${Math.round(referralStats.totalEarned).toLocaleString("en-IN")} earned`
                    : "+₹500"}
                </Text>
              </View>
            </View>
            <Text style={[styles.referSub, { color: colors.textSecondary }]} numberOfLines={2}>
              {referralStats
                ? `${referralStats.totalReferred} invited · ${referralStats.activeReferrals} active · Tap to share`
                : "Invite friends · You both earn ₹500 on first deposit"}
            </Text>
          </View>

          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>
      </Animated.View>

      {/* Identity Verification (KYC) callout card */}
      <Animated.View entering={FadeInDown.duration(400).delay(110)}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/kyc");
          }}
          style={({ pressed }) => [
            styles.kycCard,
            {
              backgroundColor: "#11161E",
              borderColor: kycVerified
                ? hexToRgba(colors.green, 0.3)
                : kycPending
                  ? hexToRgba(ACCENT_GOLD, 0.35)
                  : hexToRgba(BRAND_PURPLE, 0.32),
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <LinearGradient
            colors={
              kycVerified
                ? [hexToRgba(colors.green, 0.16), "transparent"]
                : kycPending
                  ? [hexToRgba(ACCENT_GOLD, 0.18), "transparent"]
                  : [hexToRgba(BRAND_PURPLE, 0.18), hexToRgba(BRAND_BLUE, 0.06), "transparent"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={
              kycVerified
                ? [colors.green, colors.green]
                : kycPending
                  ? [ACCENT_GOLD, "#F97316"]
                  : [BRAND_PURPLE, BRAND_BLUE]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.kycIcon}
          >
            <Feather name={kycVerified ? "check" : "shield"} size={18} color="#fff" />
          </LinearGradient>

          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.referTitleRow}>
              <Text style={[styles.referTitle, { color: colors.foreground }]}>
                Identity Verification (KYC)
              </Text>
              {kycVerified && (
                <View style={[styles.kycPill, { backgroundColor: hexToRgba(colors.green, 0.16), borderColor: hexToRgba(colors.green, 0.45) }]}>
                  <Text style={[styles.kycPillText, { color: colors.green }]}>VERIFIED</Text>
                </View>
              )}
              {kycPending && (
                <View style={[styles.kycPill, { backgroundColor: hexToRgba(ACCENT_GOLD, 0.14), borderColor: hexToRgba(ACCENT_GOLD, 0.45) }]}>
                  <Text style={[styles.kycPillText, { color: ACCENT_GOLD }]}>PENDING</Text>
                </View>
              )}
            </View>
            <Text style={[styles.referSub, { color: colors.textSecondary }]} numberOfLines={2}>
              {kycVerified
                ? "PAN, Aadhaar & bank account verified · All limits unlocked"
                : kycPending
                  ? "Documents under review · Usually completes in 24 hours"
                  : "Required to enable withdrawals & higher deposit limits"}
            </Text>
          </View>

          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>
      </Animated.View>

      {/* Menu Groups */}
      {menuGroups.map((group, gIdx) => (
        <Animated.View
          key={group.group}
          entering={FadeInDown.duration(400).delay(120 + gIdx * 60)}
          style={styles.group}
        >
          <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
            {group.group.toUpperCase()}
          </Text>
          <View
            style={[
              styles.menuCard,
              { backgroundColor: "#11161E", borderColor: "rgba(255,255,255,0.06)" },
            ]}
          >
            {group.items.map((item, idx) => {
              const accent = item.accent ?? BRAND_PURPLE;
              const isLast = idx === group.items.length - 1;
              const pressable = !!(item.onPress || item.action);
              return (
                <Pressable
                  key={item.label}
                  onPress={
                    item.onPress
                      ? () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          item.onPress?.();
                        }
                      : undefined
                  }
                  style={({ pressed }) => [
                    styles.menuItem,
                    {
                      borderBottomColor: "rgba(255,255,255,0.05)",
                      borderBottomWidth: isLast ? 0 : 1,
                      opacity: pressed && pressable ? 0.7 : 1,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[hexToRgba(accent, 0.32), hexToRgba(accent, 0.1)]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={[styles.menuIcon, { borderColor: hexToRgba(accent, 0.4) }]}
                  >
                    <Feather name={item.icon} size={14} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.menuLabel, { color: colors.foreground }]}>
                      {item.label}
                    </Text>
                    {item.subtitle && (
                      <Text
                        style={[styles.menuSub, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
                  <View style={styles.menuRight}>
                    {item.action ? (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          item.action?.onPress();
                        }}
                        style={({ pressed }) => [
                          styles.actionPill,
                          {
                            backgroundColor: hexToRgba(item.action!.color, 0.14),
                            borderColor: hexToRgba(item.action!.color, 0.45),
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.actionPillText, { color: item.action.color }]}>
                          {item.action.label}
                        </Text>
                      </Pressable>
                    ) : (
                      <>
                        {item.badge && (
                          <View
                            style={[
                              styles.menuBadge,
                              {
                                backgroundColor: hexToRgba(item.badgeColor ?? ACCENT_GOLD, 0.14),
                                borderColor: hexToRgba(item.badgeColor ?? ACCENT_GOLD, 0.4),
                              },
                            ]}
                          >
                            <Text style={[styles.menuBadgeText, { color: item.badgeColor ?? ACCENT_GOLD }]}>
                              {item.badge}
                            </Text>
                          </View>
                        )}
                        {item.value ? (
                          <Text
                            style={[
                              styles.menuValue,
                              { color: item.valueColor ?? colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {item.value}
                          </Text>
                        ) : null}
                        {item.onPress && (
                          <Feather name="chevron-right" size={15} color={colors.textMuted} />
                        )}
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      ))}

      {/* Logout */}
      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutBtn,
          {
            backgroundColor: "rgba(239,68,68,0.08)",
            borderColor: "rgba(239,68,68,0.4)",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="log-out" size={16} color={colors.red} />
        <Text style={[styles.logoutText, { color: colors.red }]}>Log out</Text>
      </Pressable>

      <Text style={[styles.version, { color: colors.textMuted }]}>
        Auto-Trading Platform · v1.0.0
      </Text>
    </ScrollView>

    <Modal
      visible={showLogoutConfirm}
      transparent
      animationType="fade"
      onRequestClose={() => !loggingOut && setShowLogoutConfirm(false)}
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(180)}
        style={styles.modalOverlay}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => !loggingOut && setShowLogoutConfirm(false)}
        />
        <Animated.View
          entering={ZoomIn.duration(220)}
          style={[
            styles.modalCard,
            {
              backgroundColor: "#11161E",
              borderColor: "rgba(239,68,68,0.3)",
            },
          ]}
        >
          <LinearGradient
            colors={[hexToRgba(colors.red, 0.18), "transparent"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={[styles.modalGlow, { backgroundColor: colors.red }]}
          />
          <View
            style={[
              styles.modalIcon,
              {
                backgroundColor: hexToRgba(colors.red, 0.16),
                borderColor: hexToRgba(colors.red, 0.4),
              },
            ]}
          >
            <Feather name="log-out" size={22} color={colors.red} />
          </View>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Log out of your account?
          </Text>
          <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
            You'll need to sign in again with your email and password. Your active strategies will continue running.
          </Text>
          <View style={styles.modalBtns}>
            <Pressable
              onPress={() => setShowLogoutConfirm(false)}
              disabled={loggingOut}
              style={({ pressed }) => [
                styles.modalCancelBtn,
                {
                  borderColor: "rgba(255,255,255,0.1)",
                  opacity: pressed || loggingOut ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.modalCancelText, { color: colors.foreground }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={confirmLogout}
              disabled={loggingOut}
              style={({ pressed }) => [
                styles.modalConfirmBtn,
                {
                  backgroundColor: colors.red,
                  opacity: pressed || loggingOut ? 0.85 : 1,
                },
              ]}
            >
              {loggingOut ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="log-out" size={14} color="#fff" />
                  <Text style={styles.modalConfirmText}>Log out</Text>
                </>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>

    {/* Refer & Earn bottom sheet */}
    <Modal
      visible={referOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setReferOpen(false)}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
        onPress={() => setReferOpen(false)}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#11161E",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: "rgba(168,85,247,0.3)",
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: insets.bottom + 22,
            gap: 16,
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, alignSelf: "center", backgroundColor: "rgba(255,255,255,0.15)" }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <LinearGradient
              colors={[BRAND_PURPLE, BRAND_PINK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
            >
              <Feather name="gift" size={20} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>Refer &amp; Earn</Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.textSecondary, marginTop: 2 }}>
                You both earn ₹500 on first deposit
              </Text>
            </View>
            <Pressable onPress={() => setReferOpen(false)} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Stats grid */}
          {referralStats && (
            <View style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", paddingVertical: 12 }}>
              <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
                <Text style={{ fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 1, color: colors.textMuted }}>INVITED</Text>
                <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>{referralStats.totalReferred}</Text>
              </View>
              <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
              <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
                <Text style={{ fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 1, color: colors.textMuted }}>ACTIVE</Text>
                <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.green }}>{referralStats.activeReferrals}</Text>
              </View>
              <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
              <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
                <Text style={{ fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 1, color: colors.textMuted }}>EARNED</Text>
                <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: ACCENT_GOLD }}>
                  ₹{Math.round(referralStats.totalEarned).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>
          )}

          {/* Referral code box */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1, color: colors.textMuted }}>YOUR REFERRAL CODE</Text>
            <Pressable
              onPress={copyReferral}
              style={({ pressed }) => [{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: refCopied ? colors.green : hexToRgba(BRAND_PURPLE, 0.4),
                backgroundColor: hexToRgba(BRAND_PURPLE, 0.08),
                opacity: pressed ? 0.85 : 1,
              }]}
            >
              {referralQuery.isLoading && !referralCode ? (
                <ActivityIndicator color={BRAND_PURPLE} />
              ) : (
                <>
                  <Text style={{ flex: 1, fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: 2 }}>
                    {referralCode || "—"}
                  </Text>
                  <Feather name={refCopied ? "check" : "copy"} size={18} color={refCopied ? colors.green : BRAND_PURPLE} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: refCopied ? colors.green : BRAND_PURPLE }}>
                    {refCopied ? "Copied" : "Copy"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={shareReferral}
            disabled={!referralCode}
            style={({ pressed }) => [{ opacity: pressed || !referralCode ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={[BRAND_PURPLE, BRAND_PINK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
            >
              <Feather name="share-2" size={16} color="#fff" />
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.3 }}>
                Share with friends
              </Text>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },

  // Hero card
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    padding: 16,
    paddingTop: 18,
    gap: 16,
  },
  heroTopBar: { position: "absolute", top: 0, left: 0, right: 0, height: 2 },
  heroGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -100,
    right: -70,
    opacity: 0.08,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 14, zIndex: 1 },
  avatarWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  avatarHalo: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 20,
    opacity: 0.28,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.5 },
  kycCheck: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userName: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.4, flexShrink: 1 },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  tierBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  userEmail: { fontSize: 12.5, fontFamily: "Inter_500Medium" },
  userId: { fontSize: 10.5, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },

  statStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: 1,
    zIndex: 1,
  },
  statCell: { flex: 1, gap: 3 },
  statLbl: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  statVal: { fontSize: 13.5, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  statSub: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 1 },
  statDiv: { width: 1, height: 28, marginHorizontal: 2 },

  // Refer & Earn card
  referCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  referGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -90,
    right: -50,
    opacity: 0.1,
  },
  referIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  referTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  referTitle: { fontSize: 14.5, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  referAmountPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  referAmountText: { fontSize: 10.5, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  referSub: { fontSize: 11.5, fontFamily: "Inter_500Medium", lineHeight: 16 },

  // Menu
  group: { gap: 8 },
  groupLabel: { fontSize: 10.5, fontFamily: "Inter_700Bold", letterSpacing: 1.2, marginLeft: 4 },
  menuCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, overflow: "hidden" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  menuLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  menuSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionPillText: { fontSize: 11.5, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  // KYC card
  kycCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  kycIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  kycPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  kycPillText: { fontSize: 9.5, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  menuValue: { fontSize: 12, fontFamily: "Inter_600SemiBold", maxWidth: 130 },
  menuBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  menuBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },

  // Logout + footer
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  logoutText: { fontSize: 14, fontFamily: "Inter_700Bold" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    overflow: "hidden",
    alignItems: "center",
    gap: 10,
  },
  modalGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -140,
    alignSelf: "center",
    opacity: 0.1,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  modalSub: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  modalConfirmText: { fontSize: 13.5, fontFamily: "Inter_700Bold", color: "#fff" },
  version: { textAlign: "center", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },
});
