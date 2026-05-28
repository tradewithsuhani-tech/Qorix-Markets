import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/market_calendar_model.dart';
import 'package:qorix_markets_flutter/data/models/market_indicators_model.dart';
import 'package:qorix_markets_flutter/data/models/markets_balance_model.dart';
import 'package:qorix_markets_flutter/data/models/market_orderbook_model.dart';
import 'package:qorix_markets_flutter/data/models/market_ticker_model.dart';
import 'package:qorix_markets_flutter/data/models/spot_order_model.dart';
import 'package:qorix_markets_flutter/data/models/trade_model.dart';

final marketApiServiceProvider = Provider<MarketApiService>((ref) {
  return MarketApiService(
    ref.watch(apiClientProvider),
    ref.watch(legacyApiClientProvider),
  );
});

class MarketApiService {
  const MarketApiService(this._v1, this._legacy);
  final ApiClient _v1;
  final ApiClient _legacy;

  Future<MarketTickerListModel> getTicker() async {
    final res = await _v1.get<dynamic>(ApiEndpoints.marketsTicker);
    return MarketTickerListModel.fromJson(res.data);
  }

  Future<MarketOrderBookModel> getOrderBook({String? symbol}) async {
    final res = await _v1.get<dynamic>(
      ApiEndpoints.marketsOrderbook,
      queryParameters: {
        if (symbol != null) 'symbol': symbol,
      },
    );
    return MarketOrderBookModel.fromJson(res.data);
  }

  Future<MarketIndicatorsModel> getMarketIndicators() async {
    final res = await _legacy.get<Map<String, dynamic>>(ApiEndpoints.marketIndicators);
    return MarketIndicatorsModel.fromJson(res.data ?? {});
  }

  /// Legacy fallback when ticker endpoint is unavailable.
  Future<List<TradeModel>> getRecentTrades({int limit = 50}) async {
    final res = await _legacy.get<List<dynamic>>(
      ApiEndpoints.trades,
      queryParameters: {'limit': limit},
    );
    final list = res.data ?? [];
    return list.map((e) => TradeModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<MarketsBalanceModel> getMarketsBalance() async {
    final res = await _v1.get<Map<String, dynamic>>(ApiEndpoints.marketsBalance);
    return MarketsBalanceModel.fromJson(res.data ?? {});
  }

  Future<List<SpotOrderModel>> getOrders({
    String status = 'all',
    int page = 1,
    int limit = 50,
  }) async {
    final res = await _v1.get<dynamic>(
      ApiEndpoints.marketsOrders,
      queryParameters: {
        'status': status,
        'page': page,
        'limit': limit,
      },
    );
    return parseSpotOrdersList(res.data);
  }

  Future<SpotOrderModel> placeOrder({
    required String side,
    required String type,
    required double quantity,
    double? price,
  }) async {
    final res = await _v1.post<Map<String, dynamic>>(
      ApiEndpoints.marketsOrders,
      data: {
        'side': side.toUpperCase(),
        'type': type.toUpperCase(),
        'quantity': quantity,
        if (price != null) 'price': price,
      },
    );
    return parseSpotOrderResponse(res.data ?? {});
  }

  Future<void> cancelOrder(String id) async {
    await _v1.delete(ApiEndpoints.marketsOrder(id));
  }

  Future<MarketCalendarModel> getCalendar({int days = 7}) async {
    final res = await _v1.get<Map<String, dynamic>>(
      ApiEndpoints.marketsCalendar,
      queryParameters: {'days': days.clamp(1, 14)},
    );
    return MarketCalendarModel.fromJson(res.data ?? {});
  }
}
