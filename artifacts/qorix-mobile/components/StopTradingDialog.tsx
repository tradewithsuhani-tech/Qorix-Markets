import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { Touchable } from "@/components/Touchable";
import { useColors } from "@/hooks/useColors";

const RED = "#EF4444";
const GREEN = "#22C55E";
const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.min(SCREEN_W - 32, 380);

interface StopTradingDialogProps {
  visible: boolean;
  capitalAmount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const fmtINR = (n: number) =>
  `₹${Math.floor(Math.abs(n)).toLocaleString("en-IN")}.${(
    Math.abs(n) - Math.floor(Math.abs(n))
  )
    .toFixed(2)
    .slice(2)}`;

export function StopTradingDialog({
  visible,
  capitalAmount,
  onCancel,
  onConfirm,
}: StopTradingDialogProps) {
  const colors = useColors();

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
        <Pressable style={styles.backdrop} onPress={handleCancel}>
          {Platform.OS === "ios" ? (
            <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,8,12,0.78)" }]} />
          )}

          <Pressable onPress={() => {}} style={styles.cardCenter}>
            <Animated.View
              entering={ZoomIn.duration(220).springify().damping(16)}
              style={[
                styles.card,
                {
                  backgroundColor: "#11161E",
                  borderColor: "rgba(239,68,68,0.45)",
                },
              ]}
            >
              {/* Red ambient glow */}
              <LinearGradient
                colors={["rgba(239,68,68,0.18)", "transparent"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.topGlow}
                pointerEvents="none"
              />

              {/* Header row */}
              <View style={styles.headerRow}>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.4)" },
                  ]}
                >
                  <Feather name="square" size={20} color={RED} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.foreground }]}>Stop Trading?</Text>
                  <Text style={[styles.subtitle, { color: RED }]}>
                    THIS WILL HALT YOUR ACTIVE STRATEGY
                  </Text>
                </View>
              </View>

              {/* Body */}
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                Daily profits will stop being credited from the next cycle.{"\n"}Your capital is{" "}
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>
                  never locked
                </Text>{" "}
                — you can resume or redeploy anytime.
              </Text>

              {/* Capital safe callout */}
              <View
                style={[
                  styles.calloutWrap,
                  { borderColor: "rgba(34,197,94,0.4)" },
                ]}
              >
                <LinearGradient
                  colors={["rgba(34,197,94,0.12)", "rgba(34,197,94,0.04)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={[
                    styles.calloutIcon,
                    { backgroundColor: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.45)" },
                  ]}
                >
                  <Feather name="shield" size={16} color={GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.calloutLabel, { color: GREEN }]}>CAPITAL SAFE</Text>
                  <Text style={styles.calloutValue}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>
                      {fmtINR(capitalAmount)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>
                      {"  "}stays in trading balance
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.btnRow}>
                <View style={styles.btnCol}>
                  <Pressable
                    onPress={handleCancel}
                    style={({ pressed }) => [
                      styles.btn,
                      {
                        backgroundColor: pressed ? "#22272F" : "#1A1F28",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
                  </Pressable>
                </View>

                <View style={[styles.btnCol, styles.confirmShadow]}>
                  <Pressable
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                      styles.btn,
                      { opacity: pressed ? 0.92 : 1, overflow: "hidden" },
                    ]}
                  >
                    <LinearGradient
                      colors={["#F87171", "#EF4444", "#DC2626"]}
                      locations={[0, 0.55, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <LinearGradient
                      colors={["rgba(255,255,255,0.30)", "rgba(255,255,255,0)"]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.confirmGloss}
                      pointerEvents="none"
                    />
                    <View style={styles.confirmContent}>
                      <Feather name="square" size={14} color="#FFFFFF" />
                      <Text style={[styles.btnText, { color: "#FFFFFF" }]}>Stop Trading</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
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
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
  },
  body: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginBottom: 16,
  },
  calloutWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
    overflow: "hidden",
  },
  calloutIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calloutLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  calloutValue: {
    fontSize: 13.5,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  btnCol: {
    flex: 1,
    borderRadius: 14,
  },
  btn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmShadow: {
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  confirmGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 22,
  },
  confirmContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
});
