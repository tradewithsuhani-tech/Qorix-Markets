import 'package:equatable/equatable.dart';

class PortfolioSummary extends Equatable {
  const PortfolioSummary({
    required this.totalBalance,
    required this.dailyPnl,
    required this.dailyPnlPercent,
    required this.totalProfit,
    required this.activeInvestment,
    required this.isTrading,
  });

  final double totalBalance;
  final double dailyPnl;
  final double dailyPnlPercent;
  final double totalProfit;
  final double activeInvestment;
  final bool isTrading;

  @override
  List<Object?> get props => [totalBalance, dailyPnl, dailyPnlPercent, totalProfit, activeInvestment, isTrading];
}
