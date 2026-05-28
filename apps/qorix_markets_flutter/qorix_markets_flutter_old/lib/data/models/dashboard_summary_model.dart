import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/dashboard/domain/entities/dashboard_snapshot.dart';
import 'package:qorix_markets_flutter/features/portfolio/domain/entities/portfolio_summary.dart';

class DashboardSummaryModel {
  const DashboardSummaryModel({
    required this.totalBalance,
    required this.dailyProfitLoss,
    required this.dailyProfitPercent,
    required this.totalProfit,
    required this.tradingBalance,
    required this.profitBalance,
    required this.mainBalance,
    required this.activeInvestment,
    required this.isTrading,
    required this.daysUntilPayout,
    required this.vip,
    this.riskLevel,
  });

  factory DashboardSummaryModel.fromJson(Map<String, dynamic> json) {
    final root = ApiJson.object(json);
    final vipJson = root['vip'] as Map<String, dynamic>?;
    return DashboardSummaryModel(
      totalBalance: _n(root['totalBalance'] ?? root['portfolioValue'] ?? root['balance']),
      dailyProfitLoss: _n(root['dailyProfitLoss'] ?? root['dailyPnl'] ?? root['dailyProfit']),
      dailyProfitPercent: _n(root['dailyProfitPercent'] ?? root['dailyPnlPercent']),
      totalProfit: _n(root['totalProfit'] ?? root['totalPnl']),
      tradingBalance: _n(root['tradingBalance'] ?? root['trading']),
      profitBalance: _n(root['profitBalance'] ?? root['profit']),
      mainBalance: _n(root['mainBalance'] ?? root['main']),
      activeInvestment: _n(root['activeInvestment'] ?? root['deployedCapital']),
      isTrading: root['isTrading'] as bool? ?? root['hasActiveBots'] as bool? ?? false,
      daysUntilPayout: (root['daysUntilPayout'] as num?)?.toInt() ?? 0,
      riskLevel: root['riskLevel'] as String?,
      vip: VipInfoModel.fromJson(vipJson ?? {}),
    );
  }

  final double totalBalance;
  final double dailyProfitLoss;
  final double dailyProfitPercent;
  final double totalProfit;
  final double tradingBalance;
  final double profitBalance;
  final double mainBalance;
  final double activeInvestment;
  final bool isTrading;
  final int daysUntilPayout;
  final String? riskLevel;
  final VipInfoModel vip;

  PortfolioSummary toEntity() => PortfolioSummary(
        totalBalance: totalBalance,
        dailyPnl: dailyProfitLoss,
        dailyPnlPercent: dailyProfitPercent,
        totalProfit: totalProfit,
        activeInvestment: activeInvestment,
        isTrading: isTrading,
      );

  DashboardSnapshot toSnapshot({List<EquityPointModel> equity = const [], FundStatsModel? fundStats}) =>
      DashboardSnapshot(
        totalBalance: totalBalance,
        dailyPnl: dailyProfitLoss,
        dailyPnlPercent: dailyProfitPercent,
        totalProfit: totalProfit,
        activeInvestment: activeInvestment,
        isTrading: isTrading,
        tradingBalance: tradingBalance,
        profitBalance: profitBalance,
        mainBalance: mainBalance,
        daysUntilPayout: daysUntilPayout,
        equityPoints: equity
            .map((e) => EquityPoint(date: e.date, equity: e.equity, profit: e.profit))
            .toList(),
        monthlyReturn: dailyProfitPercent * 30,
        totalReturn: totalProfit,
        vip: vip.toEntity(),
        riskLevel: riskLevel,
        fundStats: fundStats?.toEntity(),
      );

  static double _n(dynamic v) => (v as num?)?.toDouble() ?? 0;
}

class VipInfoModel {
  const VipInfoModel({
    required this.tier,
    required this.label,
    required this.profitBonus,
    required this.withdrawalFee,
    required this.minAmount,
    this.nextTierLabel,
    this.nextTierMin,
    this.amountNeeded,
  });

  factory VipInfoModel.fromJson(Map<String, dynamic> json) {
    final next = json['nextTier'] as Map<String, dynamic>?;
    return VipInfoModel(
      tier: json['tier'] as String? ?? 'none',
      label: json['label'] as String? ?? 'Member',
      profitBonus: _n(json['profitBonus']),
      withdrawalFee: _n(json['withdrawalFee']),
      minAmount: _n(json['minAmount']),
      nextTierLabel: next?['label'] as String?,
      nextTierMin: _n(next?['minAmount']),
      amountNeeded: _n(next?['amountNeeded']),
    );
  }

  final String tier;
  final String label;
  final double profitBonus;
  final double withdrawalFee;
  final double minAmount;
  final String? nextTierLabel;
  final double? nextTierMin;
  final double? amountNeeded;

  VipInfo toEntity() => VipInfo(
        tier: tier,
        label: label,
        profitBonus: profitBonus,
        withdrawalFee: withdrawalFee,
        minAmount: minAmount,
        nextTierLabel: nextTierLabel,
        nextTierMin: nextTierMin,
        amountNeeded: amountNeeded,
      );

  static double _n(dynamic v) => (v as num?)?.toDouble() ?? 0;
}

class FundStatsModel {
  const FundStatsModel({
    required this.aum,
    required this.activeInvestors,
    required this.winRate,
  });

  factory FundStatsModel.fromJson(Map<String, dynamic> json) {
    return FundStatsModel(
      aum: _n(json['aum'] ?? json['totalAum']),
      activeInvestors: (json['activeInvestors'] as num?)?.toInt() ?? 0,
      winRate: _n(json['winRate']),
    );
  }

  final double aum;
  final int activeInvestors;
  final double winRate;

  FundStats toEntity() => FundStats(
        aum: aum,
        activeInvestors: activeInvestors,
        winRate: winRate,
      );

  static double _n(dynamic v) => (v as num?)?.toDouble() ?? 0;
}

class EquityPointModel {
  const EquityPointModel({required this.date, required this.equity, required this.profit});

  factory EquityPointModel.fromJson(Map<String, dynamic> json) {
    return EquityPointModel(
      date: json['date'] as String? ?? '',
      equity: (json['equity'] as num?)?.toDouble() ?? 0,
      profit: (json['profit'] as num?)?.toDouble() ?? 0,
    );
  }

  final String date;
  final double equity;
  final double profit;
}
