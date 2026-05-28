import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_pair.dart';

class TradeModel {
  const TradeModel({
    required this.id,
    required this.symbol,
    required this.direction,
    required this.entryPrice,
    required this.exitPrice,
    required this.profit,
    required this.profitPercent,
    required this.executedAt,
  });

  factory TradeModel.fromJson(Map<String, dynamic> json) {
    return TradeModel(
      id: (json['id'] as num?)?.toInt() ?? 0,
      symbol: json['symbol'] as String? ?? 'UNKNOWN',
      direction: json['direction'] as String? ?? 'long',
      entryPrice: ApiJson.asDouble(json['entryPrice']),
      exitPrice: ApiJson.asDouble(json['exitPrice']),
      profit: ApiJson.asDouble(json['profit']),
      profitPercent: ApiJson.asDouble(json['profitPercent']),
      executedAt: json['executedAt'] as String? ?? DateTime.now().toIso8601String(),
    );
  }

  final int id;
  final String symbol;
  final String direction;
  final double entryPrice;
  final double exitPrice;
  final double profit;
  final double profitPercent;
  final String executedAt;

  MarketPair toMarketPair() => MarketPair(
        symbol: symbol,
        price: exitPrice > 0 ? exitPrice : entryPrice,
        changePercent: profitPercent,
      );
}
