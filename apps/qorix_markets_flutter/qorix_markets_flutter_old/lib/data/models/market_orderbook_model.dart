import 'package:qorix_markets_flutter/core/network/api_json.dart';

class OrderBookLevelModel {
  const OrderBookLevelModel({required this.price, required this.amount});

  factory OrderBookLevelModel.fromJson(Map<String, dynamic> json) {
    return OrderBookLevelModel(
      price: ApiJson.asDouble(json['price'] ?? json[0]),
      amount: ApiJson.asDouble(json['amount'] ?? json['size'] ?? json['quantity'] ?? json[1]),
    );
  }

  factory OrderBookLevelModel.fromList(List<dynamic> row) {
    if (row.length < 2) return const OrderBookLevelModel(price: 0, amount: 0);
    return OrderBookLevelModel(
      price: ApiJson.asDouble(row[0]),
      amount: ApiJson.asDouble(row[1]),
    );
  }

  final double price;
  final double amount;
}

class MarketOrderBookModel {
  const MarketOrderBookModel({required this.bids, required this.asks, this.symbol, this.midPrice});

  factory MarketOrderBookModel.fromJson(dynamic raw) {
    final map = ApiJson.object(raw);
    return MarketOrderBookModel(
      symbol: map['symbol'] as String? ?? map['pair'] as String?,
      midPrice: ApiJson.asDouble(map['midPrice'] ?? map['price'], fallback: 0),
      bids: _levels(map['bids']),
      asks: _levels(map['asks']),
    );
  }

  final String? symbol;
  final double? midPrice;
  final List<OrderBookLevelModel> bids;
  final List<OrderBookLevelModel> asks;

  static List<OrderBookLevelModel> _levels(dynamic raw) {
    if (raw is! List) return const [];
    return raw.map((e) {
      if (e is List) return OrderBookLevelModel.fromList(e);
      if (e is Map) return OrderBookLevelModel.fromJson(Map<String, dynamic>.from(e));
      return const OrderBookLevelModel(price: 0, amount: 0);
    }).where((l) => l.price > 0).toList();
  }
}
