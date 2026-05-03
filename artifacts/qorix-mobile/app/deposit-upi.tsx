import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { P2P_AGENTS, type AgentBadge, type P2pAgent } from "@/constants/p2pAgents";
import { useColors } from "@/hooks/useColors";

type Filter = "all" | "premium" | "verified";

const formatOrders = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : n.toString();

const formatLimit = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L` : `₹${n.toLocaleString("en-IN")}`;

export default function DepositUpiScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string }>();

  const [filter, setFilter] = useState<Filter>("all");

  const numAmount = parseFloat(params.amount ?? "0") || 0;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  const visibleAgents = useMemo(() => {
    if (filter === "premium") return P2P_AGENTS.filter((a) => a.badge === "PREMIUM");
    if (filter === "verified")
      return P2P_AGENTS.filter((a) => a.badge === "VERIFIED" || a.badge === "PREMIUM");
    return P2P_AGENTS;
  }, [filter]);

  const handlePay = (agent: P2pAgent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/deposit-upi-pay",
      params: { agentId: agent.id, amount: String(numAmount) },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPadding, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Header row: back + eyebrow + amount */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.eyebrow, { color: colors.purple }]}>SELECT P2P AGENT</Text>
            <Text style={[styles.payTitle, { color: colors.foreground }]}>
              Pay ₹{numAmount.toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={styles.backBtnSpacer} />
        </View>

        {/* Escrow banner */}
        <View
          style={[
            styles.escrow,
            {
              backgroundColor: "rgba(34,197,94,0.10)",
              borderColor: "rgba(34,197,94,0.35)",
            },
          ]}
        >
          <Feather name="shield" size={14} color={colors.green} />
          <Text style={[styles.escrowText, { color: colors.foreground }]}>
            Escrow-protected ·{" "}
            <Text style={{ color: colors.textSecondary }}>Funds released after agent confirms</Text>
          </Text>
        </View>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {(
            [
              { id: "all", label: "All Agents" },
              { id: "premium", label: "Premium" },
              { id: "verified", label: "Verified" },
            ] as const
          ).map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilter(f.id);
                }}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? "rgba(168,85,247,0.18)" : colors.card,
                    borderColor: active ? colors.purple : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: active ? colors.purple : colors.textSecondary },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Agent list */}
        <View style={styles.agents}>
          {visibleAgents.length === 0 && (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="users" size={20} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No agents match this filter
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilter("all");
                }}
                style={({ pressed }) => [
                  styles.emptyResetBtn,
                  {
                    borderColor: colors.purple,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.emptyResetText, { color: colors.purple }]}>
                  Show all agents
                </Text>
              </Pressable>
            </View>
          )}
          {visibleAgents.map((agent) => {
            const eligible =
              numAmount >= agent.limitMin && numAmount <= agent.limitMax;
            return (
              <View
                key={agent.id}
                style={[
                  styles.agentCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {/* Avatar */}
                <View style={styles.avatarWrap}>
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: agent.avatarColor + "33",
                        borderColor: agent.avatarColor + "66",
                      },
                    ]}
                  >
                    <Text style={[styles.avatarInitial, { color: agent.avatarColor }]}>
                      {agent.initial}
                    </Text>
                  </View>
                  {agent.online && (
                    <View
                      style={[
                        styles.onlineDot,
                        {
                          backgroundColor: colors.green,
                          borderColor: colors.card,
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Middle: name + stats */}
                <View style={styles.middle}>
                  <View style={styles.nameRow}>
                    <Text
                      numberOfLines={1}
                      style={[styles.agentName, { color: colors.foreground }]}
                    >
                      {agent.name}
                    </Text>
                    {agent.badge && <Badge type={agent.badge} />}
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Feather name="star" size={10} color={colors.purple} />
                      <Text style={[styles.statText, { color: colors.textSecondary }]}>
                        {agent.rating.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={[styles.statDot, { color: colors.textMuted }]}>·</Text>
                    <Text style={[styles.statText, { color: colors.textSecondary }]}>
                      {formatOrders(agent.orderCount)} orders
                    </Text>
                    <Text style={[styles.statDot, { color: colors.textMuted }]}>·</Text>
                    <View style={styles.statItem}>
                      <Feather name="clock" size={10} color={colors.textMuted} />
                      <Text style={[styles.statText, { color: colors.textSecondary }]}>
                        {agent.responseTime}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.limit, { color: colors.textMuted }]}>
                    LIMIT{" "}
                    <Text style={{ color: eligible ? colors.textSecondary : colors.red }}>
                      {formatLimit(agent.limitMin)} – {formatLimit(agent.limitMax)}
                    </Text>
                  </Text>
                </View>

                {/* Pay button */}
                <Pressable
                  onPress={() => handlePay(agent)}
                  disabled={!eligible}
                  style={({ pressed }) => [
                    styles.payBtn,
                    {
                      backgroundColor: eligible ? colors.purple : colors.secondary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.payBtnText,
                      { color: eligible ? "#fff" : colors.textMuted },
                    ]}
                  >
                    Pay
                  </Text>
                  <Feather
                    name="chevron-right"
                    size={14}
                    color={eligible ? "#fff" : colors.textMuted}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Footer note */}
        <View style={styles.footerNote}>
          <Feather name="info" size={11} color={colors.textMuted} />
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            All agents are KYC-verified · 24/7 dispute support · 0% gateway fees
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Badge({ type }: { type: NonNullable<AgentBadge> }) {
  const colors = useColors();
  if (type === "PREMIUM") {
    return (
      <View
        style={[
          styles.badge,
          { backgroundColor: "rgba(168,85,247,0.18)", borderColor: "rgba(168,85,247,0.45)" },
        ]}
      >
        <Feather name="award" size={9} color={colors.purple} />
        <Text style={[styles.badgeText, { color: colors.purple }]}>PREMIUM</Text>
      </View>
    );
  }
  if (type === "VERIFIED") {
    return (
      <View
        style={[
          styles.badge,
          { backgroundColor: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.45)" },
        ]}
      >
        <Feather name="check" size={9} color={colors.green} />
        <Text style={[styles.badgeText, { color: colors.green }]}>VERIFIED</Text>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: "rgba(236,72,153,0.18)", borderColor: "rgba(236,72,153,0.45)" },
      ]}
    >
      <Feather name="zap" size={9} color="#EC4899" />
      <Text style={[styles.badgeText, { color: "#EC4899" }]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  scroll: { paddingHorizontal: 16, gap: 14 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnSpacer: { width: 40 },
  headerCenter: { flex: 1, alignItems: "center", minWidth: 0 },
  eyebrow: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  payTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  escrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  escrowText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", minWidth: 0 },
  filterRow: { flexDirection: "row", gap: 8 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  agents: { gap: 8 },
  agentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatarWrap: { width: 44, height: 44, position: "relative" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 18, fontFamily: "Inter_700Bold" },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  middle: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  agentName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  statItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  statDot: { fontSize: 11, fontFamily: "Inter_500Medium" },
  limit: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 8,
    minWidth: 72,
    justifyContent: "center",
  },
  payBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  footerText: { flex: 1, fontSize: 10, fontFamily: "Inter_400Regular", minWidth: 0 },
  emptyState: {
    alignItems: "center",
    gap: 8,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  emptyResetBtn: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  emptyResetText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
});
