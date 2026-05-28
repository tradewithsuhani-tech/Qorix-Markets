import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/bot_model.dart';

final botsApiServiceProvider = Provider<BotsApiService>((ref) {
  return BotsApiService(ref.watch(apiClientProvider));
});

class BotsApiService {
  const BotsApiService(this._client);
  final ApiClient _client;

  Future<BotListModel> getBotsList() async {
    final res = await _client.get<dynamic>(ApiEndpoints.botsList);
    return BotListModel.fromJson(res.data);
  }

  Future<BotPerformanceModel> getBotsPerformance() async {
    final res = await _client.get<dynamic>(ApiEndpoints.botsPerformance);
    return BotPerformanceModel.fromJson(res.data);
  }
}
