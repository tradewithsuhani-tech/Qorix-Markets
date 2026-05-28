import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// Runtime configuration via `--dart-define` (see README).
///
/// Live spec: https://api.qorixmarkets.com/api/docs
/// - Auth + reads: `https://api.qorixmarkets.com/api/v1`
/// - WS: `wss://api.qorixmarkets.com/ws`
class EnvConfig {
  EnvConfig._();

  static const String apiHost = 'https://api.qorixmarkets.com';
  static const String webAppOrigin = 'https://qorixmarkets.com';
  static const String apiVersionPrefix = '/api/v1';

  static late final String apiBaseUrl;
  static late final String authApiBaseUrl;
  /// Legacy routes mounted at `/api/*` (investment, wallet writes, deposit, security).
  static late final String legacyApiBaseUrl;
  static late final String wsBaseUrl;
  static late final String env;
  static late final bool enableLogging;
  static late final bool enableDevAuthFallback;
  static late final bool enablePushNotifications;
  static late final Duration marketPollInterval;
  static late final String platformHeader;

  static Future<void> initialize() async {
    env = const String.fromEnvironment('ENV', defaultValue: 'staging');
    platformHeader = _resolvePlatformHeader();

    switch (env) {
      case 'development':
        apiBaseUrl = const String.fromEnvironment(
          'API_BASE_URL',
          defaultValue: 'http://10.0.2.2:3000$apiVersionPrefix',
        );
        authApiBaseUrl = const String.fromEnvironment(
          'AUTH_API_BASE_URL',
          defaultValue: 'http://10.0.2.2:3000$apiVersionPrefix',
        );
        legacyApiBaseUrl = const String.fromEnvironment(
          'LEGACY_API_BASE_URL',
          defaultValue: 'http://10.0.2.2:3000/api',
        );
        wsBaseUrl = const String.fromEnvironment(
          'WS_BASE_URL',
          defaultValue: 'ws://10.0.2.2:3000/ws',
        );
        enableLogging = true;
        enableDevAuthFallback = true;
        enablePushNotifications = false;
        marketPollInterval = const Duration(seconds: 5);
      case 'staging':
      default: // production — same live API host; logging differs below
        apiBaseUrl = const String.fromEnvironment(
          'API_BASE_URL',
          defaultValue: '$apiHost$apiVersionPrefix',
        );
        authApiBaseUrl = const String.fromEnvironment(
          'AUTH_API_BASE_URL',
          defaultValue: '$apiHost$apiVersionPrefix',
        );
        legacyApiBaseUrl = const String.fromEnvironment(
          'LEGACY_API_BASE_URL',
          defaultValue: '$apiHost/api',
        );
        wsBaseUrl = const String.fromEnvironment(
          'WS_BASE_URL',
          defaultValue: 'wss://api.qorixmarkets.com/ws',
        );
        enableLogging = env == 'staging' ||
            const bool.fromEnvironment('ENABLE_API_LOGS', defaultValue: false);
        enableDevAuthFallback = false;
        enablePushNotifications = env == 'production' &&
            const bool.fromEnvironment('ENABLE_PUSH', defaultValue: false);
        marketPollInterval =
            env == 'production' ? const Duration(seconds: 10) : const Duration(seconds: 8);
    }
  }

  static String _resolvePlatformHeader() {
    if (kIsWeb) return 'web';
    try {
      if (Platform.isIOS) return 'ios';
      if (Platform.isAndroid) return 'android';
    } catch (_) {}
    return 'mobile';
  }

  static bool get isProduction => env == 'production';
  static bool get isStaging => env == 'staging';
  static bool get isDevelopment => env == 'development';

  /// Live API rejects requests without a trusted web origin (`ORIGIN_REQUIRED`).
  static Map<String, String> originHeadersFor(String baseUrl) {
    if (!baseUrl.contains('qorixmarkets.com')) return const {};
    return {
      'Origin': webAppOrigin,
      'Referer': '$webAppOrigin/',
    };
  }

  static const String appDisplayName = 'QorixMarkets';
}
