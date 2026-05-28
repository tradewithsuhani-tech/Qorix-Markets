import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/application/session_cleanup.dart';
import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/security/session_guard.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_provider.dart';

/// Keeps [authSessionProvider] in sync when JWT refresh fails — prevents stale authenticated UI.
final authSessionExpirySyncProvider = Provider<void>((ref) {
  if (UiDemoMode.isActive) return;

  final sub = SessionEvents.instance.stream.listen((expired) {
    if (!expired) return;
    SessionCleanup.onLogout(ref.container);
    ref.read(authSessionProvider.notifier).handleSessionExpired();
  });
  ref.onDispose(sub.cancel);
});
