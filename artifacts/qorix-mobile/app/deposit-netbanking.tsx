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
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BANKS, type Bank } from "@/constants/banks";
import { useColors } from "@/hooks/useColors";

export default function DepositNetBankingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string }>();

  const [search, setSearch] = useState("");
  const [showAllOthers, setShowAllOthers] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const COLLAPSED_COUNT = 3;

  const numAmount = parseFloat(params.amount ?? "0") || 0;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  const { popular, others } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? BANKS.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            b.shortName.toLowerCase().includes(q),
        )
      : BANKS;
    return {
      popular: filtered.filter((b) => b.popular),
      others: filtered.filter((b) => !b.popular),
    };
  }, [search]);

  const handleSelect = (bank: Bank) => {
    if (navigating) return;
    setNavigating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/deposit-netbanking-details",
      params: { bankId: bank.id, amount: String(numAmount) },
    });
    // Reset guard shortly after navigation so the row re-enables when user comes back.
    setTimeout(() => setNavigating(false), 600);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPadding, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Header */}
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
            <Text style={[styles.eyebrow, { color: colors.purple }]}>SELECT YOUR BANK</Text>
            <Text style={[styles.payTitle, { color: colors.foreground }]}>
              Pay ₹{numAmount.toLocaleString("en-IN")}
            </Text>
          </View>
          <View style={styles.backBtnSpacer} />
        </View>

        {/* Info banner */}
        <View
          style={[
            styles.infoBanner,
            {
              backgroundColor: "rgba(168,85,247,0.10)",
              borderColor: "rgba(168,85,247,0.35)",
            },
          ]}
        >
          <Feather name="lock" size={14} color={colors.purple} />
          <Text style={[styles.infoText, { color: colors.foreground }]}>
            RBI-compliant ·{" "}
            <Text style={{ color: colors.textSecondary }}>
              Secure NEFT/IMPS transfer to verified beneficiary
            </Text>
          </Text>
        </View>

        {/* Search */}
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search bank"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Popular section */}
        {popular.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              POPULAR BANKS
            </Text>
            <View style={styles.banks}>
              {popular.map((bank) => (
                <BankRow
                  key={bank.id}
                  bank={bank}
                  disabled={navigating}
                  onPress={() => handleSelect(bank)}
                />
              ))}
            </View>
          </View>
        )}

        {/* All others */}
        {others.length > 0 && (
          <View style={{ gap: 8 }}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                ALL BANKS
              </Text>
              {!search.trim() && others.length > COLLAPSED_COUNT && (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowAllOthers((prev) => !prev);
                  }}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.toggleHint,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  {!showAllOthers && (
                    <Text style={[styles.countHint, { color: colors.purple }]}>
                      +{others.length - COLLAPSED_COUNT}
                    </Text>
                  )}
                  <Feather
                    name={showAllOthers ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.purple}
                  />
                </Pressable>
              )}
            </View>
            <View style={styles.banks}>
              {(search.trim() || showAllOthers
                ? others
                : others.slice(0, COLLAPSED_COUNT)
              ).map((bank) => (
                <BankRow
                  key={bank.id}
                  bank={bank}
                  disabled={navigating}
                  onPress={() => handleSelect(bank)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Empty state */}
        {popular.length === 0 && others.length === 0 && (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={20} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No banks found for "{search}"
            </Text>
            <Pressable
              onPress={() => setSearch("")}
              style={({ pressed }) => [
                styles.emptyResetBtn,
                {
                  borderColor: colors.purple,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.emptyResetText, { color: colors.purple }]}>
                Clear search
              </Text>
            </Pressable>
          </View>
        )}

        {/* Footer note */}
        <View style={styles.footerNote}>
          <Feather name="info" size={11} color={colors.textMuted} />
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            All banks are RBI-licensed · 256-bit SSL encryption · 0% gateway fees
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function BankRow({
  bank,
  disabled,
  onPress,
}: {
  bank: Bank;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.bankRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.bankLogo,
          {
            backgroundColor: `${bank.color}22`,
            borderColor: `${bank.color}66`,
          },
        ]}
      >
        <Text style={[styles.bankInitial, { color: bank.color }]}>{bank.initial}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[styles.bankName, { color: colors.foreground }]}>
          {bank.name}
        </Text>
        <Text numberOfLines={1} style={[styles.bankTag, { color: colors.textMuted }]}>
          {bank.tagline}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
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
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", minWidth: 0 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    minWidth: 0,
    height: "100%",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  banks: { gap: 8 },
  bankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  bankLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  bankInitial: { fontSize: 14, fontFamily: "Inter_700Bold" },
  bankName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  bankTag: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  countHint: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
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
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  footerText: { flex: 1, fontSize: 10, fontFamily: "Inter_400Regular", minWidth: 0 },
});
