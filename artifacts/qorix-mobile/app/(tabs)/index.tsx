import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetDashboardSummaryQueryKey,
  useGetDashboardSummary,
  useGetInvestment,
} from "@workspace/api-client-react";
import { AIBotStatus } from "@/components/AIBotStatus";
import { DeployedStrategyCard } from "@/components/DeployedStrategyCard";
import { BotPulse } from "@/components/BotPulse";
import { BotStrategyCard } from "@/components/BotStrategyCard";
import { Card } from "@/components/Card";
import { ActivateTradingCard } from "@/components/ActivateTradingCard";
import { AnimatedMeshBackground } from "@/components/AnimatedMeshBackground";
import { HoloBorder } from "@/components/HoloBorder";
import { OrbitalAIHero } from "@/components/OrbitalAIHero";
import { MarketTicker } from "@/components/MarketTicker";
import { PromoBannerCarousel } from "@/components/PromoBannerCarousel";
import { PromoPopup } from "@/components/PromoPopup";
import { SegmentTabs } from "@/components/SegmentTabs";
import { StatPillCard } from "@/components/StatPillCard";
import { TierBadge } from "@/components/TierBadge";
import { useAuth } from "@/context/AuthContext";
import { usePortfolio } from "@/context/PortfolioContext";
import { useColors } from "@/hooks/useColors";
import {
  PROMO_BANNERS,
} from "@/constants/marketData";
import { BOT_STRATEGIES } from "@/constants/bots";

const { width: SCREEN_W } = Dimensions.get("window");
const CONTENT_W = Math.min(SCREEN_W, 460) - 32;

