import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface StatPillCardProps {
  label: string;
  value: string;
  decimals?: string;
  trend?: string;
  trendColor?: string;
  hint?: string;
  hintColor?: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor?: string;
  badge?: { text: string; color: string; bg: string };
  width?: number | string;
}

function hexToRgba(hex: string, alpha: number) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function StatPillCard({
  label,
  value,
  decimals,
  trend,
  trendColor,
  hint,
  hintColor,
  icon,
  iconColor,
  badge,
  width,
}: StatPillCardProps) {
  const colors = useColors();
  const cardWidth = width as any;
  const accent = iconColor ?? colors.green;

  // Detect direction-positive trends for a tiny up-arrow chevron
  const isPositiveTrend = trend ? /^\+|up/i.test(trend) : false;
  const isNegativeTrend = trend ? /^-|down/i.test(trend) : false;
  const showTrendChip = !!trend && (isPositiveTrend || isNegativeTrend);

  return (
    <LinearGradient
      colors={["#161D29", "#0E1318"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.6, y: 1 }}
      style={[
        styles.card,
        {
          borderColor: "rgba(255,255,255,0.06)",
          width: cardWidth,
          shadowColor: accent,
        },
      ]}
    >
      {/* Soft accent glow in the upper-right corner */}
      <View
        pointerEvents="none"
        style={[
          styles.cornerGlow,
          { backgroundColor: accent },
        ]}
      />

      {/* Hairline top accent */}
      <LinearGradient
        colors={[hexToRgba(accent, 0), hexToRgba(accent, 0.55), hexToRgba(accent, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topAccent}
        pointerEvents="none"
      />

      {/* Header: label + premium gradient icon */}
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.iconShellWrap}>
          <View
            pointerEvents="none"
            style={[styles.iconHalo, { backgroundColor: accent, shadowColor: accent }]}
          />
          <LinearGradient
            colors={[hexToRgba(accent, 0.55), hexToRgba(accent, 0.10)]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[
              styles.iconShell,
              { borderColor: hexToRgba(accent, 0.55), shadowColor: accent },
            ]}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.30)", "rgba(255,255,255,0)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.7 }}
              style={styles.iconShellHighlight}
              pointerEvents="none"
            />
            <Feather name={icon} size={13} color="#fff" />
          </LinearGradient>
        </View>
      </View>

      {/* Value */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.foreground }]} numberOfLines={1}>
          {value}
        </Text>
        {decimals && (
          <Text style={[styles.decimals, { color: colors.textSecondary }]}>{decimals}</Text>
        )}
      </View>

      {/* Bottom: badge + trend pill / hint */}
      {(trend || badge || hint) && (
        <View style={styles.bottomRow}>
          {badge && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: badge.bg,
                  borderColor: hexToRgba(badge.color, 0.35),
                },
              ]}
            >
              <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
            </View>
          )}
          {trend && (
            showTrendChip ? (
              <View
                style={[
                  styles.trendChip,
                  {
                    backgroundColor: hexToRgba(trendColor ?? colors.green, 0.12),
                    borderColor: hexToRgba(trendColor ?? colors.green, 0.32),
                  },
                ]}
              >
                <Feather
                  name={isPositiveTrend ? "arrow-up-right" : "arrow-down-right"}
                  size={9}
                  color={trendColor ?? colors.green}
                />
                <Text style={[styles.trendChipText, { color: trendColor ?? colors.green }]} numberOfLines={1}>
                  {trend.replace(/^\+/, "")}
                </Text>
              </View>
            ) : (
              <Text style={[styles.trend, { color: trendColor ?? colors.textSecondary }]} numberOfLines={1}>
                {trend}
              </Text>
            )
          )}
          {hint && (
            <Text style={[styles.hint, { color: hintColor ?? colors.textMuted }]} numberOfLines={1}>
              {hint}
            </Text>
          )}
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    paddingTop: 13,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    minHeight: 104,
    overflow: "hidden",
    position: "relative",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  cornerGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -60,
    right: -40,
    opacity: 0.08,
  },
  topAccent: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
  },
  label: {
    fontSize: 9.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.3,
    flex: 1,
    paddingRight: 8,
  },
  iconShellWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  iconHalo: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.18,
    shadowOpacity: 0.85,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  iconShell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  iconShellHighlight: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    height: 13,
    borderRadius: 14,
  },
  valueRow: { flexDirection: "row", alignItems: "baseline", zIndex: 1 },
  value: { fontSize: 21, fontFamily: "Inter_700Bold", letterSpacing: -0.7 },
  decimals: { fontSize: 12, fontFamily: "Inter_600SemiBold", opacity: 0.6, marginLeft: 1 },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    zIndex: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  badgeDot: { width: 4, height: 4, borderRadius: 2 },
  badgeText: { fontSize: 8.5, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  trendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  trendChipText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.1 },
  trend: { fontSize: 10.5, fontFamily: "Inter_600SemiBold" },
  hint: { fontSize: 10, fontFamily: "Inter_500Medium", flexShrink: 1 },
});
