import 'package:dio/dio.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/network/session_revoked.dart';
import 'package:qorix_markets_flutter/core/security/auth_token_guard.dart';
import 'package:qorix_markets_flutter/core/security/session_guard.dart';
import 'package:qorix_markets_flutter/features/auth/dev/dev_auth.dart';
import 'package:qorix_markets_flutter/services/auth/token_refresh_coordinator.dart';
import 'package:qorix_markets_flutter/core/infrastructure/device_fingerprint_service.dart';
import 'package:qorix_markets_flutter/services/storage/secure_storage_service.dart';

/// Attaches JWT + device headers. Handles 401 with refresh + single retry.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required SecureStorageService storage,
    required TokenRefreshCoordinator refreshCoordinator,
    required Dio Function() dioGetter,
    DeviceFingerprintService? fingerprint,
  })  : _storage = storage,
        _refresh = refreshCoordinator,
        _dioGetter = dioGetter,
        _fingerprint = fingerprint;

  final SecureStorageService _storage;
  final TokenRefreshCoordinator _refresh;
  final Dio Function() _dioGetter;
  final DeviceFingerprintService? _fingerprint;
  bool _clearingSession = false;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (UiDemoMode.isActive || (DevAuth.isActive && DevAuth.bypassEnabled)) {
      handler.next(options);
      return;
    }

    // Mobile headers on every request (origin-guard + captcha bypass on server).
    if (_fingerprint != null) {
      options.headers.addAll(await _fingerprint!.headers());
    }

    // Never attach a stale JWT to pre-login auth — causes 401 on Google/forgot flows.
    if (!_isAuthBootstrap(options.path)) {
      final token = await _readAccessToken();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  Future<String?> _readAccessToken() async {
    var token = await _storage.getAccessToken();
    if (token != null && token.isNotEmpty) return token;
    return _refresh.refreshAccessTokenIfNeeded();
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (UiDemoMode.isActive || (DevAuth.isActive && DevAuth.bypassEnabled)) {
      handler.next(err);
      return;
    }

    if (isSessionRevokedResponse(err.response?.statusCode, err.response?.data)) {
      if (!AuthTokenGuard.isInLoginGrace) {
        await _clearSessionOnce();
      }
      handler.next(err);
      return;
    }

    final bootstrap = _isAuthBootstrap(err.requestOptions.path);
    if (!bootstrap &&
        err.response?.statusCode == 401 &&
        err.requestOptions.extra['retried'] != true) {
      final refreshed = await _readAccessToken();
      if (refreshed != null && refreshed.isNotEmpty) {
        err.requestOptions.headers['Authorization'] = 'Bearer $refreshed';
        err.requestOptions.extra['retried'] = true;
        try {
          final clone = await _dioGetter().fetch(err.requestOptions);
          handler.resolve(clone);
          return;
        } catch (_) {}
      }
      if (!AuthTokenGuard.isInLoginGrace) {
        await _clearSessionOnce();
      }
    }
    handler.next(err);
  }

  bool _isAuthBootstrap(String path) {
    return path.contains(ApiEndpoints.login) ||
        path.contains(ApiEndpoints.register) ||
        path.contains(ApiEndpoints.verifyEmailPublic) ||
        path.contains(ApiEndpoints.resendVerification) ||
        path.contains(ApiEndpoints.authRefresh) ||
        path.contains(ApiEndpoints.authGoogleMobile) ||
        path.contains(ApiEndpoints.forgotPassword) ||
        path.contains(ApiEndpoints.verifyResetOtp) ||
        path.contains(ApiEndpoints.resetPassword) ||
        _isUnauthenticatedLoginAttempt(path);
  }

  /// Poll / OTP fallback on the new device — no Bearer yet.
  static bool _isUnauthenticatedLoginAttempt(String path) {
    if (!path.contains('/auth/login-attempts/')) return false;
    return path.endsWith('/status') ||
        path.endsWith('/request-otp') ||
        path.endsWith('/verify-otp');
  }

  Future<void> _clearSessionOnce() async {
    if (_clearingSession) return;
    _clearingSession = true;
    try {
      await _storage.clearSession();
      SessionEvents.instance.expire();
    } finally {
      _clearingSession = false;
    }
  }
}
