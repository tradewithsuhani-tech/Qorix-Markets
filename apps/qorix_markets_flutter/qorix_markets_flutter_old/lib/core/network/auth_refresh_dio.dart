import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/env_config.dart';
import 'package:qorix_markets_flutter/core/constants/app_constants.dart';

/// Isolated Dio for `/auth/refresh` — no auth interceptor (avoids 401 recursion).
final authRefreshDioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: EnvConfig.authApiBaseUrl,
      connectTimeout: AppConstants.apiTimeout,
      receiveTimeout: AppConstants.apiTimeout,
      sendTimeout: AppConstants.apiTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...EnvConfig.originHeadersFor(EnvConfig.authApiBaseUrl),
      },
    ),
  );
});
