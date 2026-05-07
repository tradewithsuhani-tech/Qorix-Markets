import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetWallet,
  useGetDashboardSummary,
  useGetTransactions,
} from "@workspace/api-client-react";

import { BalanceCardPro } from "@/components/BalanceCardPro";
import { TransactionItem } from "@/components/TransactionItem";
import { useColors } from "@/hooks/useColors";
import { mapApiTx, FX_RATE, type ApiTx } from "@/lib/tx-mapper";

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const walletQ = useGetWallet();
  const summaryQ = useGetDashboardSummary();
  const txQ = useGetTransactions({ page: 1, limit: 20 });

  const [hideBalance, setHideBalance] = useState(false);

  const wallet = walletQ.data as any;
  const summary = summaryQ.data as any;
  const txData = (txQ.data as any)?.data ?? [];

  const totalUsd =
    (Number(wallet?.mainBalance) || 0) +
    (Number(wallet?.tradingBalance) || 0) +
    (Number(wallet?.profitBalance) || 0);
  const totalLiquidity = totalUsd * FX_RATE;
  const usdValue = totalUsd;
  const dailyPnL = (Number(summary?.dailyProfitLoss) || 0) * FX_RATE;
  const dailyPnLPct = Number(summary?.dailyProfitPercent) || 0;

  const transactions = useMemo(
    () => (txData as ApiTx[]).map(mapApiTx),
    [txData],
  );

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 16);
  const isLoading = walletQ.isLoading || summaryQ.isLoading;
  const refreshing = walletQ.isFetching || summaryQ.isFetching || txQ.isFetching;

  const onRefresh = () => {
    walletQ.refetch();
    summaryQ.refetch();
    txQ.refetch();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={transactions.slice(0, 5)}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing && !isLoading}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        }
        contentContainerStyle={[styles.list, { paddingTop: topPadding, paddingBottom: insets.bottom + 100 }]}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <Text style={[styles.title, { color: colors.foreground }]}>Wallet</Text>

            {isLoading ? (
              <View style={styles.loaderBox}>
                <ActivityIndicator color={colors.gold} />
              </View>
            ) : (
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
            )}

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
        ListEmptyComponent={() =>
          txQ.isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="inbox" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No transactions yet</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { gap: 0 },
  listHeader: { gap: 14, paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  loaderBox: { paddingVertical: 48, alignItems: "center" },
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
