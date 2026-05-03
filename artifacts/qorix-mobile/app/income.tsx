import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { usePortfolio } from "@/context/PortfolioContext";
import { useColors } from "@/hooks/useColors";

export default function IncomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { incomeLedger } = usePortfolio();

  const totalGross = incomeLedger.reduce((s, e) => s + e.grossPnl, 0);
  const totalClient = incomeLedger.reduce((s, e) => s + e.clientIncome, 0);
  const totalFee = incomeLedger.reduce((s, e) => s + e.companyFee, 0);
  const totalTds = incomeLedger.reduce((s, e) => s + e.tdsDeducted, 0);
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 20);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={incomeLedger}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingTop: topPadding, paddingBottom: insets.bottom + 100 }]}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <View style={styles.topRow}>
              <Pressable
                onPress={() => router.back()}
                style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name="arrow-left" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.title, { color: colors.foreground }]}>Income Statements</Text>
            </View>

            {/* Summary */}
            <Card variant="gold" padding={18}>
              <Text style={[styles.summaryLabel, { color: colors.goldDim }]}>TOTAL CLIENT INCOME</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                ₹{totalClient.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
              <View style={[styles.summaryGrid, { borderTopColor: colors.borderBright }]}>
                {[
                  { label: "Gross P&L", value: totalGross, color: colors.foreground },
                  { label: "Platform Fee", value: totalFee, color: colors.red },
                  { label: "TDS Deducted", value: totalTds, color: colors.textSecondary },
                ].map((s) => (
                  <View key={s.label} style={styles.summaryItem}>
                    <Text style={[styles.summaryItemLabel, { color: colors.goldDim }]}>{s.label}</Text>
                    <Text style={[styles.summaryItemValue, { color: s.color }]}>
                      ₹{s.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* How it works */}
            <View style={[styles.howWorks, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.hwTitle, { color: colors.foreground }]}>How income is calculated</Text>
              {[
                { icon: "trending-up" as const, text: "Bot generates gross P&L daily at 11:59 PM" },
                { icon: "percent" as const, text: "Platform fee: 20–30% deducted from gross P&L" },
                { icon: "user" as const, text: "Your share: 70–80% credited to wallet instantly" },
                { icon: "file-text" as const, text: "TDS at 30% applies when annual income exceeds ₹10,000" },
              ].map((h) => (
                <View key={h.text} style={styles.hwRow}>
                  <View style={[styles.hwIcon, { backgroundColor: "rgba(201,168,76,0.08)" }]}>
                    <Feather name={h.icon} size={12} color={colors.gold} />
                  </View>
                  <Text style={[styles.hwText, { color: colors.textSecondary }]}>{h.text}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.statementsTitle, { color: colors.foreground }]}>Daily Statements</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const date = new Date(item.cycleDate);
          const dateStr = date.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
          const clientPct = Math.round((item.clientIncome / item.grossPnl) * 100);
          return (
            <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
              <Card padding={16}>
                <View style={styles.entryHeader}>
                  <View>
                    <Text style={[styles.entryDate, { color: colors.foreground }]}>{dateStr}</Text>
                    <View style={[styles.entryBadge, { backgroundColor: "rgba(46,204,113,0.1)", borderColor: "rgba(46,204,113,0.3)" }]}>
                      <Text style={[styles.entryBadgeText, { color: colors.green }]}>Credited</Text>
                    </View>
                  </View>
                  <Text style={[styles.entryIncome, { color: colors.green }]}>
                    +₹{item.clientIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={[styles.entryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.entryGrid}>
                  {[
                    { label: "Gross P&L", value: `₹${item.grossPnl.toFixed(2)}` },
                    { label: "Platform Fee", value: `₹${item.companyFee.toFixed(2)}` },
                    { label: "Your Share", value: `${clientPct}%` },
                    { label: "TDS", value: item.tdsDeducted > 0 ? `₹${item.tdsDeducted.toFixed(2)}` : "NIL" },
                  ].map((g) => (
                    <View key={g.label} style={styles.entryGridItem}>
                      <Text style={[styles.entryGridLabel, { color: colors.textMuted }]}>{g.label}</Text>
                      <Text style={[styles.entryGridValue, { color: colors.textSecondary }]}>{g.value}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Feather name="inbox" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No income statements yet</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { gap: 0 },
  listHeader: { paddingHorizontal: 16, gap: 14, marginBottom: 8 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.5, marginBottom: 6 },
  summaryValue: { fontSize: 34, fontFamily: "Inter_700Bold", letterSpacing: -1, marginBottom: 14 },
  summaryGrid: { flexDirection: "row", borderTopWidth: 1, paddingTop: 12, gap: 0 },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryItemLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  summaryItemValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  howWorks: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 10 },
  hwTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 4 },
  hwRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  hwIcon: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", marginTop: 1 },
  hwText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  statementsTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  entryDate: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  entryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, alignSelf: "flex-start" },
  entryBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  entryIncome: { fontSize: 22, fontFamily: "Inter_700Bold" },
  entryDivider: { height: 1, marginBottom: 12 },
  entryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  entryGridItem: { width: "47%", gap: 2 },
  entryGridLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  entryGridValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 48 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
