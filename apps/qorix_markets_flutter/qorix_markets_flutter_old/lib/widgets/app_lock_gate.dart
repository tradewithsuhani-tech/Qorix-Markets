import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/security/app_lock_provider.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_provider.dart';
import 'package:qorix_markets_flutter/features/security/presentation/widgets/app_lock_gate_overlay.dart';
import 'package:qorix_markets_flutter/routes/app_router.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

/// Wraps the app and shows lock overlay on resume / cold start when app lock is active.
class AppLockGate extends ConsumerStatefulWidget {
  const AppLockGate({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends ConsumerState<AppLockGate> with WidgetsBindingObserver {
  bool _wasBackgrounded = false;

  static const _skipLockRoutes = {
    RoutePaths.splash,
    RoutePaths.login,
    RoutePaths.register,
    RoutePaths.forgotPassword,
    RoutePaths.onboarding,
    RoutePaths.otp,
    RoutePaths.appLockSetup,
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _wasBackgrounded = true;
    }
    if (state == AppLifecycleState.resumed && _wasBackgrounded) {
      _wasBackgrounded = false;
      _lockIfNeeded();
    }
  }

  void _lockIfNeeded() {
    final lock = ref.read(appLockProvider);
    if (!lock.isActive || lock.isLocked) return;
    if (!_shouldProtectCurrentRoute()) return;
    ref.read(appLockProvider.notifier).lockIfActive();
  }

  bool _shouldProtectCurrentRoute() {
    // Builder context sits above [GoRouter] — read router from provider instead.
    final path = ref.read(appRouterProvider).routerDelegate.currentConfiguration.uri.path;
    if (_skipLockRoutes.contains(path)) return false;

    if (UiDemoMode.isActive) {
      return path != RoutePaths.login && path != RoutePaths.splash;
    }

    return ref.read(authSessionProvider).isAuthenticated;
  }

  bool _shouldShowOverlay() {
    final lock = ref.watch(appLockProvider);
    if (!lock.initialized || !lock.isLocked || !lock.isActive) return false;
    return _shouldProtectCurrentRoute();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authSessionProvider, (prev, next) {
      if (prev?.isAuthenticated == true && !next.isAuthenticated) {
        ref.read(appLockProvider.notifier).unlockSession();
      }
      if (prev != null && !prev.isAuthenticated && next.isAuthenticated && ref.read(appLockProvider).isActive) {
        ref.read(appLockProvider.notifier).unlockSession();
      }
    });

    final showLock = _shouldShowOverlay();

    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (showLock) const AppLockGateOverlay(),
      ],
    );
  }
}
