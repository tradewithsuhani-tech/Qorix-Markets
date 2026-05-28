import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/core/network/api_json.dart';
import 'package:qorix_markets_flutter/data/models/referral_models.dart';

final referralApiServiceProvider = Provider<ReferralApiService>((ref) {
  return ReferralApiService(ref.watch(legacyApiClientProvider));
});

class ReferralApiService {
  const ReferralApiService(this._client);
  final ApiClient _client;

  Future<ReferralSummaryModel> getSummary() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.referral);
    return ReferralSummaryModel.fromJson(ApiJson.object(res.data));
  }

  Future<List<ReferredUserModel>> getReferredUsers({int page = 1, int limit = 50}) async {
    final res = await _client.get<dynamic>(
      ApiEndpoints.referralReferredUsers,
      queryParameters: {'page': page, 'limit': limit},
    );
    return ApiJson.list(res.data).map((e) => ReferredUserModel.fromJson(ApiJson.object(e))).toList();
  }
}
