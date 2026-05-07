import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { PnLBadge } from "@/components/PnLBadge";
import { Sparkline } from "@/components/Sparkline";
import { TradeItem } from "@/components/TradeItem";
import { BOT_STRATEGIES } from "@/constants/bots";
import type { BotStrategy } from "@/components/BotStrategyCard";
import type { Trade } from "@/context/PortfolioContext";
import { useColors } from "@/hooks/useColors";
import {
  useGetInvestment,
  useGetDashboardSummary,
  useGetTrades,
  useGetWallet,
} from "@workspace/api-client-react";
import { FX_RATE } from "@/lib/tx-mapper";

const FILTERS = ["All", "BUY", "SELL", "Win", "Loss"] as const;
type Filter = (typeof FILTERS)[number];

const ACCENT_MAP = {
  purple: "#A855F7",
  pink: "#EC4899",
  blue: "#60A5FA",
  green: "#10D070",
} as const;

function hexToRgba(hex: string, alpha: number) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const BOT_META: Record<string, { investors: string; winRate: number; avgMonthly: string; aum: string }> = {
  trend:     { investors: "1.2K",  winRate: 73, avgMonthly: "+4.2%", aum: "₹4.8Cr" },
  arbitrage: { investors: "2.18K", winRate: 81, avgMonthly: "+2.8%", aum: "₹7.1Cr" },
  scalp:     { investors: "890",   winRate: 64, avgMonthly: "+6.1%", aum: "₹2.3Cr" },
  grid:      { investors: "540",   winRate: 69, avgMonthly: "+3.4%", aum: "₹1.6Cr" },
};

