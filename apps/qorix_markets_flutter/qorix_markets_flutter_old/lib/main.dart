import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/app.dart';
import 'package:qorix_markets_flutter/core/config/env_config.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/observability/analytics_service.dart';
import 'package:qorix_markets_flutter/core/observability/crash_reporting_service.dart';
import 'package:qorix_markets_flutter/core/observability/logging_service.dart';
import 'package:qorix_markets_flutter/services/notifications/push_notification_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EnvConfig.initialize();

  final container = ProviderContainer();
  final log = container.read(loggingServiceProvider);
  final crash = container.read(crashReportingServiceProvider);

  FlutterError.onError = (details) {
    log.error('FlutterError', details.exceptionAsString(), details.exception, details.stack);
    crash.recordError(details.exception, details.stack ?? StackTrace.current, context: 'flutter');
    if (kDebugMode) FlutterError.presentError(details);
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    log.error('PlatformDispatcher', error.toString(), error, stack);
    crash.recordError(error, stack, context: 'platform');
    return true;
  };

  if (UiDemoMode.usesLiveApi) {
    await container.read(pushNotificationServiceProvider).initialize();
    await crash.initialize();
    container.read(analyticsServiceProvider).appLaunch();
  }

  log.info(
    'App',
    'Launch env=${EnvConfig.env} read=${EnvConfig.apiBaseUrl} auth=${EnvConfig.authApiBaseUrl} ws=${EnvConfig.wsBaseUrl} uiDemo=${UiDemoMode.isActive} readOnly=${UiDemoMode.readOnlyApi}',
  );

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const QorixMarketsApp(),
    ),
  );
}
