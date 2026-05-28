import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/trade_model.dart';
import 'package:qorix_markets_flutter/features/bots/domain/entities/bot_entity.dart';

class BotListItemModel {
  const BotListItemModel({
    required this.id,
    required this.name,
    required this.strategy,
    required this.status,
    required this.allocatedAmount,
    required this.totalReturn,
    required this.totalReturnPercent,
    required this.isActive,
  });

  factory BotListItemModel.fromJson(Map<String, dynamic> json) {
    return BotListItemModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] as String? ?? json['label'] as String? ?? 'Bot',
      strategy: json['strategy'] as String? ?? json['type'] as String? ?? 'momentum',
      status: json['status'] as String? ?? (json['isActive'] == true ? 'active' : 'idle'),
      allocatedAmount: ApiJson.asDouble(json['allocatedAmount'] ?? json['amount'] ?? json['capital']),
      totalReturn: ApiJson.asDouble(json['totalReturn'] ?? json['totalProfit'] ?? json['pnl']),
      totalReturnPercent: ApiJson.asDouble(json['totalReturnPercent'] ?? json['pnlPercent'] ?? json['roi']),
      isActive: json['isActive'] as bool? ?? json['status'] == 'active',
    );
  }

  final String id;
  final String name;
  final String strategy;
  final String status;
  final double allocatedAmount;
  final double totalReturn;
  final double totalReturnPercent;
  final bool isActive;

  BotEntity toEntity() => BotEntity(
        id: id,
        name: name,
        strategy: strategy,
        status: status,
        allocatedAmount: allocatedAmount,
        totalReturn: totalReturn,
        totalReturnPercent: totalReturnPercent,
        isActive: isActive,
      );
}

class BotListModel {
  factory BotListModel.fromJson(dynamic raw) {
    return BotListModel(
      items: ApiJson.list(raw, listKey: 'bots').map(BotListItemModel.fromJson).toList(),
    );
  }

  const BotListModel({required this.items});

  final List<BotListItemModel> items;
}

class BotPerformanceItemModel {
  const BotPerformanceItemModel({
    required this.botId,
    required this.botName,
    required this.pnl,
    required this.pnlPercent,
    required this.winRate,
    required this.tradesCount,
    this.symbol,
    this.direction,
    this.executedAt,
  });

  factory BotPerformanceItemModel.fromJson(Map<String, dynamic> json) {
    return BotPerformanceItemModel(
      botId: json['botId']?.toString() ?? json['id']?.toString() ?? '',
      botName: json['botName'] as String? ?? json['name'] as String? ?? 'Desk Bot',
      pnl: ApiJson.asDouble(json['pnl'] ?? json['profit']),
      pnlPercent: ApiJson.asDouble(json['pnlPercent'] ?? json['profitPercent'] ?? json['roi']),
      winRate: ApiJson.asDouble(json['winRate']),
      tradesCount: (json['tradesCount'] as num?)?.toInt() ?? (json['trades'] as num?)?.toInt() ?? 0,
      symbol: json['symbol'] as String?,
      direction: json['direction'] as String?,
      executedAt: json['executedAt'] as String? ?? json['closedAt'] as String?,
    );
  }

  final String botId;
  final String botName;
  final double pnl;
  final double pnlPercent;
  final double winRate;
  final int tradesCount;
  final String? symbol;
  final String? direction;
  final String? executedAt;

  TradeModel toTradeModel({required int index}) => TradeModel(
        id: index,
        symbol: symbol ?? botName,
        direction: direction ?? 'long',
        entryPrice: 0,
        exitPrice: 0,
        profit: pnl,
        profitPercent: pnlPercent,
        executedAt: executedAt ?? DateTime.now().toIso8601String(),
      );

  BotPerformanceEntity toEntity() => BotPerformanceEntity(
        botId: botId,
        botName: botName,
        pnl: pnl,
        pnlPercent: pnlPercent,
        winRate: winRate,
        tradesCount: tradesCount,
      );
}

class BotPerformanceModel {
  factory BotPerformanceModel.fromJson(dynamic raw) {
    return BotPerformanceModel(
      items: ApiJson.list(raw, listKey: 'performance').map(BotPerformanceItemModel.fromJson).toList(),
    );
  }

  const BotPerformanceModel({required this.items});

  final List<BotPerformanceItemModel> items;
}
