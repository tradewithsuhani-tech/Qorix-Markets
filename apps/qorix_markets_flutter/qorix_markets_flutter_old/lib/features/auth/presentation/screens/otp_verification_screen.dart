import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:qorix_markets_flutter/core/config/ui_demo_mode.dart';
import 'package:qorix_markets_flutter/core/theme/app_colors.dart';
import 'package:qorix_markets_flutter/core/theme/app_spacing.dart';
import 'package:qorix_markets_flutter/core/theme/desk_theme.dart';
import 'package:qorix_markets_flutter/core/utils/error_message.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_controller.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/providers/auth_session_provider.dart';
import 'package:qorix_markets_flutter/features/auth/presentation/widgets/auth_ui.dart';
import 'package:qorix_markets_flutter/routes/app_router.dart';
import 'package:qorix_markets_flutter/routes/route_paths.dart';

/// OTP verification — flat layout, no card, matches register/login.
class OtpVerificationScreen extends ConsumerStatefulWidget {
  const OtpVerificationScreen({
    super.key,
    this.email = 'trader@qorixmarkets.com',
    this.isPasswordReset = false,
  });

  final String email;
  final bool isPasswordReset;

  @override
  ConsumerState<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final _otpKey = GlobalKey<AuthOtpInputState>();
  bool _verifying = false;
  bool _error = false;
  String _code = '';
  int _resendSeconds = 45;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _resendSeconds = 45);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      if (_resendSeconds <= 0) {
        t.cancel();
      } else {
        setState(() => _resendSeconds--);
      }
    });
  }

  void _goBack() {
    if (context.canPop()) {
      context.pop();
    } else if (widget.isPasswordReset) {
      context.go(RoutePaths.forgotPassword);
    } else {
      context.go(RoutePaths.register);
    }
  }

  Future<void> _verify(String code) async {
    if (code.length != 6 || _verifying) return;

    setState(() {
      _verifying = true;
      _error = false;
    });

    if (widget.isPasswordReset) {
      final resetOtp = await ref.read(authControllerProvider.notifier).verifyResetOtp(
            email: widget.email,
            otp: code,
          );
      if (!mounted) return;
      setState(() => _verifying = false);

      if (resetOtp == null) {
        HapticFeedback.heavyImpact();
        setState(() => _error = true);
        final err = ref.read(authControllerProvider).error;
        if (err != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              behavior: SnackBarBehavior.floating,
              backgroundColor: AppColors.authCardBg,
              content: Text(
                ErrorMessage.from(err),
                style: const TextStyle(color: Colors.white, fontSize: 13),
              ),
            ),
          );
        }
        return;
      }

      HapticFeedback.mediumImpact();
      context.push(
        RoutePaths.resetPasswordConfirm,
        extra: {'email': widget.email, 'resetOtp': resetOtp},
      );
      return;
    }

    if (UiDemoMode.isActive) {
      await Future<void>.delayed(const Duration(milliseconds: 900));
      if (!mounted) return;
      if (code.endsWith('0')) {
        HapticFeedback.heavyImpact();
        setState(() {
          _verifying = false;
          _error = true;
        });
        return;
      }
      await ref.read(authSessionProvider.notifier).signInDevMock(email: widget.email);
      if (!mounted) return;
      setState(() => _verifying = false);
      ref.read(appRouterProvider).go(RoutePaths.home);
      return;
    }

    final ok = await ref.read(authControllerProvider.notifier).verifyEmail(
          email: widget.email,
          otp: code,
        );
    if (!mounted) return;

    if (!ok) {
      HapticFeedback.heavyImpact();
      setState(() {
        _verifying = false;
        _error = true;
      });
      final err = ref.read(authControllerProvider).error;
      if (err != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.authCardBg,
            content: Text(
              ErrorMessage.from(err),
              style: const TextStyle(color: Colors.white, fontSize: 13),
            ),
          ),
        );
      }
      return;
    }

    HapticFeedback.mediumImpact();
    setState(() => _verifying = false);
    ref.read(appRouterProvider).go(RoutePaths.home);
  }

  Future<void> _onResend() async {
    _otpKey.currentState?.clear();
    setState(() {
      _code = '';
      _error = false;
    });
    _startTimer();

    if (!UiDemoMode.isActive) {
      try {
        if (widget.isPasswordReset) {
          await ref.read(authControllerProvider.notifier).forgotPassword(widget.email);
        } else {
          await ref.read(authControllerProvider.notifier).resendVerification(widget.email);
        }
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.authCardBg,
            content: Text(ErrorMessage.from(e)),
          ),
        );
        return;
      }
    }

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.authCardBg,
        content: Text(
          widget.isPasswordReset
              ? 'A new reset code was sent to ${maskAuthEmail(widget.email)}'
              : 'A new code was sent to ${maskAuthEmail(widget.email)}',
          style: const TextStyle(color: Colors.white, fontSize: 13),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).height < 820;
    final maskedEmail = maskAuthEmail(widget.email);
    final isReset = widget.isPasswordReset;

    return Scaffold(
      backgroundColor: AppDesk.bg,
      resizeToAvoidBottomInset: true,
      body: AuthBackground(
        child: AuthFormPageShell(
          onBack: _goBack,
          showLogo: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              AuthSectionTitle(
                title: isReset ? 'Reset' : 'Verify',
                highlight: isReset ? 'password' : 'email',
                subtitle: isReset
                    ? 'Enter the 6-digit reset code sent to\n$maskedEmail'
                    : 'Enter the 6-digit code sent to\n$maskedEmail',
                alignStart: true,
                leadingInset: 4,
              ),
              SizedBox(height: compact ? AppSpacing.xxxl : AppSpacing.giant),
              AuthOtpInput(
                key: _otpKey,
                enabled: !_verifying,
                hasError: _error,
                onChanged: (code) => setState(() {
                  _code = code;
                  if (_error && code.isNotEmpty) _error = false;
                }),
                onCompleted: _verify,
              ),
              if (_error) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Invalid code. Please try again.',
                  style: TextStyle(
                    color: AppColors.sell.withValues(alpha: 0.95),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxxl),
              AuthCleanPrimaryButton(
                label: isReset ? 'Verify Code' : 'Verify & Continue',
                loading: _verifying,
                onPressed: _code.length == 6 ? () => _verify(_code) : null,
              ),
              SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xl),
              AuthResendRow(
                secondsLeft: _resendSeconds,
                onResend: _onResend,
              ),
              const SizedBox(height: AppSpacing.xs),
              AuthFooterLink(
                prefix: 'Wrong email?',
                action: 'Go back',
                onTap: _goBack,
              ),
              SizedBox(height: compact ? AppSpacing.xxl : AppSpacing.xxxl),
              const AuthCleanSecurityFooter(),
            ],
          ),
        ),
      ),
    );
  }
}
