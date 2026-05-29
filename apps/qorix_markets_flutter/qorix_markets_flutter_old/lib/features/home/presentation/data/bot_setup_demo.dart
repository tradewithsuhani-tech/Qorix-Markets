import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/core/theme/app_colors.dart';

/// Demo constants for Bot Setup / AI Trading Bot screen.
abstract final class BotSetupDemo {
  static const botVersion = 'v3.1';
  static const strategyId = 'QX-HUNTER';
  static const strategyVersion = 'v3.2';
  static const strategyLabel = 'Growth Strategy';
  static const strategyTagline = 'momentum-breakout · XAU/USD only';

  static const tradesPerDay = '30–55';
  static const latencyMs = 9;
  static const uptimePct = 99.93;
  static const winRatePct = 75;

  static const equity24h = [
    580.0, 592.0, 588.0, 598.0, 605.0, 601.0, 607.0, 612.0, 608.0, 607.61,
  ];

  static const deployPresets = [100.0, 250.0, 500.0, 1000.0];

  static const exploreBots = [
    BotExploreItem(
      id: 'arbitrage',
      presetId: 'pilot',
      deployVersion: 'v2.1',
      deployMarkets: 'Major FX pairs + Crypto',
      deployReturn: '10–15%/mo',
      riskLabel: 'Moderate',
      name: 'Arbitrage Bot',
      subtitle: 'Spread strategy',
      returnPct: 12,
      accent: Color(0xFF4DA3FF),
      investors: '2.18K',
      winRate: 81,
      avgMo: 2.8,
      aum: '₹7.1Cr',
      isLive: true,
    ),
    BotExploreItem(
      id: 'scalping',
      presetId: 'hunter',
      deployVersion: 'v3.0',
      deployMarkets: 'FX scalps · Crypto perps',
      deployReturn: '12–18%/mo',
      riskLabel: 'Aggressive',
      name: 'Scalping Bot',
      subtitle: 'HFT strategy',
      returnPct: 9,
      accent: Color(0xFFFF6B8A),
      investors: '890',
      winRate: 64,
      avgMo: 6.1,
      aum: '₹2.3Cr',
    ),
    BotExploreItem(
      id: 'grid',
      presetId: 'sentinel',
      deployVersion: 'v1.8',
      deployMarkets: 'FX range pairs · XAU/USD',
      deployReturn: '6–10%/mo',
      riskLabel: 'Conservative',
      name: 'Grid Trading Bot',
      subtitle: 'Range strategy',
      returnPct: 14,
      accent: AppColors.authGreen,
      investors: '540',
      winRate: 69,
      avgMo: 3.4,
      aum: '₹1.6Cr',
    ),
    BotExploreItem(
      id: 'market-broker',
      presetId: 'broker',
      deployVersion: 'v1.0',
      deployMarkets: 'NSE · BSE equities via Zerodha',
      deployReturn: 'Demo + Live',
      riskLabel: 'Broker linked',
      name: 'Market Broker',
      subtitle: 'Zerodha + Demo trading',
      returnPct: 0,
      accent: const Color(0xFF387ED1),
      investors: 'New',
      winRate: 0,
      avgMo: 0,
      aum: '—',
      isLive: true,
    ),
  ];

  static const activeBotEquity30d = [
    70800.0, 71200.0, 70950.0, 72100.0, 72800.0, 72400.0, 73100.0, 73800.0, 74200.0, 74500.0, 74900.0, 77451.0,
  ];

  static const minDeployInr = 5000.0;
  static const availableDeployInr = 104312.539;
  static const quickDeployInr = [10000.0, 25000.0, 50000.0, 100000.0];

  static BotExploreItem? findExploreBot(String id) {
    for (final bot in exploreBots) {
      if (bot.id == id) return bot;
    }
    return null;
  }

  /// Parses e.g. `10–15%/mo` → (10.0, 15.0).
  static (double low, double high) parseMonthlyReturnPct(String deployReturn) {
    final match = RegExp(r'(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)').firstMatch(deployReturn);
    if (match == null) return (10, 15);
    return (double.parse(match.group(1)!), double.parse(match.group(2)!));
  }

  /// Hard stop-loss % shown on deploy risk card (tighter than preset max DD).
  static double hardStopLossPct(String presetId) => switch (presetId) {
        'sentinel' => 0.85,
        'pilot' => 1.19,
        'hunter' => 2.45,
        _ => 1.19,
      };

  static const clientShareLabel = '70–80% client share';

  static String generateTxnId() {
    final seed = DateTime.now().millisecondsSinceEpoch.toRadixString(36).toUpperCase();
    return 'TXN${seed.length > 8 ? seed.substring(seed.length - 8) : seed.padLeft(8, '0')}';
  }

  static DeployReceiptMetrics receiptMetrics({required BotExploreItem bot, required double amountInr}) {
    final (_, returnHigh) = parseMonthlyReturnPct(bot.deployReturn);
    final stopPct = hardStopLossPct(bot.presetId);
    return DeployReceiptMetrics(
      expectedProfitInr: amountInr * returnHigh / 100,
      returnLabel: bot.deployReturn.replaceAll('/mo', '').trim(),
      stopLossInr: amountInr * stopPct / 100,
      stopLossPct: stopPct,
    );
  }
}

class DeployReceiptMetrics {
  const DeployReceiptMetrics({
    required this.expectedProfitInr,
    required this.returnLabel,
    required this.stopLossInr,
    required this.stopLossPct,
  });

  final double expectedProfitInr;
  final String returnLabel;
  final double stopLossInr;
  final double stopLossPct;
}

abstract final class ActiveBotDemo {
  static const stratId = 'TREND-7741';
  static const inception = '28 APR';
  static const name = 'Trend-following Bot';
  static const tagline = 'Momentum breakout · XAU/USD · FX majors';
  static const navInr = 77451.0;
  static const pnlInr = 6544.0;
  static const pnlPct = 9.23;
  static const bps = 923;
  static const sharpe = 2.18;
  static const winRate = 73;
  static const maxDd = -4.2;
  static const tradesToday = 14;
  static const portfolioPct = 40.5;
  static const botCapitalInr = 70907.0;
  static const totalPortfolioInr = 175220.0;
  static const lastTradeSec = 14;
  static const risk = 'Moderate';
  static const investors = '4.8K+';
  static const uptimePct = 99.93;
  static const aumManaged = '₹12.4Cr';
  static const monthlyTarget = '8–12%/mo';
}

class BotExploreItem {
  const BotExploreItem({
    required this.id,
    required this.presetId,
    required this.deployVersion,
    required this.deployMarkets,
    required this.deployReturn,
    required this.riskLabel,
    required this.name,
    required this.subtitle,
    required this.returnPct,
    required this.accent,
    required this.investors,
    required this.winRate,
    required this.avgMo,
    required this.aum,
    this.isLive = false,
  });

  final String id;
  final String presetId;
  final String deployVersion;
  final String deployMarkets;
  final String deployReturn;
  final String riskLabel;
  final String name;
  final String subtitle;
  final int returnPct;
  final Color accent;
  final String investors;
  final int winRate;
  final double avgMo;
  final String aum;
  final bool isLive;
}
