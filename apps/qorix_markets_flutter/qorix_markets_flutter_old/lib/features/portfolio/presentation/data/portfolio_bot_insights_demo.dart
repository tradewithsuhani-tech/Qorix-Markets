import 'package:flutter/material.dart';

class PortfolioBotMetric {
  const PortfolioBotMetric({required this.label, required this.pct});

  final String label;
  final int pct;
}

class PortfolioBestBotResult {
  const PortfolioBestBotResult({
    required this.id,
    required this.name,
    required this.returnPct,
    required this.accent,
    required this.sparkline,
  });

  final String id;
  final String name;
  final int returnPct;
  final Color accent;
  final List<double> sparkline;
}

abstract final class PortfolioBotInsightsDemo {
  static const tierName = 'Gold Tier';
  static const nextTier = 'Platinum';
  static const toNextTierInr = 45330.0;
  static const tierProgress = 0.64;

  static const intelligenceMessage = 'Volatility spike detected — switching to scalp mode';

  static const activeBotName = 'MomentumBot v2.1';
  static const activeBotSubtitle = 'Neural · moderate risk profile';
  static const statusMessage = 'Cross-referencing volatility surfaces...';

  static const metrics = [
    PortfolioBotMetric(label: 'Pattern Recognition', pct: 93),
    PortfolioBotMetric(label: 'Risk Assessment', pct: 86),
    PortfolioBotMetric(label: 'Volatility Analysis', pct: 78),
    PortfolioBotMetric(label: 'Order Flow', pct: 82),
  ];

  static const bestBots = [
    PortfolioBestBotResult(
      id: 'trend',
      name: 'Trend-following Bot',
      returnPct: 17,
      accent: Color(0xFF818CF8),
      sparkline: [0.42, 0.48, 0.45, 0.52, 0.58, 0.55, 0.62, 0.68, 0.72, 0.78],
    ),
    PortfolioBestBotResult(
      id: 'arbitrage',
      name: 'Arbitrage Bot',
      returnPct: 12,
      accent: Color(0xFF60A5FA),
      sparkline: [0.38, 0.41, 0.44, 0.43, 0.47, 0.5, 0.52, 0.54, 0.56, 0.59],
    ),
    PortfolioBestBotResult(
      id: 'grid',
      name: 'Grid Trading Bot',
      returnPct: 10,
      accent: Color(0xFF00E676),
      sparkline: [0.5, 0.51, 0.52, 0.53, 0.54, 0.55, 0.56, 0.57, 0.58, 0.6],
    ),
  ];
}