const SEGMENTS = ["Markets", "Trade", "Earn", "Bots"];

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { wallet, portfolio, botActivity, refreshData } = usePortfolio();
  const isDemo = user?.id === "demo_001";
  const dashboardQuery = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
      enabled: isAuthenticated && !isDemo,
      refetchInterval: 30_000,
    },
  });
  const investmentQuery = useGetInvestment({
    query: { enabled: isAuthenticated && !isDemo, refetchInterval: 60_000 },
  });
  const pendingRiskLevel = investmentQuery.data?.pendingRiskLevel ?? null;

  const [refreshing, setRefreshing] = useState(false);
  const [tickIndex, setTickIndex] = useState(0);
  const [segment, setSegment] = useState("Markets");
  const [hideBalance, setHideBalance] = useState(false);
  const [promoVisible, setPromoVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPromoVisible(true), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!botActivity || botActivity.length === 0) return;
    const id = setInterval(() => setTickIndex((i) => (i + 1) % botActivity.length), 3500);
    return () => clearInterval(id);
  }, [botActivity]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshData();
    dashboardQuery.refetch();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setRefreshing(false), 800);
  };

  const apiSummary = dashboardQuery.data;
  const totalLiquidity =
    apiSummary?.totalBalance ?? wallet.balance + wallet.lockedAmount + (portfolio?.totalPnL ?? 0);
  const usdValue = totalLiquidity / 83.42;
  const dailyPnL = apiSummary?.dailyProfitLoss ?? portfolio?.dailyPnL ?? 0;
  const dailyPnLPct =
    apiSummary?.dailyProfitPercent ??
    (portfolio ? (dailyPnL / portfolio.deployedAmount) * 100 : 0);

  const activity = botActivity[tickIndex];
  const activityIcon = {
    scan: "search" as const,
    signal: "trending-up" as const,
    trade: "zap" as const,
    exit: "check-circle" as const,
    info: "info" as const,
  }[activity?.type ?? "info"];

  let delayCounter = 0;
  const nextDelay = () => {
    const d = delayCounter;
    delayCounter += 50;
    return d;
  };

  const nameInitial = (user?.name ?? "T").trim().charAt(0).toUpperCase();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 60 : 8),
          paddingBottom: insets.bottom + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
    >
      <View pointerEvents="none" style={styles.ambientWrap}>
        <AnimatedMeshBackground height={620} intensity={0.10} />
      </View>

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.headerRow}>
        <LinearGradient colors={["#3B82F6", "#A855F7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
          <Text style={styles.avatarText}>{nameInitial}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{user?.name ?? "Trader"}</Text>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>{greeting} 👋</Text>
        </View>
        <Pressable
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="search" size={15} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/notifications");
          }}
          style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="bell" size={15} color={colors.foreground} />
          <View style={[styles.notifDot, { backgroundColor: colors.pink }]} />
        </Pressable>
      </Animated.View>

      {/* Active deployed strategy */}
      {portfolio && portfolio.deployedAmount > 0 && (
        <Animated.View entering={FadeInDown.duration(500).delay(nextDelay())}>
          <DeployedStrategyCard onStop={() => router.push("/withdraw")} pendingRiskLevel={pendingRiskLevel} />
        </Animated.View>
      )}

      {/* 4 Stat Pill Cards: clean 2x2 grid */}
      <Animated.View entering={FadeInDown.duration(450).delay(nextDelay())} style={styles.statGridV2}>
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <StatPillCard
              label="TOTAL EQUITY"
              value={`$${Math.floor(totalLiquidity / 83.42).toLocaleString("en-US")}`}
              decimals=".09"
              trend={`+${(dailyPnLPct).toFixed(2)}% today`}
              trendColor={colors.green}
              icon="briefcase"
              iconColor={colors.green}
            />
          </View>
          <View style={styles.statCell}>
            <StatPillCard
              label="DAILY P&L"
              value={`+$${Math.abs(dailyPnL / 83.42).toFixed(2)}`}
              trend="0.00% today"
              trendColor={colors.green}
              hint="Market closed"
              hintColor={colors.orange}
              icon="trending-up"
              iconColor={colors.green}
            />
          </View>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <StatPillCard
              label="ACTIVE FUND"
              value={`$${Math.floor((wallet.balance + wallet.lockedAmount) / 83.42).toLocaleString("en-US")}`}
              decimals=".09"
              icon="zap"
              iconColor={colors.blue}
              badge={{ text: "CLOSED", color: colors.orange, bg: "rgba(245,158,11,0.15)" }}
              hint="0.00%/day"
              hintColor={colors.textMuted}
            />
          </View>
          <View style={styles.statCell}>
            <StatPillCard
              label="TOTAL PROFIT"
              value={`+$${Math.floor(Math.abs(portfolio?.totalPnL ?? 0) / 83.42).toLocaleString("en-US")}`}
              decimals=".78"
              trend="All time earnings"
              trendColor={colors.textMuted}
              icon="activity"
              iconColor={colors.green}
            />
          </View>
        </View>
      </Animated.View>

      {/* Promo banner carousel */}
      <Animated.View entering={FadeInDown.duration(450).delay(nextDelay())}>
        <PromoBannerCarousel banners={PROMO_BANNERS} width={CONTENT_W} />
      </Animated.View>

      {/* Tier */}
      {portfolio && (
        <Animated.View entering={FadeInDown.duration(400).delay(nextDelay())}>
          <TierBadge
            tier={portfolio.tier}
            progress={portfolio.tierProgress}
            nextTier={portfolio.nextTier}
            amountToNext={portfolio.amountToNextTier}
          />
        </Animated.View>
      )}

      {/* Bot intelligence */}
      {portfolio && activity && (
        <Animated.View
          entering={FadeInDown.duration(400).delay(nextDelay())}
          style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.borderBright }]}
        >
          <View style={[styles.activityIcon, { backgroundColor: "rgba(168,85,247,0.18)" }]}>
            <Feather name={activityIcon} size={13} color={colors.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.activityLabel, { color: colors.purple }]}>BOT INTELLIGENCE</Text>
            <Text style={[styles.activityMsg, { color: colors.foreground }]} numberOfLines={2}>
              {activity.message}
            </Text>
          </View>
          <BotPulse color={colors.purple} size={6} />
        </Animated.View>
      )}

      {/* AI Bot Status */}
      {portfolio && (
        <Animated.View entering={FadeInDown.duration(400).delay(nextDelay())}>
          <AIBotStatus botName={portfolio.botName} riskTier={portfolio.riskTier} />
        </Animated.View>
      )}

      {/* Best bot result */}
      <Animated.View entering={FadeInDown.duration(450).delay(nextDelay())} style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Best bot result</Text>
            <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>last month</Text>
          </View>
          <Pressable onPress={() => Haptics.selectionAsync()}>
            <Text style={[styles.seeAll, { color: colors.purple }]}>See all →</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.botScrollRow}
          decelerationRate="fast"
        >
          {BOT_STRATEGIES.map((bot) => (
            <BotStrategyCard key={bot.id} bot={bot} width={160} onSetup={() => router.push("/deploy")} />
          ))}
        </ScrollView>
      </Animated.View>

      <PromoPopup
        visible={promoVisible}
        onClose={() => setPromoVisible(false)}
        onCtaPress={() => router.push("/deposit")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },
  ambientWrap: { position: "absolute", top: 0, left: 0, right: 0, height: 780, overflow: "hidden", zIndex: -1 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
  name: { fontSize: 16, fontFamily: "Inter_700Bold" },
  greeting: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  notifDot: { position: "absolute", top: 8, right: 9, width: 6, height: 6, borderRadius: 3 },

  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  pairHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pairLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  pairIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pairIconText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  pairTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pairSymbol: { fontSize: 16, fontFamily: "Inter_700Bold" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  liveText: { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  pairSub: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  pairPrice: { fontSize: 17, fontFamily: "Inter_700Bold" },
  pairChange: { fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 2 },

  tfRow: { flexDirection: "row", gap: 4, marginTop: 12, marginBottom: 8 },
  tfPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  candleWrap: { alignItems: "center", marginVertical: 4 },

  statsRow: { flexDirection: "row", marginTop: 12, paddingTop: 10, borderTopWidth: 0 },
  statBlock: { flex: 1, alignItems: "center", gap: 2 },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  statValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
  statDiv: { width: 1 },

  tradeBtnRow: { flexDirection: "row", gap: 8 },
  buyBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  sellBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  buyBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  precisionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  precisionText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  activityCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  activityIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  activityLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1.2, marginBottom: 3 },
  activityMsg: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },

  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  seeAll: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  botScrollRow: { gap: 12, paddingRight: 16, paddingTop: 4, paddingBottom: 4 },

  marketTabsBar: { borderBottomWidth: 1, marginBottom: 4 },
  coinListWrap: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  coinDivider: { height: StyleSheet.hairlineWidth, marginVertical: 0 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statGridV2: { gap: 10 },
  statRow: { flexDirection: "row", gap: 10 },
  statCell: { flex: 1 },
});
