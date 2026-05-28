import 'package:flutter_riverpod/flutter_riverpod.dart';

final crashReportingServiceProvider = Provider<CrashReportingService>((ref) => CrashReportingService());

class CrashReportingService {
  Future<void> initialize() async {}

  void recordError(Object error, StackTrace stack, {String? context}) {}
}
