import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface StrategyTier {
  id: "low" | "balanced" | "growth";
  label: string;
  range: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  tintBg: string;
  borderColor: string;
}

interface ActivateTradingCardProps {
  minDeposit?: string;
  onActivate?: (tier: StrategyTier["id"]) => void;
}

export function ActivateTradingCard({ minDeposit = "$10", onActivate }: ActivateTradingCardProps) {
  const colors = useColors();
  const [selected, setSelected] = useState<StrategyTier["id"]>("balanced");

  const tiers: StrategyTier[] = [
    {
      id: "low",
      label: "Low",
      range: "2-5%/mo",
      icon: "shield",
      color: colors.green,
      tintBg: "rgba(34,197,94,0.12)",
      borderColor: "rgba(34,197,94,0.35)",
    },
    {
      id: "balanced",
      label: "Balanced",
      range: "4-6%/mo",
      icon: "bar-chart-2",
      color: colors.blue,
      tintBg: "rgba(59,130,246,0.12)",
      borderColor: "rgba(59,130,246,0.35)",
    },
    {
      id: "growth",
      label: "Growth",
      range: "5-8%/mo",
      icon: "trending-up",
      color: colors.purple,
      tintBg: "rgba(168,85,247,0.12)",
      borderColor: "rgba(168,85,247,0.35)",
    },
  ];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderBright }]}>
      <View pointerEvents="none" style={styles.glowWrap}>
        <View style={[styles.glowBlue, { backgroundColor: colors.blue }]} />
        <View style={[styles.glowPurple, { backgroundColor: colors.purple }]} />
      </View>

      {/* Header */}
      <View style={styles.headerRow}>
        <LinearGradient
          colors={["#3B82F6", "#8B5CF6", "#A855F7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerIcon}
        >
          <Feather name="zap" size={16} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.blueLight }]}>START TRADING</Text>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>Start from </Text>
            <Text style={[styles.title, { color: colors.purpleLight }]}>{minDeposit}</Text>
          </View>
        </View>
        <View style={[styles.lockPill, { borderColor: colors.green, backgroundColor: "rgba(34,197,94,0.10)" }]}>
          <View style={[styles.lockDot, { backgroundColor: colors.green }]} />
          <Text style={[styles.lockText, { color: colors.green }]}>NO LOCK-IN</Text>
        </View>
      </View>

      {/* Strategy chips */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CHOOSE YOUR STRATEGY</Text>
      <View style={styles.tierRow}>
        {tiers.map((t) => {
          const active = selected === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => { Haptics.selectionAsync(); setSelected(t.id); }}
              style={({ pressed }) => [
                styles.tierCard,
                {
                  backgroundColor: active ? t.tintBg : colors.card2,
                  borderColor: active ? t.borderColor : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={[styles.tierIcon, { backgroundColor: t.tintBg, borderColor: t.borderColor }]}>
                <Feather name={t.icon} size={14} color={t.color} />
              </View>
              <Text style={[styles.tierLabel, { color: t.color }]}>{t.label}</Text>
              <Text style={[styles.tierRange, { color: colors.textSecondary }]}>{t.range}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* CTA */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onActivate?.(selected);
        }}
        style={({ pressed }) => [styles.ctaWrap, { opacity: pressed ? 0.9 : 1 }]}
      >
        <LinearGradient
          colors={["#3B82F6", "#8B5CF6", "#A855F7", "#EC4899"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cta}
        >
          <Feather name="zap" size={16} color="#fff" />
          <Text style={styles.ctaText}>Activate Trading</Text>
          <Feather name="arrow-right" size={16} color="#fff" />
        </LinearGradient>
      </Pressable>

      {/* Footer guarantees */}
      <View style={styles.footerRow}>
        {[
          { icon: "check-circle" as const, label: "Start small" },
          { icon: "check-circle" as const, label: "Scale anytime" },
          { icon: "check-circle" as const, label: "1-click withdraw" },
        ].map((f, i, arr) => (
          <React.Fragment key={f.label}>
            <View style={styles.footerItem}>
              <Feather name={f.icon} size={11} color={colors.green} />
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>{f.label}</Text>
            </View>
            {i < arr.length - 1 && <Text style={[styles.footerDot, { color: colors.textMuted }]}>·</Text>}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    overflow: "hidden",
    position: "relative",
  },
  glowWrap: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  glowBlue: { position: "absolute", width: 200, height: 200, borderRadius: 100, opacity: 0.10, top: -80, left: -60 },
  glowPurple: { position: "absolute", width: 220, height: 220, borderRadius: 110, opacity: 0.12, bottom: -100, right: -80 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, zIndex: 1 },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1.4 },
  titleRow: { flexDirection: "row", alignItems: "baseline", marginTop: 2 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  lockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  lockDot: { width: 5, height: 5, borderRadius: 2.5 },
  lockText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  sectionLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1.2, marginTop: 4 },
  tierRow: { flexDirection: "row", gap: 8, zIndex: 1 },
  tierCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
  },
  tierIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 2,
  },
  tierLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  tierRange: { fontSize: 10, fontFamily: "Inter_500Medium" },
  ctaWrap: { borderRadius: 14, overflow: "hidden", zIndex: 1 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  ctaText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.3 },
  footerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  footerDot: { fontSize: 12, fontFamily: "Inter_700Bold" },
});
