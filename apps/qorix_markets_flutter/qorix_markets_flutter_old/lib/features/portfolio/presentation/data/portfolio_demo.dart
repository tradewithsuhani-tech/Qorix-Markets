import 'package:flutter/material.dart';

import 'package:qorix_markets_flutter/features/home/presentation/data/bot_presets.dart';
import 'package:qorix_markets_flutter/features/invest/domain/entities/investment_state.dart';

class PortfolioDayCell {
  const PortfolioDayCell({
    required this.label,
    required this.isSettled,
    required this.isToday,
    required this.isUpcoming,
    this.profit,
  });

  final String label;
  final double? profit;
  final bool isSettled;
  final bool isToday;
  final bool isUpcoming;
}

class PortfolioAllocationSlice {
  const PortfolioAllocationSlice({
    required this.label,
    required this.percent,
    required this.color,
    required this.value,
  });

  final String label;
  final double percent;
  final Color color;
  final double value;
}

class PortfolioViewData {
  const PortfolioViewData({
    required this.isActive,
    required this.invested,
    required this.currentValue,
    required this.netProfit,
    required this.roiPercent,
    required this.daysRunning,
    required this.drawdownLimit,
    required this.autoCompound,
    required this.isPaused,
    required this.monthlyLow,
    required this.monthlyHigh,
    required this.monthlyTag,
    required this.earnedThisMonth,
    required this.earnedThisMonthPct,
    required this.tradingDaysTotal,
    required this.tradingDaysSettled,
    required this.tradingDaysLeft,
    required this.dailyCells,
    required this.allocation,
    required this.marketsOpen,
    required this.todayProfit,
    required this.todayPct,
    required this.updatedSecondsAgo,
    this.preset,
  });

  final bool isActive;
  final BotPreset? preset;
  final double invested;
  final double currentValue;
  final double netProfit;
  final double roiPercent;
  final int daysRunning;
  final double drawdownLimit;
  final bool autoCompound;
  final bool isPaused;
  final double monthlyLow;
  final double monthlyHigh;
  final String monthlyTag;
  final double earnedThisMonth;
  final double earnedThisMonthPct;
  final int tradingDaysTotal;
  final int tradingDaysSettled;
  final int tradingDaysLeft;
  final List<PortfolioDayCell> dailyCells;
  final List<PortfolioAllocationSlice> allocation;
  final bool marketsOpen;
  final double todayProfit;
  final double todayPct;
  final int updatedSecondsAgo;

  double get progressPct =>
      tradingDaysTotal == 0 ? 0 : (tradingDaysSettled / tradingDaysTotal).clamp(0.0, 1.0);

  String get riskLabel => preset?.personality ?? '—';

  String get botCodename => preset?.codename ?? 'QX-Desk';

  static PortfolioViewData fromInvestment(InvestmentState? inv, {DateTime? now}) {
    final clock = now ?? DateTime.now();
    if (inv == null || !inv.isActive) return PortfolioViewData.inactive(clock);

    final preset = BotPresets.byRiskProfileId(inv.riskLevel) ?? BotPresets.all[1];
    final invested = inv.amount;
    final netProfit = inv.totalProfit > 0 ? inv.totalProfit : invested * 0.0387;
    final currentValue = invested + netProfit;
    final roi = invested > 0 ? (netProfit / invested) * 100 : 0.0;
    final (monthlyLow, monthlyHigh) = preset.monthlyReturnRange(invested);
    final daysRunning = inv.startedAt == null ? 0 : clock.difference(inv.startedAt!).inDays;

    final daily = _buildDailyGrid(clock, invested, preset);
    final settled = daily.where((d) => d.isSettled).length;
    final earned = daily.fold<double>(0, (s, d) => s + (d.profit ?? 0));
    final earnedPct = invested > 0 ? (earned / invested) * 100 : 0.0;
    final totalDays = daily.length;
    final left = daily.where((d) => d.isUpcoming).length;
    final isWeekend = clock.weekday == DateTime.saturday || clock.weekday == DateTime.sunday;

    return PortfolioViewData(
      isActive: true,
      preset: preset,
      invested: invested,
      currentValue: currentValue,
      netProfit: netProfit,
      roiPercent: roi,
      daysRunning: daysRunning,
      drawdownLimit: inv.drawdownLimit,
      autoCompound: inv.autoCompound,
      isPaused: inv.isPaused,
      monthlyLow: monthlyLow,
      monthlyHigh: monthlyHigh,
      monthlyTag: preset.monthlyTag,
      earnedThisMonth: earned,
      earnedThisMonthPct: earnedPct,
      tradingDaysTotal: totalDays,
      tradingDaysSettled: settled,
      tradingDaysLeft: left,
      dailyCells: daily,
      allocation: _allocationFor(preset, invested),
      marketsOpen: !isWeekend && !inv.isPaused,
      todayProfit: inv.dailyProfit,
      todayPct: invested > 0 ? (inv.dailyProfit / invested) * 100 : 0,
      updatedSecondsAgo: 12 + clock.second % 40,
    );
  }

