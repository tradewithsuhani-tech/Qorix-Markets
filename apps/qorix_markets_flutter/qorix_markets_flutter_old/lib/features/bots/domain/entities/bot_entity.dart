import 'package:equatable/equatable.dart';

class BotEntity extends Equatable {
  const BotEntity({
    required this.id,
    required this.name,
    required this.strategy,
    required this.status,
    required this.allocatedAmount,
    required this.totalReturn,
    required this.totalReturnPercent,
    required this.isActive,
  });

  final String id;
  final String name;
  final String strategy;
  final String status;
  final double allocatedAmount;
  final double totalReturn;
  final double totalReturnPercent;
  final bool isActive;

  @override
  List<Object?> get props =>
      [id, name, strategy, status, allocatedAmount, totalReturn, totalReturnPercent, isActive];
}

class BotPerformanceEntity extends Equatable {
  const BotPerformanceEntity({
    required this.botId,
    required this.botName,
    required this.pnl,
    required this.pnlPercent,
    required this.winRate,
    required this.tradesCount,
  });

  final String botId;
  final String botName;
  final double pnl;
  final double pnlPercent;
  final double winRate;
  final int tradesCount;

  @override
  List<Object?> get props => [botId, botName, pnl, pnlPercent, winRate, tradesCount];
}
