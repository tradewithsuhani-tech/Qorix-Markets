import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BalanceCardPro } from "@/components/BalanceCardPro";
import { TransactionItem } from "@/components/TransactionItem";
import { usePortfolio } from "@/context/PortfolioContext";
import { useColors } from "@/hooks/useColors";

const FX_RATE = 83.42;

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { wallet, portfolio, transactions } = usePortfolio();

  const [hideBalance, setHideBalance] = useState(false);

  const totalLiquidity = wallet.balance + wallet.lockedAmount + (portfolio?.totalPnL ?? 0);
  const usdValue = totalLiquidity / FX_RATE;
  const dailyPnL = portfolio?.dailyPnL ?? 0;
  const dailyPnLPct = portfolio && portfolio.deployedAmount > 0
    ? (dailyPnL / portfolio.deployedAmount) * 100
    : 0;

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 16);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={transactions.slice(0, 5)}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingTop: topPadding, paddingBottom: insets.bottom + 100 }]}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <Text style={[styles.title, { color: colors.foreground }]}>Wallet</Text>

            <Animated.View entering={FadeInDown.duration(400)}>
              <BalanceCardPro
                balanceInr={totalLiquidity}
                balanceUsd={usdValue}
                pnl24h={dailyPnL}
                pnl24hPct={dailyPnLPct}
                isHidden={hideBalance}
                onToggleHide={() => setHideBalance((h) => !h)}
                onDeposit={() => router.push("/deposit")}
                onWithdraw={() => router.push("/withdraw")}
                onTransfer={() => router.push("/transfer")}
              />
            </Animated.View>

            <View style={styles.txHeaderRow}>
              <Text style={[styles.txTitle, { color: colors.foreground }]}>Transaction History</Text>
              {transactions.length > 5 && (
                <Pressable
                  onPress={() => router.push("/transaction-history")}
                  style={({ pressed }) => [
                    styles.seeMoreBtn,
                    {
                      borderColor: "rgba(234,179,8,0.4)",
                      backgroundColor: "rgba(234,179,8,0.08)",
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  hitSlop={6}
                >
                  <Text style={styles.seeMoreText}>See more</Text>
                  <Feather name="chevron-right" size={14} color="#EAB308" />
                </Pressable>
              )}
            </View>
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
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No transactions yet</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { gap: 0 },
  listHeader: { gap: 14, paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  txHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  txTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  seeMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  seeMoreText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#EAB308",
    letterSpacing: 0.2,
  },
  empty: { alignItems: "center", gap: 8, paddingVertical: 48 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
