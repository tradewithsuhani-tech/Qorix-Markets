import 'package:equatable/equatable.dart';

class VipInfo extends Equatable {
  const VipInfo({
    required this.tier,
    required this.label,
    required this.profitBonus,
    required this.withdrawalFee,
    required this.minAmount,
    this.nextTierLabel,
    this.nextTierMin,
    this.amountNeeded,
  });

  final String tier;
  final String label;
  final double profitBonus;
  final double withdrawalFee;
  final double minAmount;
  final String? nextTierLabel;
  final double? nextTierMin;
  final double? amountNeeded;

  @override
  List<Object?> get props => [tier, label, profitBonus, withdrawalFee, minAmount, nextTierLabel, nextTierMin, amountNeeded];
}

class FundStats extends Equatable {
  const FundStats({required this.aum, required this.activeInvestors, required this.winRate});
  final double aum;
  final int activeInvestors;
  final double winRate;
  @override
  List<Object?> get props => [aum, activeInvestors, winRate];
}

class EquityPoint extends Equatable {
  const EquityPoint({required this.date, required this.equity, required this.profit});
  final String date;
  final double equity;
  final double profit;
  @override
  List<Object?> get props => [date, equity, profit];
}

class DashboardSnapshot extends Equatable {
  const DashboardSnapshot({
    required this.totalBalance,
    required this.dailyPnl,
    required this.dailyPnlPercent,
    required this.totalProfit,
    required this.activeInvestment,
    required this.isTrading,
    required this.tradingBalance,
    required this.profitBalance,
    required this.mainBalance,
    required this.daysUntilPayout,
    required this.equityPoints,
    required this.monthlyReturn,
    required this.totalReturn,
    required this.vip,
    this.riskLevel,
    this.fundStats,
  });

  final double totalBalance;
  final double dailyPnl;
  final double dailyPnlPercent;
  final double totalProfit;
  final double activeInvestment;
  final bool isTrading;
  final double tradingBalance;
  final double profitBalance;
  final double mainBalance;
  final int daysUntilPayout;
  final List<EquityPoint> equityPoints;
  final double monthlyReturn;
  final double totalReturn;
  final VipInfo vip;
  final String? riskLevel;
  final FundStats? fundStats;

  @override
  List<Object?> get props => [
        totalBalance, dailyPnl, dailyPnlPercent, totalProfit, activeInvestment, isTrading,
        tradingBalance, profitBalance, mainBalance, daysUntilPayout, equityPoints,
        monthlyReturn, totalReturn, vip, riskLevel, fundStats,
      ];
}
