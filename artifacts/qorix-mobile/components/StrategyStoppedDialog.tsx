import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  ZoomIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

const GREEN = "#22C55E";
const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.min(SCREEN_W - 32, 380);

interface StrategyStoppedDialogProps {
  visible: boolean;
  capitalAmount: number;
  totalPnL: number;
  onDismiss: () => void;
  onViewWallet: () => void;
  onRedeploy: () => void;
}

const fmtINR = (n: number) =>
  `₹${Math.floor(Math.abs(n)).toLocaleString("en-IN")}.${(
    Math.abs(n) - Math.floor(Math.abs(n))
  )
    .toFixed(2)
    .slice(2)}`;

export function StrategyStoppedDialog({
  visible,
  capitalAmount,
  totalPnL,
  onDismiss,
  onViewWallet,
  onRedeploy,
}: StrategyStoppedDialogProps) {
  const colors = useColors();

  const ring = useSharedValue(0);
  const check = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      ring.value = 0;
      check.value = 0;
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    check.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.back(2)) });
    ring.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [visible, ring, check]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring.value, [0, 1], [1, 1.6]) }],
    opacity: interpolate(ring.value, [0, 1], [0.6, 0]),
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring.value, [0, 1], [1, 1.9]) }],
    opacity: interpolate(ring.value, [0, 1], [0.4, 0]),
  }));
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(check.value, [0, 1], [0.4, 1]) }],
    opacity: check.value,
  }));

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  const isProfit = totalPnL >= 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
        <Pressable style={styles.backdrop} onPress={handleDismiss}>
          {Platform.OS === "ios" ? (
            <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,8,12,0.78)" }]} />
          )}

          <Pressable onPress={() => {}} style={styles.cardCenter}>
            <Animated.View
              entering={ZoomIn.duration(260).springify().damping(15)}
              style={[
                styles.card,
                { backgroundColor: "#11161E", borderColor: "rgba(34,197,94,0.4)" },
              ]}
            >
              {/* Green ambient glow */}
              <LinearGradient
                colors={["rgba(34,197,94,0.18)", "transparent"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.topGlow}
                pointerEvents="none"
              />

              {/* Success badge */}
              <View style={styles.badgeWrap}>
                <Animated.View
                  style={[
                    styles.ringBase,
                    { borderColor: "rgba(34,197,94,0.6)" },
                    ring1Style,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.ringBase,
                    { borderColor: "rgba(34,197,94,0.4)" },
                    ring2Style,
                  ]}
                />
                <Animated.View style={[styles.badge, checkStyle]}>
                  <LinearGradient
                    colors={["#34D399", "#22C55E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Feather name="check" size={32} color="#FFFFFF" strokeWidth={3.5} />
                </Animated.View>
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.foreground }]}>Strategy Stopped</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Your active strategy has been halted successfully.{"\n"}No new trades will be opened.
              </Text>

              {/* Stat cards */}
              <View style={styles.statRow}>
                <View
                  style={[
                    styles.statCard,
                    { backgroundColor: "#1A1F28", borderColor: "rgba(255,255,255,0.06)" },
                  ]}
                >
                  <View style={styles.statIconRow}>
                    <Feather name="shield" size={11} color={GREEN} />
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Capital Returned
                    </Text>
                  </View>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>
                    {fmtINR(capitalAmount)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statCard,
                    { backgroundColor: "#1A1F28", borderColor: "rgba(255,255,255,0.06)" },
                  ]}
                >
                  <View style={styles.statIconRow}>
                    <Feather
                      name={isProfit ? "trending-up" : "trending-down"}
                      size={11}
                      color={isProfit ? GREEN : "#EF4444"}
                    />
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Final P&L
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.statValue,
                      { color: isProfit ? GREEN : "#EF4444" },
                    ]}
                  >
                    {isProfit ? "+" : "-"}
                    {fmtINR(totalPnL)}
                  </Text>
                </View>
              </View>

              {/* Info chip */}
              <View
                style={[
                  styles.infoChip,
                  { backgroundColor: "rgba(168,85,247,0.10)", borderColor: "rgba(168,85,247,0.3)" },
                ]}
              >
                <Feather name="info" size={12} color={colors.purple} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Funds are now in your trading balance. You can withdraw or redeploy anytime.
                </Text>
              </View>

              {/* Buttons */}
              <View style={styles.btnRow}>
                <View style={styles.btnCol}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onViewWallet();
                    }}
                    style={({ pressed }) => [
                      styles.btn,
                      {
                        backgroundColor: pressed ? "#22272F" : "#1A1F28",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Feather name="credit-card" size={14} color={colors.foreground} />
                    <Text style={[styles.btnText, { color: colors.foreground }]}>View Wallet</Text>
                  </Pressable>
                </View>

                <View style={[styles.btnCol, styles.confirmShadow]}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onRedeploy();
                    }}
                    style={({ pressed }) => [
                      styles.btn,
                      { opacity: pressed ? 0.92 : 1, overflow: "hidden" },
                    ]}
                  >
                    <LinearGradient
                      colors={["#60A5FA", "#A855F7", "#EC4899"]}
                      locations={[0, 0.5, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <LinearGradient
                      colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.gloss}
                      pointerEvents="none"
                    />
                    <View style={styles.contentRow}>
                      <Feather name="zap" size={14} color="#FFFFFF" />
                      <Text style={[styles.btnText, { color: "#FFFFFF" }]}>Redeploy</Text>
                    </View>
                  </Pressable>
                </View>
              </View>

              {/* Dismiss link */}
              <Pressable onPress={handleDismiss} style={styles.dismissRow}>
                <Text style={[styles.dismissText, { color: colors.textMuted }]}>Dismiss</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cardCenter: { alignItems: "center" },
  card: {
    width: CARD_W,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    overflow: "hidden",
    alignItems: "center",
  },
  topGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 140 },
  badgeWrap: {
    width: 86,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 14,
  },
  ringBase: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 12,
  },
  title: {
    fontSize: 21,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  statLabel: { fontSize: 10.5, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  infoChip: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 11.5, fontFamily: "Inter_400Regular", lineHeight: 15 },
  btnRow: { flexDirection: "row", gap: 10, width: "100%" },
  btnCol: { flex: 1, borderRadius: 14 },
  btn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  confirmShadow: {
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  gloss: { position: "absolute", top: 0, left: 0, right: 0, height: 20 },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  btnText: { fontSize: 13.5, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  dismissRow: { marginTop: 14, paddingVertical: 4 },
  dismissText: { fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 0.4 },
});
