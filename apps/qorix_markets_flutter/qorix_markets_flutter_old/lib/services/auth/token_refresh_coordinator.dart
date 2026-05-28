import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/auth_refresh_dio.dart';
import 'package:qorix_markets_flutter/core/network/session_revoked.dart';
import 'package:qorix_markets_flutter/core/security/session_guard.dart';
import 'package:qorix_markets_flutter/data/models/auth_response_model.dart';
import 'package:qorix_markets_flutter/services/storage/secure_storage_service.dart';

final tokenRefreshCoordinatorProvider = Provider<TokenRefreshCoordinator>((ref) {
  return TokenRefreshCoordinator(
    ref.watch(secureStorageProvider),
    ref.watch(authRefreshDioProvider),
  );
});

/// Single-flight refresh — concurrent 401s share one `/auth/refresh` call.
class TokenRefreshCoordinator {
  TokenRefreshCoordinator(this._storage, this._refreshDio);

  final SecureStorageService _storage;
  final Dio _refreshDio;

  Future<String?>? _inFlight;

  Future<String?> refreshAccessTokenIfNeeded() {
    return _inFlight ??= _doRefresh().whenComplete(() {
      _inFlight = null;
    });
  }

  Future<String?> _doRefresh() async {
    final refresh = await _storage.getRefreshToken();
    if (refresh == null || refresh.isEmpty) {
      return _storage.getAccessToken();
    }

    try {
      final res = await _refreshDio.post<Map<String, dynamic>>(
        ApiEndpoints.authRefresh,
        data: {'refreshToken': refresh},
      );
      final model = AuthResponseModel.fromJson(res.data ?? {});
      if (model.accessToken.isEmpty) return null;

      await _storage.saveTokens(
        access: model.accessToken,
        refresh: model.refreshToken ?? refresh,
      );
      return model.accessToken;
    } on DioException catch (e) {
      if (isSessionRevokedResponse(e.response?.statusCode, e.response?.data)) {
        await _storage.clearSession();
        SessionEvents.instance.expire();
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}
