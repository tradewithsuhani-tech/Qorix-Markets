import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/investment_model.dart';
import 'package:qorix_markets_flutter/data/models/trade_model.dart';

final investmentApiServiceProvider = Provider<InvestmentApiService>((ref) {
  return InvestmentApiService(ref.watch(legacyApiClientProvider));
});

/// Investment reads/writes via `/api/investment/*` ([EnvConfig.legacyApiBaseUrl]).
class InvestmentApiService {
  const InvestmentApiService(this._client);
  final ApiClient _client;

  Future<InvestmentModel> getInvestment() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.investment);
    return InvestmentModel.fromJson(res.data ?? {});
  }

  Future<InvestmentModel> startInvestment({
    required double amount,
    required String riskLevel,
  }) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.investmentStart,
      data: {
        'amount': amount,
        'riskLevel': _apiRiskLevel(riskLevel),
      },
    );
    return InvestmentModel.fromJson(res.data ?? {});
  }

  Future<InvestmentModel> stopInvestment() async {
    final res = await _client.post<Map<String, dynamic>>(ApiEndpoints.investmentStop);
    return InvestmentModel.fromJson(res.data ?? {});
  }

  Future<InvestmentModel> updateProtection({required double drawdownLimit}) async {
    final res = await _client.patch<Map<String, dynamic>>(
      ApiEndpoints.investmentProtection,
      data: {'drawdownLimit': drawdownLimit},
    );
    return InvestmentModel.fromJson(res.data ?? {});
  }

  Future<InvestmentModel> updateCompounding({required bool autoCompound}) async {
    final res = await _client.patch<Map<String, dynamic>>(
      ApiEndpoints.investmentCompounding,
      data: {'autoCompound': autoCompound},
    );
    return InvestmentModel.fromJson(res.data ?? {});
  }

  Future<InvestmentModel> topup({required double amount}) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.investmentTopup,
      data: {'amount': amount},
    );
    return InvestmentModel.fromJson(res.data ?? {});
  }

  Future<InvestmentModel> queueRiskLevelChange({required String riskLevel}) async {
    final res = await _client.patch<Map<String, dynamic>>(
      ApiEndpoints.investmentRiskLevel,
      data: {'riskLevel': _apiRiskLevel(riskLevel)},
    );
    return InvestmentModel.fromJson(res.data ?? {});
  }

  Future<InvestmentModel> cancelRiskLevelChange() async {
    final res = await _client.delete<Map<String, dynamic>>(ApiEndpoints.investmentRiskLevel);
    return InvestmentModel.fromJson(res.data ?? {});
  }

  Future<List<TradeModel>> getTrades({int page = 1, int limit = 20}) async {
    final res = await _client.get<dynamic>(
      ApiEndpoints.investmentTrades,
      queryParameters: {'page': page, 'limit': limit},
    );
    return ApiJson.list(res.data).map(TradeModel.fromJson).toList();
  }

  static String _apiRiskLevel(String riskLevel) => riskLevel.trim().toLowerCase();
}
