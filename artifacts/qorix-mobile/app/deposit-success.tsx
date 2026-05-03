import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BANKS } from "@/constants/banks";
import { P2P_AGENTS } from "@/constants/p2pAgents";
import { useColors } from "@/hooks/useColors";

type DetailKey = "utr" | "ref";

function formatNow(): string {
  const d = new Date();
  const day = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} · ${time}`;
}

export default function DepositSuccessScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    amount?: string;
    bankId?: string;
    agentId?: string;
    utr?: string;
    refCode?: string;
  }>();

  const numAmount = parseFloat(params.amount ?? "0") || 0;
  const utr = params.utr ?? "";
  const refCode = params.refCode ?? "";
  const bank = useMemo(
    () => (params.bankId ? BANKS.find((b) => b.id === params.bankId) ?? null : null),
    [params.bankId],
  );
  const agent = useMemo(
    () =>
      !bank && params.agentId
        ? P2P_AGENTS.find((a) => a.id === params.agentId) ?? null
        : null,
    [bank, params.agentId],
  );
  const method = useMemo(() => {
    if (bank) {
      return {
        color: bank.color,
        initial: bank.initial,
        label: `${bank.shortName} · NEFT/IMPS`,
      };
    }
    if (agent) {
      return {
        color: agent.avatarColor,
        initial: agent.initial,
        label: `${agent.name} · UPI`,
      };
    }
    return null;
  }, [bank, agent]);
  const txnTime = useMemo(() => formatNow(), []);
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  const [copied, setCopied] = useState<DetailKey | null>(null);

  // Entry animations
  const iconScale = useRef(new Animated.Value(0.4)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 1,
          duration: 600,
          delay: 100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentSlide, {
          toValue: 0,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [iconScale, iconOpacity, ringOpacity, contentOpacity, contentSlide]);

  const copy = async (text: string, key: DetailKey) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  const goToWallet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace("/(tabs)/wallet");
  };

  const goToDeposit = () => {
    Haptics.selectionAsync();
    router.replace("/deposit");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPadding, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Animated.View
              style={[
                styles.ringOuter,
                { opacity: ringOpacity, borderColor: "rgba(34,197,94,0.18)" },
              ]}
            />
            <Animated.View
              style={[
                styles.ringInner,
                { opacity: ringOpacity, borderColor: "rgba(34,197,94,0.32)" },
              ]}
            />
            <Animated.View
              style={{
                opacity: iconOpacity,
                transform: [{ scale: iconScale }],
              }}
            >
              <LinearGradient
                colors={["#22C55E", "#10B981"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.checkBg}
              >
                <Feather name="check" size={44} color="#fff" strokeWidth={3} />
              </LinearGradient>
            </Animated.View>
          </View>

          <Animated.View
            style={{
              opacity: contentOpacity,
              transform: [{ translateY: contentSlide }],
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text style={[styles.eyebrow, { color: colors.green }]}>
              TRANSACTION COMPLETE
            </Text>
            <Text style={[styles.amountTitle, { color: colors.foreground }]}>
              ₹{numAmount.toLocaleString("en-IN")}
            </Text>
            <Text style={[styles.amountSub, { color: colors.textSecondary }]}>
              Added to your wallet · Available now
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: contentSlide }],
            gap: 12,
          }}
        >
          {/* Status banner */}
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: "rgba(34,197,94,0.10)",
                borderColor: "rgba(34,197,94,0.32)",
              },
            ]}
          >
            <Feather name="shield" size={14} color={colors.green} />
            <Text style={[styles.statusText, { color: colors.foreground }]}>
              Verified by AutoTrade · Funds available for trading
            </Text>
          </View>

          {/* Details card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
              TRANSACTION DETAILS
            </Text>

            {method && (
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>
                  Method
                </Text>
                <View style={styles.rowMethodValue}>
                  <View
                    style={[
                      styles.bankDot,
                      {
                        backgroundColor: `${method.color}22`,
                        borderColor: `${method.color}66`,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.bankDotText, { color: method.color }]}
                    >
                      {method.initial}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.rowValue, { color: colors.foreground }]}
                  >
                    {method.label}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.textMuted }]}>
                Amount Credited
              </Text>
              <Text
                style={[
                  styles.rowValue,
                  { color: colors.green, fontFamily: "Inter_700Bold" },
                ]}
              >
                + ₹{numAmount.toLocaleString("en-IN")}
              </Text>
            </View>

            {!!utr && (
              <>
                <View style={styles.divider} />
                <Pressable
                  onPress={() => copy(utr, "utr")}
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.rowLabel, { color: colors.textMuted }]}>
                    UTR / Ref
                  </Text>
                  <View style={styles.rowCopyValue}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.rowValueMono,
                        { color: colors.foreground },
                      ]}
                    >
                      {utr}
                    </Text>
                    <Feather
                      name={copied === "utr" ? "check" : "copy"}
                      size={13}
                      color={
                        copied === "utr" ? colors.green : colors.purpleLight
                      }
                    />
                  </View>
                </Pressable>
              </>
            )}

            {!!refCode && (
              <>
                <View style={styles.divider} />
                <Pressable
                  onPress={() => copy(refCode, "ref")}
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.rowLabel, { color: colors.textMuted }]}>
                    Reference
                  </Text>
                  <View style={styles.rowCopyValue}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.rowValueMono,
                        { color: colors.foreground },
                      ]}
                    >
                      {refCode}
                    </Text>
                    <Feather
                      name={copied === "ref" ? "check" : "copy"}
                      size={13}
                      color={
                        copied === "ref" ? colors.green : colors.purpleLight
                      }
                    />
                  </View>
                </Pressable>
              </>
            )}

            <View style={styles.divider} />

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.textMuted }]}>
                Date & Time
              </Text>
              <Text style={[styles.rowValue, { color: colors.foreground }]}>
                {txnTime}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.textMuted }]}>
                Status
              </Text>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: "rgba(34,197,94,0.12)",
                    borderColor: "rgba(34,197,94,0.4)",
                  },
                ]}
              >
                <View
                  style={[styles.statusDot, { backgroundColor: colors.green }]}
                />
                <Text style={[styles.statusPillText, { color: colors.green }]}>
                  Verified
                </Text>
              </View>
            </View>
          </View>

          {/* CTAs */}
          <Pressable
            onPress={goToWallet}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.purple, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="credit-card" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Back to Wallet</Text>
          </Pressable>

          <Pressable
            onPress={goToDeposit}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: colors.card,
                borderColor: "rgba(168,85,247,0.4)",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="plus-circle" size={15} color={colors.purpleLight} />
            <Text
              style={[styles.secondaryBtnText, { color: colors.purpleLight }]}
            >
              Make Another Deposit
            </Text>
          </Pressable>

          <Text style={[styles.footnote, { color: colors.textMuted }]}>
            Receipt sent to your registered email · Need help? Contact support
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  scroll: { paddingHorizontal: 16, gap: 20 },
  hero: { alignItems: "center", paddingTop: 12, paddingBottom: 4, gap: 20 },
  iconWrap: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
  },
  ringOuter: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
  },
  ringInner: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
  },
  checkBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.6,
  },
  amountTitle: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  amountSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    minWidth: 0,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  cardLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
    textAlign: "right",
  },
  rowValueMono: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    flexShrink: 1,
    textAlign: "right",
  },
  rowMethodValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  rowCopyValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  bankDot: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bankDotText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(148,163,184,0.08)",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 12,
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  footnote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
});
