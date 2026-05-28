import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/motion/motion_tokens.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_provider.dart';
import 'package:qorix_markets_flutter/features/onboarding/presentation/providers/onboarding_provider.dart';
import 'package:qorix_markets_flutter/features/splash/presentation/widgets/splash_ui.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';
import 'package:qorix_markets_flutter/widgets/app_background.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  bool _minDelayDone = false;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    final delay = UiDemoMode.isActive
        ? Duration(milliseconds: UiDemoMode.splashDurationMs)
        : const Duration(milliseconds: 2800);
    Future<void>.delayed(delay, () {
      if (mounted) setState(() => _minDelayDone = true);
      _tryNavigate();
    });
  }

  void _tryNavigate() {
    if (_navigated || !_minDelayDone) return;
    if (UiDemoMode.isActive) {
      _navigated = true;
      context.go(UiDemoMode.startOnLogin ? RoutePaths.login : RoutePaths.home);
      return;
    }
    final auth = ref.read(authSessionProvider);
    if (auth.isLoading) return;
    _navigated = true;
    _go(auth);
  }

  Future<void> _go(AuthSessionState auth) async {
    if (!mounted) return;
    if (auth.isAuthenticated) {
      context.go(RoutePaths.home);
      return;
    }
    final done = await ref.read(onboardingCompleteProvider.future);
    if (!mounted) return;
    context.go(done ? RoutePaths.login : RoutePaths.onboarding);
  }

  @override
  Widget build(BuildContext context) {
    if (!UiDemoMode.isActive) {
      ref.listen(authSessionProvider, (_, next) {
        if (!next.isLoading) _tryNavigate();
      });
    }

    return AppBackground(
      glowIntensity: 1.15,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: const SplashInstitutionalBody(),
      ),
    );
  }
}
