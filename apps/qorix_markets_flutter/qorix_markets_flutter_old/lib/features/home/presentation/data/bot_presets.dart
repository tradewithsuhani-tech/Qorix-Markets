import 'package:flutter/material.dart';

class BotPreset {
  const BotPreset({
    required this.id,
    required this.name,
    required this.riskProfileId,
    required this.accentColor,
    required this.monthlyRange,
    required this.codename,
    required this.personality,
    required this.defaultDrawdown,
    required this.version,
    required this.strategyType,
    required this.description,
    required this.winRate,
    required this.tradesPerDay,
    required this.latencyMs,
    required this.monthlyTag,
    required this.ddTag,
    required this.pairs,
    required this.uptimeTag,
    required this.riskExposure,
    required this.riskMax,
    required this.monthlyTarget,
    required this.capabilities,
    this.recommended = false,
    this.quickAmountValues = const [500, 1000, 2500, 5000],
    this.monthlyReturnLowPct = 0.06,
    this.monthlyReturnHighPct = 0.12,
  });

  final String id;
  final String name;
  final String riskProfileId;
  final Color accentColor;
  final String monthlyRange;
  final String codename;
  final String personality;
  final double defaultDrawdown;
  final String version;
  final String strategyType;
  final String description;
  final int winRate;
  final String tradesPerDay;
  final int latencyMs;
  final String monthlyTag;
  final String ddTag;
  final String pairs;
  final String uptimeTag;
  final int riskExposure;
  final int riskMax;
  final String monthlyTarget;
  final List<String> capabilities;
  final bool recommended;
  final List<double> quickAmountValues;
  final double monthlyReturnLowPct;
  final double monthlyReturnHighPct;

  Color get accent => accentColor;

  List<double> quickAmounts() => quickAmountValues;

  (double, double) monthlyReturnRange(double amount) => (
        amount * monthlyReturnLowPct,
        amount * monthlyReturnHighPct,
      );

  double maxDrawdownLoss(double amount, double drawdownLimitPct) =>
      amount * (drawdownLimitPct / 100);
}

abstract final class BotPresets {
  static const all = [
    BotPreset(
      id: 'momentum',
      name: 'Momentum Pro',
      codename: 'APEX-7',
      personality: 'Momentum desk',
      strategyType: 'TREND FOLLOWING',
      description: 'High-frequency momentum engine tuned for gold and FX majors.',
      riskProfileId: 'MEDIUM',
      accentColor: Color(0xFF8B5CF6),
      monthlyRange: '6–12%',
      defaultDrawdown: 5,
      version: 'v4.2',
      recommended: true,
      winRate: 84,
      tradesPerDay: '120–180',
      latencyMs: 12,
      monthlyTag: '6–12% / mo',
      ddTag: 'Max DD 5%',
      pairs: 'XAU · EUR · BTC',
      uptimeTag: '99.9% uptime',
      riskExposure: 6,
      riskMax: 10,
      monthlyTarget: '8–12%',
      capabilities: const [
        'Auto risk throttle on volatility spikes',
        'Session-aware position sizing',
        'Profit lock at daily target',
      ],
      monthlyReturnLowPct: 0.06,
      monthlyReturnHighPct: 0.12,
    ),
    BotPreset(
      id: 'hedge',
      name: 'Hedge Shield',
      codename: 'SHIELD-2',
      personality: 'Capital guard',
      strategyType: 'CAPITAL PROTECTION',
      description: 'Conservative hedge-first desk prioritizing drawdown control.',
      riskProfileId: 'LOW',
      accentColor: Color(0xFF10B981),
      monthlyRange: '3–6%',
      defaultDrawdown: 3,
      version: 'v3.8',
      winRate: 91,
      tradesPerDay: '40–70',
      latencyMs: 18,
      monthlyTag: '3–6% / mo',
      ddTag: 'Max DD 3%',
      pairs: 'XAU · USD basket',
      uptimeTag: '99.7% uptime',
      riskExposure: 4,
      riskMax: 10,
      monthlyTarget: '4–6%',
      capabilities: const [
        'Hard stop before drawdown breach',
        'Weekend gap protection',
        'Auto de-risk on macro events',
      ],
      monthlyReturnLowPct: 0.03,
      monthlyReturnHighPct: 0.06,
    ),
  ];

  static BotPreset byId(String id) =>
      all.firstWhere((p) => p.id == id, orElse: () => all.first);

  static BotPreset byRiskProfileId(String riskId) =>
      all.firstWhere((p) => p.riskProfileId == riskId, orElse: () => all.first);
}
