import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TransactionItem } from "@/components/TransactionItem";
import {
  usePortfolio,
  type Transaction,
  type TransactionType,
  type TransactionStatus,
} from "@/context/PortfolioContext";
import { useColors } from "@/hooks/useColors";

const TYPE_FILTERS: { label: string; value: "all" | TransactionType }[] = [
  { label: "All", value: "all" },
  { label: "Deposit", value: "deposit" },
  { label: "Withdrawal", value: "withdrawal" },
  { label: "Transfer", value: "transfer" },
  { label: "Income", value: "income" },
  { label: "Fee", value: "fee" },
];

const STATUS_FILTERS: { label: string; value: "all" | TransactionStatus }[] = [
  { label: "All status", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
];

const ACCENT = "#EAB308";

export default function TransactionHistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { transactions } = usePortfolio();

  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TransactionStatus>("all");
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const activeCount =
    (typeFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx: Transaction) => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      if (q && !tx.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [transactions, typeFilter, statusFilter, query]);

  const totals = useMemo(() => {
    let credit = 0;
    let debit = 0;
    for (const tx of filtered) {
      const isCredit = tx.type === "deposit" || tx.type === "income";
      const isNeutral = tx.type === "transfer";
      if (isNeutral) continue;
      if (isCredit) credit += tx.amount;
      else debit += tx.amount;
    }
    return { credit, debit, net: credit - debit };
  }, [filtered]);

  const topPadding = insets.top + (Platform.OS === "web" ? 16 : 16);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header with back + title + filter icon */}
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Transaction History
          </Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            {filtered.length} of {transactions.length} transactions
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setFilterOpen(true);
          }}
          style={({ pressed }) => [
            styles.filterIconBtn,
            {
              borderColor: activeCount > 0 ? ACCENT : "rgba(234,179,8,0.4)",
              backgroundColor:
                activeCount > 0 ? "rgba(234,179,8,0.16)" : "rgba(234,179,8,0.06)",
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          hitSlop={8}
        >
          <Feather name="filter" size={16} color={ACCENT} />
          {activeCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: ACCENT }]}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 32 },
        ]}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            {/* Search */}
            <Animated.View
              entering={FadeInDown.duration(400)}
              style={[
                styles.searchBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="search" size={15} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by description"
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.foreground }]}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <Feather name="x" size={15} color={colors.textMuted} />
                </Pressable>
              )}
            </Animated.View>

            {/* Summary */}
            <Animated.View
              entering={FadeInDown.duration(400).delay(60)}
              style={[
                styles.summaryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLbl, { color: colors.textMuted }]}>IN</Text>
                <Text style={[styles.summaryVal, { color: colors.green }]}>
                  +₹{totals.credit.toLocaleString("en-IN")}
                </Text>
              </View>
              <View style={[styles.summaryDiv, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLbl, { color: colors.textMuted }]}>OUT</Text>
                <Text style={[styles.summaryVal, { color: colors.red }]}>
                  -₹{totals.debit.toLocaleString("en-IN")}
                </Text>
              </View>
              <View style={[styles.summaryDiv, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLbl, { color: colors.textMuted }]}>NET</Text>
                <Text
                  style={[
                    styles.summaryVal,
                    { color: totals.net >= 0 ? colors.green : colors.red },
                  ]}
                >
                  {totals.net >= 0 ? "+" : "-"}₹
                  {Math.abs(totals.net).toLocaleString("en-IN")}
                </Text>
              </View>
            </Animated.View>

            {/* Active filter pills inline (read-only quick view) */}
            {activeCount > 0 && (
              <Animated.View
                entering={FadeInDown.duration(300)}
                style={styles.activePills}
              >
                {typeFilter !== "all" && (
                  <View style={[styles.activePill, { borderColor: ACCENT }]}>
                    <Text style={[styles.activePillText, { color: ACCENT }]}>
                      {TYPE_FILTERS.find((f) => f.value === typeFilter)?.label}
                    </Text>
                    <Pressable onPress={() => setTypeFilter("all")} hitSlop={6}>
                      <Feather name="x" size={11} color={ACCENT} />
                    </Pressable>
                  </View>
                )}
                {statusFilter !== "all" && (
                  <View style={[styles.activePill, { borderColor: ACCENT }]}>
                    <Text style={[styles.activePillText, { color: ACCENT }]}>
                      {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}
                    </Text>
                    <Pressable onPress={() => setStatusFilter("all")} hitSlop={6}>
                      <Feather name="x" size={11} color={ACCENT} />
                    </Pressable>
                  </View>
                )}
              </Animated.View>
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <TransactionItem tx={item} />
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Feather name="inbox" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No transactions match these filters
            </Text>
          </View>
        )}
      />

      {/* Filter bottom sheet modal */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setFilterOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: insets.bottom + 18,
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIconWrap, { borderColor: ACCENT, backgroundColor: "rgba(234,179,8,0.1)" }]}>
                <Feather name="filter" size={14} color={ACCENT} />
              </View>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                Filter transactions
              </Text>
              <Pressable onPress={() => setFilterOpen(false)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>TYPE</Text>
            <View style={styles.chipWrap}>
              {TYPE_FILTERS.map((f) => {
                const active = typeFilter === f.value;
                return (
                  <Pressable
                    key={f.value}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setTypeFilter(f.value);
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active
                          ? "rgba(168,85,247,0.18)"
                          : "rgba(255,255,255,0.03)",
                        borderColor: active ? "#A855F7" : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? "#fff" : colors.textSecondary },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: 16 }]}>
              STATUS
            </Text>
            <View style={styles.chipWrap}>
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.value;
                return (
                  <Pressable
                    key={f.value}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setStatusFilter(f.value);
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active
                          ? "rgba(96,165,250,0.16)"
                          : "rgba(255,255,255,0.03)",
                        borderColor: active ? "#60A5FA" : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? "#60A5FA" : colors.textSecondary },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTypeFilter("all");
                  setStatusFilter("all");
                }}
                style={({ pressed }) => [
                  styles.clearBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.clearBtnText, { color: colors.textSecondary }]}>
                  Clear all
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setFilterOpen(false);
                }}
                style={({ pressed }) => [
                  styles.applyBtn,
                  { backgroundColor: ACCENT, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={styles.applyBtnText}>
                  Show {filtered.length} result{filtered.length === 1 ? "" : "s"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  filterIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    fontSize: 9.5,
    fontFamily: "Inter_700Bold",
    color: "#0B1014",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  headerSub: { fontSize: 11.5, fontFamily: "Inter_500Medium", marginTop: 1 },

  list: {},
  listHeader: { paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    padding: 0,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 3 },
  summaryLbl: {
    fontSize: 9.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  summaryVal: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  summaryDiv: { width: 1, height: 26 },

  activePills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(234,179,8,0.08)",
  },
  activePillText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  empty: { alignItems: "center", gap: 8, paddingVertical: 64 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  // Modal sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
    opacity: 0.6,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  sheetIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  groupLabel: {
    fontSize: 10.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  clearBtn: {
    paddingHorizontal: 18,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  applyBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0B1014",
    letterSpacing: -0.2,
  },
});
