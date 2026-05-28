import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/env_config.dart';
import 'package:qorix_markets_flutter/core/constants/api_endpoints.dart';
import 'package:qorix_markets_flutter/core/constants/app_constants.dart';
import 'package:qorix_markets_flutter/core/errors/exceptions.dart';
import 'package:qorix_markets_flutter/core/errors/failures.dart';
import 'package:qorix_markets_flutter/core/infrastructure/device_fingerprint_service.dart';
import 'package:qorix_markets_flutter/core/network/auth_refresh_dio.dart';
import 'package:qorix_markets_flutter/core/network/write_api_policy.dart';
import 'package:qorix_markets_flutter/services/api/auth_interceptor.dart';
import 'package:qorix_markets_flutter/services/api/logging_interceptor.dart';
import 'package:qorix_markets_flutter/services/auth/token_refresh_coordinator.dart';
import 'package:qorix_markets_flutter/services/storage/secure_storage_service.dart';

export 'package:qorix_markets_flutter/core/network/auth_refresh_dio.dart';

/// Central HTTP client — all feature services must route through this layer.
class ApiClient {
  ApiClient(this._dio);

  final Dio _dio;

  Dio get dio => _dio;

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.get<T>(path, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    WriteApiPolicy.guardMutation(path);
    return _dio.post<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    WriteApiPolicy.guardMutation(path);
    return _dio.put<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    WriteApiPolicy.guardMutation(path);
    return _dio.patch<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    WriteApiPolicy.guardMutation(path);
    return _dio.delete<T>(path, data: data, queryParameters: queryParameters, options: options);
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  return _buildApiClient(
    ref,
    baseUrl: EnvConfig.apiBaseUrl,
  );
});

/// Auth client — same `/api/v1` base as reads ([EnvConfig.authApiBaseUrl]).
final authApiClientProvider = Provider<ApiClient>((ref) {
  return _buildApiClient(
    ref,
    baseUrl: EnvConfig.authApiBaseUrl,
  );
});

/// Legacy client — `/api/investment`, `/api/wallet/*`, `/api/deposit/*`, etc.
final legacyApiClientProvider = Provider<ApiClient>((ref) {
  return _buildApiClient(
    ref,
    baseUrl: EnvConfig.legacyApiBaseUrl,
  );
});

ApiClient _buildApiClient(
  Ref ref, {
  required String baseUrl,
}) {
  final storage = ref.watch(secureStorageProvider);
  final fingerprint = ref.watch(deviceFingerprintProvider);
  final refresh = ref.watch(tokenRefreshCoordinatorProvider);

  late Dio dio;
  dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: AppConstants.apiTimeout,
      receiveTimeout: AppConstants.apiTimeout,
      sendTimeout: AppConstants.apiTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...EnvConfig.originHeadersFor(baseUrl),
      },
    ),
  );

  dio.interceptors.addAll([
    AuthInterceptor(
      storage: storage,
      fingerprint: fingerprint,
      refreshCoordinator: refresh,
      dioGetter: () => dio,
    ),
    if (EnvConfig.enableLogging) LoggingInterceptor(),
  ]);

  return ApiClient(dio);
}

/// Legacy alias — prefer [apiClientProvider].
final dioProvider = Provider<Dio>((ref) => ref.watch(apiClientProvider).dio);

Failure mapDioException(DioException e) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.connectionError:
      return const NetworkFailure('Unable to reach QorixMarkets servers');
    case DioExceptionType.badResponse:
      final msg = _extractMessage(e.response?.data);
      final code = e.response?.statusCode;
      if (code == 401) return AuthFailure(msg ?? 'Invalid credentials');
      return ServerFailure(msg ?? 'Request failed ($code)');
    default:
      return ServerFailure(e.message ?? 'Unexpected error');
  }
}

Exception mapDioExceptionToException(DioException e) {
  if (e.error is WriteApiBlockedException) {
    return e.error as WriteApiBlockedException;
  }
  final f = mapDioException(e);
  if (f is NetworkFailure) return NetworkException(f.message);
  if (f is AuthFailure) return AuthException(f.message);
  return ServerException(f.message, statusCode: e.response?.statusCode);
}

String? _extractMessage(dynamic data) {
  if (data is Map) {
    return data['error'] as String? ??
        data['message'] as String? ??
        data['detail'] as String?;
  }
  if (data is String) return data;
  return null;
}
