import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/broker_models.dart';

final brokerApiServiceProvider = Provider<BrokerApiService>((ref) {
  return BrokerApiService(ref.watch(apiClientProvider));
});

class BrokerApiService {
  const BrokerApiService(this._client);

  final ApiClient _client;

  Future<BrokerStatusModel> getStatus() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.brokerStatus);
    return BrokerStatusModel.fromJson(ApiJson.object(res.data));
  }

  Future<BrokerStatusModel> setMode(BrokerTradingMode mode) async {
    final res = await _client.put<Map<String, dynamic>>(
      ApiEndpoints.brokerMode,
      data: {'mode': mode == BrokerTradingMode.live ? 'live' : 'demo'},
    );
    return BrokerStatusModel.fromJson(ApiJson.object(res.data));
  }

  Future<BrokerLoginUrlModel> getZerodhaLoginUrl() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.brokerZerodhaLoginUrl);
    return BrokerLoginUrlModel.fromJson(ApiJson.object(res.data));
  }

  Future<BrokerStatusModel> connectZerodha({required String requestToken}) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.brokerZerodhaSession,
      data: {'requestToken': requestToken},
    );
    return BrokerStatusModel.fromJson(ApiJson.object(res.data));
  }

  Future<BrokerStatusModel> disconnectZerodha() async {
    final res = await _client.delete<Map<String, dynamic>>(ApiEndpoints.brokerZerodhaDisconnect);
    return BrokerStatusModel.fromJson(ApiJson.object(res.data));
  }

  Future<BrokerProfileModel> getProfile() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.brokerProfile);
    return BrokerProfileModel.fromJson(ApiJson.object(res.data));
  }

  Future<List<BrokerHoldingModel>> getHoldings() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.brokerHoldings);
    return ApiJson.list(res.data, listKey: 'items').map(BrokerHoldingModel.fromJson).toList();
  }

  Future<List<BrokerPositionModel>> getPositions() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.brokerPositions);
    return ApiJson.list(res.data, listKey: 'items').map(BrokerPositionModel.fromJson).toList();
  }

  Future<BrokerFundsModel> getFunds() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.brokerFunds);
    return BrokerFundsModel.fromJson(ApiJson.object(res.data));
  }

  Future<List<BrokerQuoteModel>> getQuotes(List<String> symbols) async {
    final res = await _client.get<Map<String, dynamic>>(
      ApiEndpoints.brokerQuotes,
      queryParameters: {'symbols': symbols.join(',')},
    );
    return ApiJson.list(res.data, listKey: 'items').map(BrokerQuoteModel.fromJson).toList();
  }

  Future<BrokerDemoOrderModel> placeDemoOrder({
    required String symbol,
    required String side,
    required int quantity,
    double? price,
  }) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.brokerDemoOrder,
      data: {
        'symbol': symbol,
        'side': side,
        'quantity': quantity,
        if (price != null) 'price': price,
      },
    );
    final data = ApiJson.object(res.data);
    final order = data['order'] is Map ? Map<String, dynamic>.from(data['order'] as Map) : data;
    return BrokerDemoOrderModel.fromJson(order);
  }

  Future<void> resetDemoPortfolio() async {
    await _client.post(ApiEndpoints.brokerDemoReset);
  }
}
