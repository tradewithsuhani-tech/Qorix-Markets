import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { Transaction } from "@/context/PortfolioContext";

interface TransactionItemProps {
  tx: Transaction;
}

const iconMap: Record<string, { name: keyof typeof Feather.glyphMap; bg: string }> = {
  deposit: { name: "arrow-down-circle", bg: "rgba(46,204,113,0.1)" },
  withdrawal: { name: "arrow-up-circle", bg: "rgba(231,76,60,0.1)" },
  income: { name: "trending-up", bg: "rgba(201,168,76,0.1)" },
  fee: { name: "minus-circle", bg: "rgba(138,133,128,0.1)" },
  transfer: { name: "repeat", bg: "rgba(59,130,246,0.12)" },
};

const colorMap: Record<string, string> = {
  deposit: "#2ECC71",
  withdrawal: "#E74C3C",
  income: "#C9A84C",
  fee: "#8A8580",
  transfer: "#3B82F6",
};

export function TransactionItem({ tx }: TransactionItemProps) {
  const colors = useColors();
  const icon = iconMap[tx.type] ?? iconMap.fee;
  const tintColor = colorMap[tx.type] ?? colors.textSecondary;
  const isCredit = tx.type === "deposit" || tx.type === "income";
  const isNeutral = tx.type === "transfer";

  const date = new Date(tx.createdAt);
  const dateStr = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
        <Feather name={icon.name} size={18} color={tintColor} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.desc, { color: colors.foreground }]}>{tx.description}</Text>
        <Text style={[styles.date, { color: colors.textMuted }]}>{dateStr}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: isNeutral ? colors.blue : isCredit ? colors.green : colors.red }]}>
          {isNeutral ? "" : isCredit ? "+" : "-"}₹{tx.amount.toLocaleString("en-IN")}
        </Text>
        <View style={[styles.statusDot, { backgroundColor: tx.status === "completed" ? colors.green : tx.status === "pending" ? colors.gold : colors.red }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1 },
  desc: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 2 },
  date: { fontSize: 11, fontFamily: "Inter_400Regular" },
  right: { alignItems: "flex-end", gap: 4 },
  amount: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
});
