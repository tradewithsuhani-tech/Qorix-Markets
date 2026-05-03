import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { useAuth, RiskTier } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const TIERS: {
  id: RiskTier;
  label: string;
  returns: string;
  drawdown: string;
  lock: string;
  strategy: string;
  color: string;
  bg: string;
}[] = [
  {
    id: "conservative",
    label: "Conservative",
    returns: "5 – 8% / month",
    drawdown: "Max 5%",
    lock: "30 days",
    strategy: "EMA 9/21 crossover + RSI filter",
    color: "#4A9EFF",
    bg: "rgba(74,158,255,0.08)",
  },
  {
    id: "moderate",
    label: "Moderate",
    returns: "10 – 15% / month",
    drawdown: "Max 12%",
    lock: "30 days",
    strategy: "Momentum breakout + MACD divergence",
    color: "#C9A84C",
    bg: "rgba(201,168,76,0.08)",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    returns: "18 – 25% / month",
    drawdown: "Max 20%",
    lock: "30 days",
    strategy: "Order book imbalance + volume spike",
    color: "#E74C3C",
    bg: "rgba(231,76,60,0.08)",
  },
];

export default function RiskSelectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setRiskProfile, user } = useAuth();

  const [selected, setSelected] = useState<RiskTier>(user?.riskTier ?? null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setRiskProfile(selected);
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={[styles.tag, { color: colors.gold, backgroundColor: "rgba(201,168,76,0.1)", borderColor: colors.borderBright }]}>
            RISK PROFILE
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Select your risk tier</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Your risk profile determines which algorithm runs and your expected return range. Profile locks for 30 days after selection.
          </Text>
        </View>

        <View style={styles.tiers}>
          {TIERS.map((tier) => {
            const isActive = selected === tier.id;
            return (
              <Pressable
                key={tier.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelected(tier.id);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[
                  styles.tierCard,
                  {
                    backgroundColor: isActive ? tier.bg : colors.card,
                    borderColor: isActive ? tier.color : colors.border,
                    borderWidth: isActive ? 1.5 : 1,
                  },
                ]}>
                  <View style={styles.tierHeader}>
                    <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
                    <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
                    {isActive && (
                      <View style={[styles.selectedBadge, { backgroundColor: tier.color }]}>
                        <Feather name="check" size={10} color="#fff" />
                      </View>
                    )}
                  </View>

                  <Text style={[styles.tierReturns, { color: colors.foreground }]}>
                    {tier.returns}
                  </Text>

                  <View style={[styles.tierDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.tierStats}>
                    {[
                      { label: "Max Drawdown", value: tier.drawdown, icon: "trending-down" as const },
                      { label: "Lock Period", value: tier.lock, icon: "clock" as const },
                    ].map((s) => (
                      <View key={s.label} style={styles.tierStat}>
                        <Feather name={s.icon} size={12} color={colors.textMuted} />
                        <View>
                          <Text style={[styles.tierStatLabel, { color: colors.textMuted }]}>{s.label}</Text>
                          <Text style={[styles.tierStatValue, { color: colors.textSecondary }]}>{s.value}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={[styles.strategyRow, { backgroundColor: `${tier.color}10` }]}>
                    <Feather name="cpu" size={11} color={tier.color} />
                    <Text style={[styles.strategyText, { color: tier.color }]} numberOfLines={1}>
                      {tier.strategy}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.textMuted} />
          <Text style={[styles.noticeText, { color: colors.textMuted }]}>
            Returns are estimates based on historical performance. Past performance does not guarantee future results. All trading involves risk.
          </Text>
        </View>

        <Pressable
          onPress={handleConfirm}
          disabled={!selected || loading}
          style={({ pressed }) => [
            styles.confirmBtn,
            {
              backgroundColor: selected ? colors.gold : colors.secondary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.confirmText, { color: selected ? colors.primaryForeground : colors.textMuted }]}>
              {selected ? `Confirm ${TIERS.find((t) => t.id === selected)?.label ?? ""} Profile` : "Select a risk tier"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 16 },
  topRow: { flexDirection: "row" },
  backBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  header: { gap: 8 },
  tag: {
    fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
    alignSelf: "flex-start",
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  tiers: { gap: 10 },
  tierCard: { borderRadius: 14, padding: 16, gap: 10 },
  tierHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierLabel: { fontSize: 15, fontFamily: "Inter_700Bold", flex: 1 },
  selectedBadge: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  tierReturns: { fontSize: 22, fontFamily: "Inter_700Bold" },
  tierDivider: { height: 1 },
  tierStats: { flexDirection: "row", gap: 20 },
  tierStat: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  tierStatLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  tierStatValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  strategyRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  strategyText: { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 },
  notice: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  noticeText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  confirmBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  confirmText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
