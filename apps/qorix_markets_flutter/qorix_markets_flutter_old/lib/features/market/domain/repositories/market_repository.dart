import 'package:qorix_markets_flutter/data/models/market_indicators_model.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_insights_entities.dart';
import 'package:qorix_markets_flutter/data/models/markets_balance_model.dart';
import 'package:qorix_markets_flutter/data/models/market_orderbook_model.dart';
import 'package:qorix_markets_flutter/data/models/trade_model.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_pair.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/markets_demo.dart';

abstract interface class MarketRepository {
  Future<({List<MarketPair> pairs, double? high24h, double? low24h})> getTickerSnapshot();
  Future<List<MarketPair>> getTicker();
  Future<MarketOrderBookModel> getOrderBook({String? symbol});
  Future<List<MarketPair>> getTickerFromTrades();
  Future<MarketIndicatorsModel> getPlatformIndicators();
  Future<MarketsBalanceModel> getMarketsBalance();
  Future<List<SpotOrder>> getSpotOrders({required String status});
  Future<SpotOrder> placeSpotOrder({
    required bool isBuy,
    required bool isLimit,
    required double quantity,
    required double price,
  });
  Future<void> cancelSpotOrder(String id);
  Future<MarketInsightsSnapshot> getMarketCalendar({int days = 7});
}
