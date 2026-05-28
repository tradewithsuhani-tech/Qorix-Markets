import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/profit_history_model.dart';

final portfolioApiServiceProvider = Provider<PortfolioApiService>((ref) {
  return PortfolioApiService(ref.watch(apiClientProvider));
});

class PortfolioApiService {
  const PortfolioApiService(this._client);
  final ApiClient _client;

  Future<ProfitHistoryListModel> getProfitHistory({int page = 1, int limit = 20}) async {
    final res = await _client.get<Map<String, dynamic>>(
      ApiEndpoints.profitHistory,
      queryParameters: {
        'page': page,
        'limit': limit.clamp(1, 50),
      },
    );
    return ProfitHistoryListModel.fromJson(res.data ?? {});
  }
}
