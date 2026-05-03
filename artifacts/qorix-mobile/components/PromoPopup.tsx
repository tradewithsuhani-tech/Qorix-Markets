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
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Touchable } from "@/components/Touchable";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.min(SCREEN_W - 36, 360);

interface PromoPopupProps {
  visible: boolean;
  onClose: () => void;
  onCtaPress?: () => void;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  ctaLabel?: string;
}

export function PromoPopup({
  visible,
  onClose,
  onCtaPress,
  eyebrow = "Limited time offer",
  title = "Unlock up to",
  subtitle = "10% Bonus on first deposit",
  description = "Deposit ₹5,000 or more in the next 24 hours and get an instant 10% bonus credited to your trading wallet.",
  ctaLabel = "START EXPLORING NOW",
}: PromoPopupProps) {
  const colors = useColors();

  const float = useSharedValue(0);
  const sheen = useSharedValue(0);
  const ringPulse = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    float.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    sheen.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.linear }),
      -1,
      false,
    );
    ringPulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [visible, float, sheen, ringPulse]);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [-6, 6]) },
      { rotate: `${interpolate(float.value, [0, 1], [-3, 3])}deg` },
    ],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(sheen.value, [0, 1], [-CARD_W, CARD_W]) },
      { rotate: "20deg" },
    ],
    opacity: interpolate(sheen.value, [0, 0.4, 1], [0, 0.5, 0], Extrapolation.CLAMP),
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ringPulse.value, [0, 1], [0.95, 1.18]) }],
    opacity: interpolate(ringPulse.value, [0, 1], [0.5, 0]),
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ringPulse.value, [0, 1], [1.05, 1.3]) }],
    opacity: interpolate(ringPulse.value, [0, 1], [0.35, 0]),
  }));

  const handleCta = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCtaPress?.();
    onClose();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,8,12,0.78)" }]} />
        )}

        <Pressable onPress={() => {}} style={styles.cardWrap}>
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: "#11161E", borderColor: "rgba(168,85,247,0.35)" },
            ]}
            entering={undefined}
          >
            {/* Ambient gradient corner glow */}
            <LinearGradient
              colors={["rgba(168,85,247,0.22)", "rgba(236,72,153,0.10)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cornerGlow}
              pointerEvents="none"
            />
            <LinearGradient
              colors={["transparent", "rgba(96,165,250,0.12)", "rgba(168,85,247,0.18)"]}
              start={{ x: 1, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={styles.cornerGlow}
              pointerEvents="none"
            />

            {/* Sheen sweep */}
            <View style={styles.sheenClip} pointerEvents="none">
              <Animated.View style={[styles.sheen, sheenStyle]}>
                <LinearGradient
                  colors={["transparent", "rgba(255,255,255,0.10)", "transparent"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>

            {/* Eyebrow pill */}
            <View style={styles.eyebrowWrap}>
              <LinearGradient
                colors={["rgba(168,85,247,0.18)", "rgba(236,72,153,0.18)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.eyebrow}
              >
                <Feather name="zap" size={10} color={colors.gold} />
                <Text style={[styles.eyebrowText, { color: colors.gold }]}>{eyebrow}</Text>
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
            <View style={styles.subtitleWrap}>
              <Text style={styles.subtitle}>
                <Text style={styles.subtitleAccent}>10%</Text>
                <Text style={[styles.subtitleRest, { color: colors.foreground }]}>
                  {subtitle.replace("10%", "")}
                </Text>
              </Text>
            </View>

            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {description}
            </Text>

            {/* Hero visual */}
            <View style={styles.heroWrap}>
              {/* Pulse rings */}
              <Animated.View
                style={[styles.ring, { borderColor: "rgba(168,85,247,0.6)" }, ring1Style]}
              />
              <Animated.View
                style={[styles.ring, { borderColor: "rgba(236,72,153,0.5)" }, ring2Style]}
              />

              {/* Floating gift box */}
              <Animated.View style={[styles.heroBox, heroStyle]}>
                <LinearGradient
                  colors={[colors.purple, colors.pink]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroBoxInner}
                >
                  <Text style={styles.heroPercent}>10%</Text>
                  <Text style={styles.heroBoxLabel}>BONUS</Text>
                </LinearGradient>
                {/* Ribbon */}
                <View style={styles.ribbon}>
                  <Feather name="gift" size={11} color="#FFFFFF" />
                </View>
              </Animated.View>

              {/* Coin badges */}
              <View style={[styles.coin, styles.coinTL, { backgroundColor: "#1A1F28", borderColor: "rgba(96,165,250,0.4)" }]}>
                <Text style={styles.coinSym}>₿</Text>
              </View>
              <View style={[styles.coin, styles.coinTR, { backgroundColor: "#1A1F28", borderColor: "rgba(168,85,247,0.4)" }]}>
                <Text style={[styles.coinSym, { color: colors.purple }]}>Ξ</Text>
              </View>
              <View style={[styles.coin, styles.coinBL, { backgroundColor: "#1A1F28", borderColor: "rgba(34,197,94,0.4)" }]}>
                <Text style={[styles.coinSym, { color: colors.green, fontSize: 11 }]}>USDT</Text>
              </View>
              <View style={[styles.coin, styles.coinBR, { backgroundColor: "#1A1F28", borderColor: "rgba(236,72,153,0.4)" }]}>
                <Text style={[styles.coinSym, { color: colors.pink }]}>◈</Text>
              </View>
            </View>

            {/* CTA */}
            <Touchable
              onPress={handleCta}
              haptic="none"
              scaleTo={0.96}
              style={styles.ctaWrap}
            >
              <View style={styles.ctaShadow}>
                <LinearGradient
                  colors={["#60A5FA", "#A855F7", "#EC4899"]}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.cta}
                >
                  {/* Inner top highlight for glossy feel */}
                  <LinearGradient
                    colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.ctaGloss}
                    pointerEvents="none"
                  />
                  <Text style={styles.ctaText}>{ctaLabel}</Text>
                  <View style={styles.ctaArrowWrap}>
                    <Feather name="arrow-right" size={15} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </View>
            </Touchable>

            {/* Fine print */}
            <Text style={[styles.fine, { color: colors.textMuted }]}>
              T&Cs apply · Offer ends in 24h
            </Text>
          </Animated.View>

          {/* Close button below */}
          <Touchable
            onPress={handleClose}
            haptic="light"
            scaleTo={0.88}
            style={[styles.closeBtn, { backgroundColor: "#1A1F28", borderColor: "rgba(255,255,255,0.12)" }]}
          >
            <Feather name="x" size={18} color={colors.textSecondary} />
          </Touchable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  cardWrap: {
    alignItems: "center",
    gap: 16,
  },
  card: {
    width: CARD_W,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: "center",
    overflow: "hidden",
  },
  cornerGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheenClip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  sheen: {
    position: "absolute",
    top: -50,
    bottom: -50,
    width: 90,
  },
  eyebrowWrap: { marginBottom: 12 },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  eyebrowText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  subtitleWrap: { marginTop: 4, marginBottom: 10 },
  subtitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 28,
  },
  subtitleAccent: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#A855F7",
  },
  subtitleRest: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  description: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
    marginBottom: 18,
  },
  heroWrap: {
    width: "100%",
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  ring: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
  },
  heroBox: {
    width: 96,
    height: 96,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBoxInner: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  heroPercent: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  heroBoxLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.92)",
    letterSpacing: 1.5,
    marginTop: -2,
  },
  ribbon: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EC4899",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#11161E",
  },
  coin: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  coinSym: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#60A5FA",
  },
  coinTL: { top: 8, left: 12 },
  coinTR: { top: 14, right: 18 },
  coinBL: { bottom: 6, left: 18 },
  coinBR: { bottom: 12, right: 8 },
  ctaWrap: { width: "100%" },
  ctaShadow: {
    borderRadius: 999,
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 12,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 999,
    paddingHorizontal: 22,
    overflow: "hidden",
  },
  ctaGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 22,
  },
  ctaText: {
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 0.8,
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ctaArrowWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  fine: {
    fontSize: 10.5,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
