import 'package:dio/dio.dart';

import 'package:qorix_markets_flutter/core/config/env_config.dart';

class LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (EnvConfig.enableLogging) {
      // ignore: avoid_print
      print('[HTTP] ${options.method} ${options.uri}');
    }
    handler.next(options);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    if (EnvConfig.enableLogging) {
      // ignore: avoid_print
      print('[HTTP] ${response.statusCode} ${response.requestOptions.uri}');
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (EnvConfig.enableLogging) {
      final body = err.response?.data;
      // ignore: avoid_print
      print('[HTTP ERROR] ${err.response?.statusCode} ${err.requestOptions.uri} body=$body');
    }
    handler.next(err);
  }
}
