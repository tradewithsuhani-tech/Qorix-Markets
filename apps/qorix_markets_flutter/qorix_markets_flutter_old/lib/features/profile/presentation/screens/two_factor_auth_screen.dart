import 'package:flutter/material.dart';
import 'package:qorix_markets_flutter/core/motion/app_scroll.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:qorix_markets_flutter/core/utils/app_nav.dart';
import 'package:qorix_markets_flutter/core/utils/responsive.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/providers/two_factor_providers.dart';
import 'package:qorix_markets_flutter/features/profile/presentation/widgets/two_factor_ui.dart';

class TwoFactorAuthScreen extends ConsumerStatefulWidget {
  const TwoFactorAuthScreen({super.key});

  @override
  ConsumerState<TwoFactorAuthScreen> createState() => _TwoFactorAuthScreenState();
}

class _TwoFactorAuthScreenState extends ConsumerState<TwoFactorAuthScreen> {
  final _otpKey = GlobalKey<AuthOtpInputState>();
  final _passwordController = TextEditingController();
  String _code = '';
  bool _hidePassword = true;

  @override
  void initState() {
    super.initState();
    _passwordController.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(twoFactorProvider.notifier).resetToEntry();
    });
  }

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  void _handleBack(TwoFactorState state) {
    final notifier = ref.read(twoFactorProvider.notifier);
    switch (state.phase) {
      case TwoFactorPhase.intro:
      case TwoFactorPhase.enabled:
        safePop(context);
      case TwoFactorPhase.setup:
        notifier.goToIntro();
        _resetCode();
      case TwoFactorPhase.disableConfirm:
        notifier.cancelDisable();
        _resetCode();
        _passwordController.clear();
    }
  }

  void _resetCode() {
    _code = '';
    _otpKey.currentState?.clear();
  }

  void _onCodeChanged(String code) {
    ref.read(twoFactorProvider.notifier).clearCodeError();
    setState(() => _code = code);
  }

  Future<void> _showBackupCodes(List<String> codes) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => TwoFactorBackupCodesDialog(codes: codes),
    );
  }

  Future<void> _verifyEnable() async {
    if (_code.length != 6) return;
    final backupCodes = await ref.read(twoFactorProvider.notifier).verifyEnable(_code);
    if (!mounted) return;
    if (backupCodes != null) {
      _resetCode();
      if (backupCodes.isNotEmpty) {
        await _showBackupCodes(backupCodes);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Two-factor authentication enabled'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _verifyDisable() async {
    if (_code.length != 6) return;
    final password = _passwordController.text.trim();
    if (password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Enter your account password to disable 2FA'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final ok = await ref.read(twoFactorProvider.notifier).verifyDisable(
          password: password,
          code: _code,
        );
    if (!mounted) return;
    if (ok) {
      _resetCode();
      _passwordController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Two-factor authentication disabled'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(twoFactorProvider);
    final notifier = ref.read(twoFactorProvider.notifier);
    final canVerify = _code.length == 6;

    if (state.isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0A0E12),
        body: SafeArea(child: Center(child: CircularProgressIndicator())),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E12),
      body: SafeArea(
        bottom: false,
        child: Responsive.constrained(
          context,
          ListView(
            physics: AppScroll.page,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              TwoFactorAppBar(onBack: () => _handleBack(state)),
              const SizedBox(height: 16),
              TwoFactorStatusCard(enabled: state.enabled),
              if (state.errorMessage != null && state.phase != TwoFactorPhase.setup) ...[
                const SizedBox(height: 10),
                TwoFactorErrorBanner(message: state.errorMessage!),
              ],
              const SizedBox(height: 14),
              ...switch (state.phase) {
                TwoFactorPhase.intro => [
                  const TwoFactorSectionLabel('WHY ENABLE'),
                  const TwoFactorWhyEnableCard(),
                  const SizedBox(height: 22),
                  TwoFactorGradientButton(
                    label: 'Enable 2FA',
                    icon: Icons.shield_outlined,
                    enabled: true,
                    loading: state.isSubmitting,
                    onTap: notifier.startEnable,
                  ),
                ],
                TwoFactorPhase.setup => [
                  TwoFactorSetupCard(
                    qrDataUrl: state.qrDataUrl,
                    manualCode: state.manualCode ?? '',
                    accountName: state.accountName,
                    otpKey: _otpKey,
                    codeError: state.codeError,
                    errorMessage: state.errorMessage,
                    onCodeChanged: _onCodeChanged,
                    onCodeCompleted: (_) => _verifyEnable(),
                  ),
                  const SizedBox(height: 22),
                  TwoFactorGradientButton(
                    label: 'Verify & enable',
                    icon: Icons.check_circle_outline_rounded,
                    enabled: canVerify,
                    loading: state.isSubmitting,
                    onTap: _verifyEnable,
                  ),
                ],
                TwoFactorPhase.enabled => [
                  const TwoFactorSectionLabel('ACTIVE PROTECTION'),
                  TwoFactorEnabledDetailsCard(enabledAt: state.enabledAt),
                  const SizedBox(height: 22),
                  TwoFactorOutlineButton(
                    label: 'Disable 2FA',
                    destructive: true,
                    onTap: () {
                      _resetCode();
                      _passwordController.clear();
                      notifier.startDisable();
                    },
                  ),
                ],
                TwoFactorPhase.disableConfirm => [
                  TwoFactorDisableCard(
                    passwordController: _passwordController,
                    hidePassword: _hidePassword,
                    onTogglePasswordVisibility: () => setState(() => _hidePassword = !_hidePassword),
                    otpKey: _otpKey,
                    codeError: state.codeError,
                    errorMessage: state.errorMessage,
                    onCodeChanged: _onCodeChanged,
                  ),
                  const SizedBox(height: 14),
                  TwoFactorGradientButton(
                    label: 'Confirm disable',
                    icon: Icons.remove_circle_outline_rounded,
                    enabled: canVerify && _passwordController.text.trim().isNotEmpty,
                    loading: state.isSubmitting,
                    onTap: _verifyDisable,
                  ),
                  const SizedBox(height: 10),
                  TwoFactorOutlineButton(
                    label: 'Cancel',
                    onTap: () {
                      _resetCode();
                      _passwordController.clear();
                      notifier.cancelDisable();
                    },
                  ),
                ],
              },
            ],
          ),
        ),
      ),
    );
  }
}
