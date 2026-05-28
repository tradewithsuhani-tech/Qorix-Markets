import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final loggingServiceProvider = Provider<LoggingService>((ref) => LoggingService());

class LoggingService {
  void info(String tag, String message) {
    if (kDebugMode) debugPrint('[$tag] $message');
  }

  void error(String tag, String message, [Object? error, StackTrace? stack]) {
    if (kDebugMode) debugPrint('[$tag] $message $error $stack');
  }
}