export default function TradesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const investmentQ = useGetInvestment();
  const summaryQ = useGetDashboardSummary();
  const tradesQ = useGetTrades({ limit: 50 });
  const walletQ = useGetWallet();

  const inv = investmentQ.data as any;
  const summary = summaryQ.data as any;
  const apiTrades = (tradesQ.data as any[]) ?? [];
  const wRaw = walletQ.data as any;

  const deployedAmount = (Number(inv?.amount) || 0) * FX_RATE;
  const totalProfit = (Number(inv?.totalProfit) || 0) * FX_RATE;
  const currentNAV = deployedAmount + totalProfit;
  const dailyPnL = (Number(summary?.dailyProfitLoss) || 0) * FX_RATE;

  const portfolio = inv
    ? {
        deployedAmount,
        currentNAV,
        totalPnL: totalProfit,
        dailyPnL,
      }
    : null;

  const wallet = wRaw
    ? {
        balance: (Number(wRaw.mainBalance) || 0) * FX_RATE,
        lockedAmount: (Number(wRaw.tradingBalance) || 0) * FX_RATE,
      }
    : null;

  const trades: Trade[] = apiTrades.map((t: any) => ({
    id: String(t.id),
    symbol: t.symbol ?? "—",
    side: (t.direction === "SHORT" ? "SELL" : "BUY") as "BUY" | "SELL",
    qty: 1,
    entryPrice: Number(t.entryPrice) || 0,
    exitPrice: Number(t.exitPrice) || 0,
    pnl: (Number(t.profit) || 0) * FX_RATE,
    executedAt: t.executedAt,
    assetClass: "crypto" as const,
  }));

  const [filter, setFilter] = useState<Filter>("All");
  const [selectedBot, setSelectedBot] = useState<BotStrategy | null>(null);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 16);

  const activeBot = BOT_STRATEGIES.find((b) => b.active);
  const hasActive = !!(portfolio && portfolio.deployedAmount > 0 && activeBot);
  const activeAccent = activeBot ? ACCENT_MAP[activeBot.accent] : ACCENT_MAP.purple;
  const navPnL = portfolio ? portfolio.currentNAV - portfolio.deployedAmount : 0;
  const navPct = portfolio && portfolio.deployedAmount > 0
    ? (navPnL / portfolio.deployedAmount) * 100
    : 0;
  const fmtINR = (n: number) =>
    `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

  // Bot picker view
  if (!selectedBot) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.pickerContent,
            { paddingTop: topPadding, paddingBottom: insets.bottom + 100 },
          ]}
        >
          <Animated.View entering={FadeInDown.duration(400)} style={styles.pickerHeader}>
            <View style={styles.pickerTitleRow}>
              <LinearGradient
                colors={["#A855F7", "#EC4899"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pickerHeaderIcon}
              >
                <Feather name="cpu" size={16} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickerTitle, { color: colors.foreground }]}>
                  {hasActive ? "Your bots" : "Choose a bot"}
                </Text>
                <Text style={[styles.pickerSubtitle, { color: colors.textSecondary }]}>
                  {hasActive
                    ? "Currently active bot is shown below"
                    : "Select a strategy to deploy capital"}
                </Text>
              </View>
            </View>
          </Animated.View>

          {hasActive && activeBot && portfolio && (
            <Animated.View entering={FadeInDown.duration(450).delay(60)}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/");
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}
              >
                <View
                  style={[
                    styles.fundCard,
                    {
                      backgroundColor: "#0E141C",
                      borderColor: "rgba(255,255,255,0.07)",
                      shadowColor: activeAccent,
                    },
                  ]}
                >
                  {/* Top accent hairline */}
                  <LinearGradient
                    colors={["#60A5FA", "#A855F7", "#EC4899"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.fundTopBar}
                    pointerEvents="none"
                  />
                  <View
                    pointerEvents="none"
                    style={[styles.fundGlow, { backgroundColor: activeAccent }]}
                  />

                  {/* Header: Strategy code + LIVE */}
                  <View style={styles.fundHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.fundCodeRow}>
                        <Text style={[styles.fundCode, { color: colors.textMuted }]}>
                          STRAT · {activeBot.id.toUpperCase()}-7741
                        </Text>
                        <View style={[styles.fundDivDot, { backgroundColor: colors.textMuted }]} />
                        <Text style={[styles.fundCode, { color: colors.textMuted }]}>
                          INCEPTION 28 APR
                        </Text>
                      </View>
                      <View style={styles.fundNameRow}>
                        <LinearGradient
                          colors={[hexToRgba(activeAccent, 0.7), hexToRgba(activeAccent, 0.2)]}
                          start={{ x: 0.2, y: 0 }}
                          end={{ x: 0.8, y: 1 }}
                          style={[styles.fundIcon, { borderColor: hexToRgba(activeAccent, 0.55) }]}
                        >
                          <Feather name="cpu" size={14} color="#fff" />
                        </LinearGradient>
                        <Text style={[styles.fundName, { color: colors.foreground }]} numberOfLines={1}>
                          {activeBot.name}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.fundLivePill}>
                      <View style={[styles.fundLiveDot, { backgroundColor: colors.green }]} />
                      <Text style={[styles.fundLiveText, { color: colors.green }]}>LIVE</Text>
                    </View>
                  </View>

                  {/* NAV block + sparkline */}
                  <View style={styles.fundNavBlock}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fundNavLbl, { color: colors.textMuted }]}>NET ASSET VALUE</Text>
                      <Text style={[styles.fundNavVal, { color: colors.foreground }]}>
                        {fmtINR(portfolio.currentNAV)}
                      </Text>
                      <View style={styles.fundNavDeltaRow}>
                        <Feather
                          name={navPnL >= 0 ? "trending-up" : "trending-down"}
                          size={11}
                          color={navPnL >= 0 ? colors.green : colors.red}
                        />
                        <Text
                          style={[
                            styles.fundNavDelta,
                            { color: navPnL >= 0 ? colors.green : colors.red },
                          ]}
                        >
                          {navPnL >= 0 ? "+" : "-"}{fmtINR(navPnL)} · {navPct >= 0 ? "+" : ""}{navPct.toFixed(2)}%
                        </Text>
                        <Text style={[styles.fundBps, { color: colors.textMuted }]}>
                          ({navPct >= 0 ? "+" : ""}{Math.round(navPct * 100)} bps)
                        </Text>
                      </View>
                    </View>
                    <View style={styles.fundSparkBlock}>
                      <Sparkline
                        data={activeBot.data}
                        width={92}
                        height={40}
                        color={navPnL >= 0 ? colors.green : colors.red}
                        fillColor={navPnL >= 0 ? colors.green : colors.red}
                        strokeWidth={1.6}
                        showDot={false}
                      />
                      <Text style={[styles.fundSparkLbl, { color: colors.textMuted }]}>30D EQUITY</Text>
                    </View>
                  </View>

                  {/* KPI grid */}
                  <View style={[styles.fundKpiGrid, { borderTopColor: "rgba(255,255,255,0.06)" }]}>
                    <View style={styles.fundKpi}>
                      <Text style={[styles.fundKpiLbl, { color: colors.textMuted }]}>SHARPE</Text>
                      <Text style={[styles.fundKpiVal, { color: colors.foreground }]}>2.18</Text>
                    </View>
                    <View style={[styles.fundKpiDiv, { backgroundColor: "rgba(255,255,255,0.06)" }]} />
                    <View style={styles.fundKpi}>
                      <Text style={[styles.fundKpiLbl, { color: colors.textMuted }]}>WIN RATE</Text>
                      <Text style={[styles.fundKpiVal, { color: colors.green }]}>73%</Text>
                    </View>
                    <View style={[styles.fundKpiDiv, { backgroundColor: "rgba(255,255,255,0.06)" }]} />
                    <View style={styles.fundKpi}>
                      <Text style={[styles.fundKpiLbl, { color: colors.textMuted }]}>MAX DD</Text>
                      <Text style={[styles.fundKpiVal, { color: colors.foreground }]}>−4.2%</Text>
                    </View>
                    <View style={[styles.fundKpiDiv, { backgroundColor: "rgba(255,255,255,0.06)" }]} />
                    <View style={styles.fundKpi}>
                      <Text style={[styles.fundKpiLbl, { color: colors.textMuted }]}>TRADES TODAY</Text>
                      <Text style={[styles.fundKpiVal, { color: colors.foreground }]}>14</Text>
                    </View>
                  </View>

                  {/* Allocation bar — % of total portfolio deployed in this bot */}
                  {(() => {
                    const total = portfolio.deployedAmount + (wallet?.balance ?? 0);
                    const allocPct = total > 0 ? (portfolio.deployedAmount / total) * 100 : 0;
                    return (
                      <View style={styles.fundAllocBlock}>
                        <View style={styles.fundAllocLabelRow}>
                          <Text style={[styles.fundAllocLbl, { color: colors.textMuted }]}>
                            % OF PORTFOLIO IN THIS BOT
                          </Text>
                          <Text style={[styles.fundAllocVal, { color: colors.foreground }]}>
                            {allocPct.toFixed(1)}%{" "}
                            <Text style={{ color: colors.textMuted }}>
                              ({fmtINR(portfolio.deployedAmount)} of {fmtINR(total)})
                            </Text>
                          </Text>
                        </View>
                        <View style={[styles.fundAllocTrack, { backgroundColor: "rgba(255,255,255,0.05)" }]}>
                          <LinearGradient
                            colors={[hexToRgba(activeAccent, 1), hexToRgba(activeAccent, 0.5)]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.fundAllocFill, { width: `${allocPct}%` }]}
                          />
                        </View>
                      </View>
                    );
                  })()}

                  {/* Footer status bar */}
                  <View style={[styles.fundFooter, { borderTopColor: "rgba(255,255,255,0.06)" }]}>
                    <View style={styles.fundFooterItem}>
                      <Feather name="activity" size={10} color={colors.textMuted} />
                      <Text style={[styles.fundFooterText, { color: colors.textMuted }]}>
                        Last trade <Text style={{ color: colors.foreground }}>14s ago</Text>
                      </Text>
                    </View>
                    <View style={styles.fundFooterItem}>
                      <Feather name="shield" size={10} color={colors.textMuted} />
                      <Text style={[styles.fundFooterText, { color: colors.textMuted }]}>
                        Risk <Text style={{ color: colors.foreground }}>Moderate</Text>
                      </Text>
                    </View>
                    <Feather name="arrow-up-right" size={13} color={activeAccent} />
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          )}

          {hasActive && (
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              EXPLORE OTHER STRATEGIES
            </Text>
          )}

          <View style={styles.botList}>
            {BOT_STRATEGIES.filter((b) => !hasActive || b.id !== activeBot?.id).map((bot, idx) => {
              const accent = ACCENT_MAP[bot.accent];
              const meta = BOT_META[bot.id] ?? { investors: "—", winRate: 0, avgMonthly: "—", aum: "—" };
              return (
                <Animated.View
                  key={bot.id}
                  entering={FadeInDown.duration(400).delay(80 + idx * 60)}
                >
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push({ pathname: "/deploy", params: { botId: bot.id } });
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
                  >
                    <LinearGradient
                      colors={[hexToRgba(accent, 0.18), "rgba(17,22,30,0.95)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.botCardV2,
                        {
                          borderColor: hexToRgba(accent, 0.32),
                          shadowColor: accent,
                        },
                      ]}
                    >
                      {/* Corner accent glow */}
                      <View
                        pointerEvents="none"
                        style={[styles.cornerGlow, { backgroundColor: accent }]}
                      />

                      {/* Top hairline accent */}
                      <LinearGradient
                        colors={[hexToRgba(accent, 0), hexToRgba(accent, 0.6), hexToRgba(accent, 0)]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.topAccent}
                        pointerEvents="none"
                      />

                      {/* Top row: icon + name + LIVE */}
                      <View style={styles.cardTopRow}>
                        <View style={styles.iconShellWrap}>
                          <View
                            pointerEvents="none"
                            style={[styles.iconHalo, { backgroundColor: accent, shadowColor: accent }]}
                          />
                          <LinearGradient
                            colors={[hexToRgba(accent, 0.65), hexToRgba(accent, 0.15)]}
                            start={{ x: 0.2, y: 0 }}
                            end={{ x: 0.8, y: 1 }}
                            style={[
                              styles.iconShell,
                              { borderColor: hexToRgba(accent, 0.6), shadowColor: accent },
                            ]}
                          >
                            <LinearGradient
                              colors={["rgba(255,255,255,0.32)", "rgba(255,255,255,0)"]}
                              start={{ x: 0.5, y: 0 }}
                              end={{ x: 0.5, y: 0.7 }}
                              style={styles.iconShellHighlight}
                              pointerEvents="none"
                            />
                            <Feather name="cpu" size={18} color="#fff" />
                          </LinearGradient>
                        </View>

                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={styles.botNameRow}>
                            <Text style={[styles.botNameV2, { color: colors.foreground }]} numberOfLines={1}>
                              {bot.name}
                            </Text>
                            {bot.active && (
                              <View style={[styles.activeChip, { backgroundColor: "rgba(16,208,112,0.15)", borderColor: "rgba(16,208,112,0.35)" }]}>
                                <View style={[styles.activeDot, { backgroundColor: colors.green }]} />
                                <Text style={[styles.activeText, { color: colors.green }]}>LIVE</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.botDescV2, { color: colors.textSecondary }]} numberOfLines={1}>
                            {bot.description} strategy
                          </Text>
                        </View>

                        <View style={styles.sparkBlock}>
                          <Text style={[styles.returnsV2, { color: accent }]}>
                            {bot.returnsPct >= 0 ? "+" : ""}{bot.returnsPct}%
                          </Text>
                          <Sparkline
                            data={bot.data}
                            width={78}
                            height={26}
                            color={accent}
                            fillColor={accent}
                            strokeWidth={1.8}
                            showDot={false}
                          />
                        </View>
                      </View>

                      {/* AUM trust banner */}
                      <View style={[styles.aumRow, { borderTopColor: "rgba(255,255,255,0.06)" }]}>
                        <View style={styles.aumLeft}>
                          <Feather name="shield" size={11} color={accent} />
                          <Text style={[styles.aumLabel, { color: colors.textMuted }]}>Capital managed</Text>
                        </View>
                        <Text style={[styles.aumValue, { color: colors.foreground }]}>{meta.aum}</Text>
                      </View>

                      {/* Stats row */}
                      <View style={styles.statsRowV2}>
                        <View style={styles.statCellV2}>
                          <Text style={[styles.statValV2, { color: colors.foreground }]}>
                            {meta.investors}
                          </Text>
                          <Text style={[styles.statLblV2, { color: colors.textMuted }]}>Investors</Text>
                        </View>
                        <View style={[styles.statDivV2, { backgroundColor: "rgba(255,255,255,0.06)" }]} />
                        <View style={styles.statCellV2}>
                          <Text
                            style={[
                              styles.statValV2,
                              { color: meta.winRate >= 70 ? colors.green : meta.winRate >= 50 ? colors.gold : colors.red },
                            ]}
                          >
                            {meta.winRate}%
                          </Text>
                          <Text style={[styles.statLblV2, { color: colors.textMuted }]}>Win rate</Text>
                        </View>
                        <View style={[styles.statDivV2, { backgroundColor: "rgba(255,255,255,0.06)" }]} />
                        <View style={styles.statCellV2}>
                          <Text style={[styles.statValV2, { color: colors.green }]}>{meta.avgMonthly}</Text>
                          <Text style={[styles.statLblV2, { color: colors.textMuted }]}>Avg / mo</Text>
                        </View>
                        <View
                          style={[
                            styles.viewCta,
                            { backgroundColor: hexToRgba(accent, 0.16), borderColor: hexToRgba(accent, 0.4) },
                          ]}
                        >
                          <Text style={[styles.viewCtaText, { color: accent }]}>Setup</Text>
                          <Feather name="arrow-right" size={11} color={accent} />
                        </View>
                      </View>
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Bot is selected — show trade history filtered to that bot
  const accent = ACCENT_MAP[selectedBot.accent];

  // Synthetic per-bot filter using a stable hash of bot.id over the trade index
  const botSeed = selectedBot.id.length;
  const botTrades = trades.filter((_, i) => (i + botSeed) % BOT_STRATEGIES.length !== (BOT_STRATEGIES.length - 1));

  const filtered = botTrades.filter((t) => {
    if (filter === "BUY") return t.side === "BUY";
    if (filter === "SELL") return t.side === "SELL";
    if (filter === "Win") return t.pnl > 0;
    if (filter === "Loss") return t.pnl < 0;
    return true;
  });

  const totalPnL = botTrades.reduce((s, t) => s + t.pnl, 0);
  const wins = botTrades.filter((t) => t.pnl > 0).length;
  const winRate = botTrades.length > 0 ? Math.round((wins / botTrades.length) * 100) : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingTop: topPadding, paddingBottom: insets.bottom + 100 }]}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <View style={styles.titleRow}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedBot(null);
                }}
                style={({ pressed }) => [
                  styles.backBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="arrow-left" size={16} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.title, { color: colors.foreground }]}>Trade History</Text>
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryRow}>
              <Card style={styles.summaryCard} padding={14}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total P&L</Text>
                <PnLBadge value={totalPnL} size="md" />
              </Card>
              <Card style={styles.summaryCard} padding={14}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Win Rate</Text>
                <Text style={[styles.winRate, { color: winRate >= 60 ? colors.green : winRate >= 40 ? colors.gold : colors.red }]}>
                  {winRate}%
                </Text>
              </Card>
              <Card style={styles.summaryCard} padding={14}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total</Text>
                <Text style={[styles.totalTrades, { color: colors.foreground }]}>{botTrades.length}</Text>
              </Card>
            </View>

            {/* Active Bot pill with Change action */}
            <LinearGradient
              colors={[`${accent}1F`, "rgba(20,26,36,0.4)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.botCard, { borderColor: `${accent}40` }]}
            >
              <View style={[styles.botCardIcon, { backgroundColor: `${accent}26`, borderColor: `${accent}55` }]}>
                <Feather name="cpu" size={13} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.botCardName, { color: colors.foreground }]} numberOfLines={1}>
                  {selectedBot.name}
                </Text>
                <Text style={[styles.botCardSub, { color: colors.textMuted }]} numberOfLines={1}>
                  {selectedBot.description} · NSE/BSE + Crypto
                </Text>
              </View>
              <View style={[styles.liveDot, { backgroundColor: colors.green }]} />
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedBot(null);
                }}
                style={({ pressed }) => [
                  styles.changeBtn,
                  { borderColor: `${accent}66`, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.changeBtnText, { color: accent }]}>Change</Text>
              </Pressable>
            </LinearGradient>

            {/* Filters */}
            <View style={styles.filterRow}>
              {FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: filter === f ? colors.gold : colors.card,
                      borderColor: filter === f ? colors.gold : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.filterText, { color: filter === f ? colors.primaryForeground : colors.textSecondary }]}>
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.resultCount, { color: colors.textMuted }]}>
              {filtered.length} trade{filtered.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <TradeItem trade={item} />
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Feather name="inbox" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No trades found</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingHorizontal: 16, gap: 0 },
  listHeader: { gap: 12, marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, alignItems: "center", gap: 4 },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  winRate: { fontSize: 16, fontFamily: "Inter_700Bold" },
  totalTrades: { fontSize: 16, fontFamily: "Inter_700Bold" },
  botCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  botCardIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  botCardName: { fontSize: 13, fontFamily: "Inter_700Bold" },
  botCardSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  changeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  changeBtnText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  filterRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  filterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 48 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  // Bot picker
  pickerContent: { paddingHorizontal: 16, gap: 16 },
  pickerHeader: { gap: 4 },
  pickerTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pickerHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.6 },
  pickerSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  botList: { gap: 12, marginTop: 4 },
  botCardV2: {
    padding: 14,
    paddingTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    overflow: "hidden",
    position: "relative",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  cornerGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -80,
    right: -50,
    opacity: 0.10,
  },
  topAccent: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    height: 1,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 12, zIndex: 1 },
  iconShellWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconHalo: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 14,
    opacity: 0.22,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 2 },
  },
  iconShell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  iconShellHighlight: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    height: 20,
    borderRadius: 14,
  },
  botNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  botNameV2: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  botDescV2: { fontSize: 11.5, fontFamily: "Inter_500Medium" },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  activeDot: { width: 4, height: 4, borderRadius: 2 },
  activeText: { fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  sparkBlock: { alignItems: "flex-end", gap: 2, width: 80 },
  returnsV2: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  aumRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 2,
    borderTopWidth: 1,
    zIndex: 1,
  },
  aumLeft: { flexDirection: "row", alignItems: "center", gap: 5 },
  aumLabel: { fontSize: 10.5, fontFamily: "Inter_500Medium", letterSpacing: 0.2 },
  aumValue: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  statsRowV2: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 1,
  },
  statCellV2: { flex: 1, gap: 1 },
  statValV2: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  statLblV2: { fontSize: 9.5, fontFamily: "Inter_500Medium", letterSpacing: 0.4 },
  statDivV2: { width: 1, height: 22 },
  viewCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 4,
  },
  viewCtaText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  activeHero: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    overflow: "hidden",
    position: "relative",
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
  },
  activeHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  activeHeroBotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 1,
  },
  activeHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  activeHeroName: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  activeHeroDesc: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  activeHeroStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    zIndex: 1,
  },
  heroStatLbl: { fontSize: 9.5, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, marginBottom: 4 },
  heroStatVal: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  heroStatPct: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 1 },
  sectionLabel: {
    fontSize: 10.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginTop: 8,
    marginBottom: -4,
  },

  // Hedge-fund style active position card
  fundCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    padding: 16,
    paddingTop: 18,
    gap: 14,
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
  },
  fundTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  fundGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -100,
    right: -70,
    opacity: 0.07,
  },
  fundHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    zIndex: 1,
  },
  fundCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 6,
  },
  fundCode: {
    fontSize: 9.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  fundDivDot: { width: 2, height: 2, borderRadius: 1, opacity: 0.6 },
  fundNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  fundIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  fundName: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3, flex: 1 },
  fundLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(16,208,112,0.14)",
    borderWidth: 1,
    borderColor: "rgba(16,208,112,0.36)",
  },
  fundLiveDot: { width: 5, height: 5, borderRadius: 2.5 },
  fundLiveText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },

  fundNavBlock: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    zIndex: 1,
  },
  fundNavLbl: {
    fontSize: 9.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  fundNavVal: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
  },
  fundNavDeltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  fundNavDelta: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: -0.1 },
  fundBps: { fontSize: 10.5, fontFamily: "Inter_500Medium" },
  fundSparkBlock: { alignItems: "flex-end", gap: 3 },
  fundSparkLbl: {
    fontSize: 8.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },

  fundKpiGrid: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    zIndex: 1,
  },
  fundKpi: { flex: 1, gap: 3 },
  fundKpiLbl: {
    fontSize: 8.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.7,
  },
  fundKpiVal: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  fundKpiDiv: { width: 1, height: 22, marginHorizontal: 2 },

  fundAllocBlock: { gap: 6, zIndex: 1 },
  fundAllocLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fundAllocLbl: {
    fontSize: 9.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  fundAllocVal: { fontSize: 11, fontFamily: "Inter_700Bold" },
  fundAllocTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  fundAllocFill: { height: "100%", borderRadius: 3 },

  fundFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    zIndex: 1,
  },
  fundFooterItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  fundFooterText: { fontSize: 10.5, fontFamily: "Inter_500Medium" },
});
