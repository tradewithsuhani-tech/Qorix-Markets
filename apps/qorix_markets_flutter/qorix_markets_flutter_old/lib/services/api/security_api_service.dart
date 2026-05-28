import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/api_client.dart';
import 'package:qorix_markets_flutter/data/models/security_models.dart';

final securityApiServiceProvider = Provider<SecurityApiService>((ref) {
  return SecurityApiService(ref.watch(legacyApiClientProvider));
});

/// Profile security writes + reads via `/api` (not `/api/v1`).
class SecurityApiService {
  const SecurityApiService(this._client);
  final ApiClient _client;

  Future<SecurityStatusModel> getSecurityStatus() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.authSecurityStatus);
    return SecurityStatusModel.fromJson(res.data ?? {});
  }

  Future<ChangePasswordResult> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.authChangePassword,
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
    return ChangePasswordResult.fromJson(res.data ?? {});
  }

  Future<TwoFactorStatusModel> get2faStatus() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.security2faStatus);
    return TwoFactorStatusModel.fromJson(res.data ?? {});
  }

  Future<TwoFactorSetupModel> setup2fa() async {
    final res = await _client.post<Map<String, dynamic>>(ApiEndpoints.security2faSetup);
    return TwoFactorSetupModel.fromJson(res.data ?? {});
  }

  Future<TwoFactorVerifySetupResult> verify2faSetup(String code) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.security2faVerifySetup,
      data: {'code': code.trim()},
    );
    return TwoFactorVerifySetupResult.fromJson(res.data ?? {});
  }

  Future<void> disable2fa({required String password, required String code}) async {
    await _client.post(
      ApiEndpoints.security2faDisable,
      data: {
        'password': password,
        'code': code.trim(),
      },
    );
  }

  Future<DevicesListModel> getDevices() async {
    final res = await _client.get<Map<String, dynamic>>(ApiEndpoints.devices);
    return DevicesListModel.fromJson(res.data ?? {});
  }

  Future<void> revokeSession(String sessionId) async {
    await _client.delete(ApiEndpoints.authSession(sessionId));
  }

  Future<void> revokeOtherSessions() async {
    await _client.delete(ApiEndpoints.authSessionsOthers);
  }
}
