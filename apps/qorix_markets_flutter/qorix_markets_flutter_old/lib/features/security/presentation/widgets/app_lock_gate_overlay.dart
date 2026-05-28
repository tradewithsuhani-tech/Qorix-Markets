import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/security/app_lock_provider.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_controller.dart';
import 'package:qorix_markets_flutter/features/security/presentation/widgets/app_lock_ui.dart';
import 'package:qorix_markets_flutter/routes/app_router.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

/// Full-screen lock gate shown over the app when PIN/biometric unlock is required.
class AppLockGateOverlay extends ConsumerStatefulWidget {
  const AppLockGateOverlay({super.key});

  @override
  ConsumerState<AppLockGateOverlay> createState() => _AppLockGateOverlayState();
}

class _AppLockGateOverlayState extends ConsumerState<AppLockGateOverlay> {
  String _pin = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryBiometric());
  }

  Future<void> _tryBiometric() async {
    await ref.read(appLockProvider.notifier).unlockWithBiometric(silent: true);
  }

  void _addDigit(String d) {
    if (_pin.length >= 6) return;
    setState(() => _pin += d);
    if (_pin.length == 6) _submit();
  }

  void _backspace() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _submit() async {
    final ok = await ref.read(appLockProvider.notifier).unlockWithPin(_pin);
    if (!mounted) return;
    if (ok) {
      setState(() => _pin = '');
      return;
    }
    final state = ref.read(appLockProvider);
    if (state.failedAttempts >= AppLockNotifier.maxAttempts) {
      await _signInAgain();
      return;
    }
    setState(() => _pin = '');
  }

  Future<void> _signInAgain() async {
    await ref.read(authControllerProvider.notifier).logout();
    if (!mounted) return;
    ref.read(appRouterProvider).go(RoutePaths.login);
  }

  @override
  Widget build(BuildContext context) {
    final lock = ref.watch(appLockProvider);

    return AppLockOverlay(
      pin: _pin,
      onDigit: _addDigit,
      onBackspace: _backspace,
      onBiometric: () => ref.read(appLockProvider.notifier).unlockWithBiometric(),
      biometricEnabled: lock.biometricEnabled,
      biometricLabel: lock.biometricLabel,
      errorMessage: lock.errorMessage,
      failedAttempts: lock.failedAttempts,
      onForgotPin: _signInAgain,
    );
  }
}
