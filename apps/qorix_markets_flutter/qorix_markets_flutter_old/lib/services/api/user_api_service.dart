import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/user_profile_model.dart';

final userApiServiceProvider = Provider<UserApiService>((ref) {
  return UserApiService(ref.watch(apiClientProvider));
});

class UserApiService {
  const UserApiService(this._client);
  final ApiClient _client;

  Future<UserProfileModel> getProfile() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.userProfile);
    return UserProfileModel.fromJson(res.data ?? {});
  }
}
