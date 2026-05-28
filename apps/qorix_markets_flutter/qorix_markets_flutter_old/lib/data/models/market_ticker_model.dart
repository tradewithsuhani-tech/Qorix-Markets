import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_pair.dart';

class MarketTickerModel {
  const MarketTickerModel({
    required this.symbol,
    required this.price,
    required this.change24h,
    required this.high24h,
    required this.low24h,
    required this.volume24h,
  });

  factory MarketTickerModel.fromJson(Map<String, dynamic> json) {
    return MarketTickerModel(
      symbol: json['symbol'] as String? ?? json['pair'] as String? ?? 'USDT/INR',
      price: ApiJson.asDouble(json['price'] ?? json['last'] ?? json['lastPrice']),
      change24h: ApiJson.asDouble(json['change24h'] ?? json['changePercent'] ?? json['change']),
      high24h: ApiJson.asDouble(json['high24h'] ?? json['high']),
      low24h: ApiJson.asDouble(json['low24h'] ?? json['low']),
      volume24h: ApiJson.asDouble(json['volume24h'] ?? json['volume']),
    );
  }

  final String symbol;
  final double price;
  final double change24h;
  final double high24h;
  final double low24h;
  final double volume24h;

  MarketPair toEntity() => MarketPair(
        symbol: symbol.contains('/') ? symbol : '$symbol/INR',
        price: price,
        changePercent: change24h,
        change24h: change24h,
        volume24h: volume24h,
      );
}

class MarketTickerListModel {
  factory MarketTickerListModel.fromJson(dynamic raw) {
    final rows = ApiJson.list(raw, listKey: 'tickers');
    if (rows.isEmpty) {
      final obj = ApiJson.object(raw);
      if (obj.isNotEmpty) {
        return MarketTickerListModel(items: [MarketTickerModel.fromJson(obj)]);
      }
    }
    return MarketTickerListModel(
      items: rows.map(MarketTickerModel.fromJson).toList(),
    );
  }

  const MarketTickerListModel({required this.items});

  final List<MarketTickerModel> items;

  double? get usdtInrHigh24h {
    for (final t in items) {
      if (t.symbol.contains('USDT') || t.symbol.contains('INR')) return t.high24h;
    }
    return items.isEmpty ? null : items.first.high24h;
  }

  double? get usdtInrLow24h {
    for (final t in items) {
      if (t.symbol.contains('USDT') || t.symbol.contains('INR')) return t.low24h;
    }
    return items.isEmpty ? null : items.first.low24h;
  }
}
