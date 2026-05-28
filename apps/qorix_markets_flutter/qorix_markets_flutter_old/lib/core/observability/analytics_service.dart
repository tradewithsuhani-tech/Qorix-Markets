import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/observability/logging_service.dart';

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return AnalyticsService(ref.watch(loggingServiceProvider));
});

class AnalyticsService {
  AnalyticsService(this._log);
  final LoggingService _log;

  void appLaunch() => _log.info('Analytics', 'app_launch');
  void track(String event, [Map<String, Object?>? props]) {
    _log.info('Analytics', '$event $props');
  }
}
