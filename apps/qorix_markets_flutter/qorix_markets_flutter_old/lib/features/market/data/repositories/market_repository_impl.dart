import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/market_indicators_model.dart';
import 'package:qorix_markets_flutter/data/models/markets_balance_model.dart';
import 'package:qorix_markets_flutter/data/models/market_orderbook_model.dart';
import 'package:qorix_markets_flutter/data/models/trade_model.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_insights_entities.dart';
import 'package:qorix_markets_flutter/features/market/domain/entities/market_pair.dart';
import 'package:qorix_markets_flutter/features/market/domain/repositories/market_repository.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/market_insights_demo.dart';
import 'package:qorix_markets_flutter/features/market/presentation/data/markets_demo.dart';
import 'package:qorix_markets_flutter/services/api/market_api_service.dart';

final marketRepositoryProvider = Provider<MarketRepository>((ref) {
  return MarketRepositoryImpl(ref.watch(marketApiServiceProvider));
});

class MarketRepositoryImpl implements MarketRepository {
  MarketRepositoryImpl(this._api);

  final MarketApiService _api;

  @override
  Future<({List<MarketPair> pairs, double? high24h, double? low24h})> getTickerSnapshot() async {
    try {
      final ticker = await _api.getTicker();
      if (ticker.items.isEmpty) {
        final fallback = await getTickerFromTrades();
        return (pairs: fallback, high24h: null, low24h: null);
      }
      return (
        pairs: ticker.items.map((t) => t.toEntity()).toList(),
        high24h: ticker.usdtInrHigh24h,
        low24h: ticker.usdtInrLow24h,
      );
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<MarketPair>> getTicker() async {
    final snap = await getTickerSnapshot();
    return snap.pairs;
  }

  @override
  Future<MarketOrderBookModel> getOrderBook({String? symbol}) async {
    try {
      return await _api.getOrderBook(symbol: symbol);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<MarketPair>> getTickerFromTrades() async {
    try {
      final trades = await _api.getRecentTrades(limit: 50);
      if (trades.isEmpty) return [];

      final latestBySymbol = <String, TradeModel>{};
      for (final t in trades) {
        final key = t.symbol.contains('/') ? t.symbol : '${t.symbol}/USDT';
        latestBySymbol.putIfAbsent(key, () => t);
      }

      return latestBySymbol.values.map((t) => t.toMarketPair()).toList();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<MarketIndicatorsModel> getPlatformIndicators() async {
    try {
      return await _api.getMarketIndicators();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<MarketsBalanceModel> getMarketsBalance() async {
    if (UiDemoMode.isActive) {
      return const MarketsBalanceModel(inrBalance: 50000, usdtBalance: 1250);
    }
    try {
      return await _api.getMarketsBalance();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<List<SpotOrder>> getSpotOrders({required String status}) async {
    if (UiDemoMode.isActive) {
      if (status == 'open') return MarketsDemo.initialOpenOrders(MarketsDemo.baseInr);
      return List<SpotOrder>.from(MarketsDemo.orderHistory);
    }
    try {
      final models = await _api.getOrders(status: status);
      return models.map((m) => m.toEntity()).toList();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<SpotOrder> placeSpotOrder({
    required bool isBuy,
    required bool isLimit,
    required double quantity,
    required double price,
  }) async {
    if (UiDemoMode.blocksWriteApi) {
      return SpotOrder(
        id: MarketsDemo.nextOrderId(isLimit ? 'OX' : 'HX'),
        isBuy: isBuy,
        isLimit: isLimit,
        price: price,
        amount: quantity,
        status: isLimit ? SpotOrderStatus.open : SpotOrderStatus.filled,
        createdAt: DateTime.now(),
        filledPrice: isLimit ? null : price,
        timeLabel: 'Just now',
      );
    }
    try {
      final model = await _api.placeOrder(
        side: isBuy ? 'BUY' : 'SELL',
        type: isLimit ? 'LIMIT' : 'MARKET',
        quantity: quantity,
        price: isLimit ? price : null,
      );
      return model.toEntity();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<void> cancelSpotOrder(String id) async {
    if (UiDemoMode.blocksWriteApi) return;
    try {
      await _api.cancelOrder(id);
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }

  @override
  Future<MarketInsightsSnapshot> getMarketCalendar({int days = 7}) async {
    if (UiDemoMode.isActive) return MarketInsightsDemo.snapshot();
    try {
      final model = await _api.getCalendar(days: days);
      return model.toSnapshot();
    } on DioException catch (e) {
      throw mapDioExceptionToException(e);
    }
  }
}