  factory PortfolioViewData.inactive(DateTime clock) {
    return PortfolioViewData(
      isActive: false,
      invested: 0,
      currentValue: 0,
      netProfit: 0,
      roiPercent: 0,
      daysRunning: 0,
      drawdownLimit: 5,
      autoCompound: false,
      isPaused: false,
      monthlyLow: 0,
      monthlyHigh: 0,
      monthlyTag: '—',
      earnedThisMonth: 0,
      earnedThisMonthPct: 0,
      tradingDaysTotal: 0,
      tradingDaysSettled: 0,
      tradingDaysLeft: 0,
      dailyCells: const [],
      allocation: const [],
      marketsOpen: false,
      todayProfit: 0,
      todayPct: 0,
      updatedSecondsAgo: clock.second % 30,
    );
  }

  static List<PortfolioDayCell> _buildDailyGrid(DateTime now, double invested, BotPreset preset) {
    final (_, highPct) = switch (preset.id) {
      'sentinel' => (0.02, 0.05),
      'pilot' => (0.04, 0.06),
      'hunter' => (0.05, 0.08),
      _ => (0.02, 0.08),
    };
    final dailyRate = highPct / 21;

    final monthStart = DateTime(now.year, now.month, 1);
    final monthEnd = DateTime(now.year, now.month + 1, 0);
    final cells = <PortfolioDayCell>[];
    var dayCursor = monthStart;
    var sessionIndex = 0;

    while (!dayCursor.isAfter(monthEnd)) {
      if (dayCursor.weekday >= DateTime.monday && dayCursor.weekday <= DateTime.friday) {
        final label = _dayLabel(dayCursor);
        final isToday = _sameDay(dayCursor, now);
        final isPast = dayCursor.isBefore(DateTime(now.year, now.month, now.day));
        final isFuture = dayCursor.isAfter(DateTime(now.year, now.month, now.day));

        if (isPast) {
          final profit = invested * dailyRate * (0.85 + (sessionIndex % 5) * 0.04);
          cells.add(PortfolioDayCell(label: label, profit: profit, isSettled: true, isToday: false, isUpcoming: false));
        } else if (isToday) {
          final profit = now.weekday <= DateTime.friday ? invested * dailyRate * 0.6 : null;
          cells.add(PortfolioDayCell(label: label, profit: profit, isSettled: profit != null, isToday: true, isUpcoming: profit == null));
        } else {
          cells.add(PortfolioDayCell(label: label, isSettled: false, isToday: false, isUpcoming: isFuture));
        }
        sessionIndex++;
      }
      dayCursor = dayCursor.add(const Duration(days: 1));
    }
    return cells;
  }

  static String _dayLabel(DateTime d) {
    const names = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    return '${names[d.weekday - 1]} ${d.day}';
  }

  static bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  static List<PortfolioAllocationSlice> _allocationFor(BotPreset preset, double invested) {
    const splits = [
      (0.80, 'Gold (XAU)', Color(0xFFF59E0B)),
      (0.10, 'Forex Majors', Color(0xFF60A5FA)),
      (0.06, 'Indices', Color(0xFF8B5CF6)),
      (0.04, 'Crypto Majors', Color(0xFF4ADE80)),
    ];

    return splits
        .map(
          (s) => PortfolioAllocationSlice(
            label: s.$2,
            percent: s.$1,
            color: s.$3,
            value: invested * s.$1,
          ),
        )
        .toList();
  }
}
