import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/dashboard_summary_model.dart';

final dashboardApiServiceProvider = Provider<DashboardApiService>((ref) {
  return DashboardApiService(
    ref.watch(apiClientProvider),
    ref.watch(legacyApiClientProvider),
  );
});

class DashboardApiService {
  const DashboardApiService(this._v1, this._legacy);
  final ApiClient _v1;
  final ApiClient _legacy;

  Future<DashboardSummaryModel> getSummary() async {
    final res = await _v1.get<Map<String, dynamic>>(ApiEndpoints.portfolioSummary);
    return DashboardSummaryModel.fromJson(res.data ?? {});
  }

  Future<List<EquityPointModel>> getEquityChart({int days = 30}) async {
    final res = await _legacy.get<dynamic>(
      ApiEndpoints.dashboardEquityChart,
      queryParameters: {'days': days},
    );
    final list = res.data is List ? res.data as List : const [];
    return list
        .whereType<Map>()
        .map((e) => EquityPointModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<FundStatsModel?> getFundStats() async {
    try {
      final res = await _legacy.get<Map<String, dynamic>>(ApiEndpoints.dashboardFundStats);
      return FundStatsModel.fromJson(res.data ?? {});
    } catch (_) {
      return null;
    }
  }
}
